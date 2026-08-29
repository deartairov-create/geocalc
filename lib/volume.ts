import Delaunator from "delaunator";
import { transformPointsToMetric } from "./legacy-geometry";

export type VolumeCoordinateMode = "wgs84" | "local";
export type VolumeDesignMode = "level" | "per-point";

export type VolumePoint = {
  x: number;
  y: number;
  existingZ: number;
  designZ: number;
  sourceA: number;
  sourceB: number;
};

export type VolumeTriangle = {
  indices: [number, number, number];
  meanDifference: number;
};

export type VolumeResult = {
  cut: number;
  fill: number;
  net: number;
  planArea: number;
  points: VolumePoint[];
  triangles: VolumeTriangle[];
};

export class VolumeInputError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
  ) {
    super(message);
    this.name = "VolumeInputError";
  }
}

type DepthPoint = {
  x: number;
  y: number;
  d: number;
};

const EPSILON = 1e-10;

export function parseVolumeRows(
  text: string,
  coordinateMode: VolumeCoordinateMode,
  designMode: VolumeDesignMode,
  designLevel: number,
): VolumePoint[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    throw new VolumeInputError("Kamida 3 ta balandlik nuqtasi kerak.");
  }

  const rows = lines.map((line, index) => {
    const values = line
      .replace(/,/g, " ")
      .replace(/;/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);

    const minimum = designMode === "per-point" ? 4 : 3;
    if (values.length < minimum || values.slice(0, minimum).some((v) => !Number.isFinite(v))) {
      throw new VolumeInputError(
        designMode === "per-point"
          ? "X/Y, mavjud Z va loyiha Z qiymatlarini kiriting."
          : "X/Y va mavjud Z qiymatlarini kiriting.",
        index + 1,
      );
    }

    if (coordinateMode === "wgs84") {
      if (values[0] < -90 || values[0] > 90) {
        throw new VolumeInputError("Kenglik −90…90 oralig‘ida bo‘lishi kerak.", index + 1);
      }
      if (values[1] < -180 || values[1] > 180) {
        throw new VolumeInputError("Uzunlik −180…180 oralig‘ida bo‘lishi kerak.", index + 1);
      }
    }

    return {
      a: values[0],
      b: values[1],
      existingZ: values[2],
      designZ: designMode === "per-point" ? values[3] : designLevel,
    };
  });

  if (designMode === "level" && !Number.isFinite(designLevel)) {
    throw new VolumeInputError("Loyiha balandligini son ko‘rinishida kiriting.");
  }

  const metric =
    coordinateMode === "wgs84"
      ? transformPointsToMetric(rows.map((row) => ({ lat: row.a, lon: row.b })))
      : rows.map((row) => ({ x: row.a, y: row.b }));

  const seen = new Set<string>();
  const points = rows.map((row, index) => {
    const key = `${metric[index].x.toFixed(8)}:${metric[index].y.toFixed(8)}`;
    if (seen.has(key)) {
      throw new VolumeInputError("Bir xil X/Y nuqta takrorlangan.", index + 1);
    }
    seen.add(key);

    return {
      x: metric[index].x,
      y: metric[index].y,
      existingZ: row.existingZ,
      designZ: row.designZ,
      sourceA: row.a,
      sourceB: row.b,
    };
  });

  return points;
}

function triangleArea(a: DepthPoint, b: DepthPoint, c: DepthPoint) {
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2,
  );
}

function isInside(point: DepthPoint, positive: boolean) {
  return positive ? point.d >= -EPSILON : point.d <= EPSILON;
}

function interpolateZero(a: DepthPoint, b: DepthPoint): DepthPoint {
  const denominator = a.d - b.d;
  const t = Math.abs(denominator) < EPSILON ? 0 : a.d / denominator;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    d: 0,
  };
}

function clipByZero(points: DepthPoint[], positive: boolean) {
  const output: DepthPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const currentInside = isInside(current, positive);
    const nextInside = isInside(next, positive);

    if (currentInside && nextInside) {
      output.push(next);
    } else if (currentInside && !nextInside) {
      output.push(interpolateZero(current, next));
    } else if (!currentInside && nextInside) {
      output.push(interpolateZero(current, next), next);
    }
  }

  return output;
}

function integrateDepthPolygon(points: DepthPoint[], positive: boolean) {
  if (points.length < 3) return 0;

  let volume = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[0];
    const b = points[i];
    const c = points[i + 1];
    const area = triangleArea(a, b, c);
    const averageDepth = (a.d + b.d + c.d) / 3;
    volume += area * (positive ? averageDepth : -averageDepth);
  }

  return Math.max(0, volume);
}

export function calculateCutFill(points: VolumePoint[]): VolumeResult {
  if (points.length < 3) {
    throw new VolumeInputError("Kamida 3 ta balandlik nuqtasi kerak.");
  }

  const delaunay = Delaunator.from(points, (point) => point.x, (point) => point.y);
  if (delaunay.triangles.length < 3) {
    throw new VolumeInputError("Nuqtalar bir chiziqda joylashgan. Maydon hosil qiladigan nuqtalar kiriting.");
  }

  let cut = 0;
  let fill = 0;
  let planArea = 0;
  const triangles: VolumeTriangle[] = [];

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const indices: [number, number, number] = [
      delaunay.triangles[i],
      delaunay.triangles[i + 1],
      delaunay.triangles[i + 2],
    ];
    const triangle = indices.map((index) => {
      const point = points[index];
      return {
        x: point.x,
        y: point.y,
        d: point.designZ - point.existingZ,
      };
    }) as [DepthPoint, DepthPoint, DepthPoint];

    const area = triangleArea(triangle[0], triangle[1], triangle[2]);
    if (area <= EPSILON) continue;

    planArea += area;
    fill += integrateDepthPolygon(clipByZero(triangle, true), true);
    cut += integrateDepthPolygon(clipByZero(triangle, false), false);
    triangles.push({
      indices,
      meanDifference: (triangle[0].d + triangle[1].d + triangle[2].d) / 3,
    });
  }

  if (!triangles.length || planArea <= EPSILON) {
    throw new VolumeInputError("TIN yuzasi hosil bo‘lmadi. Nuqtalarni tekshiring.");
  }

  return {
    cut,
    fill,
    net: fill - cut,
    planArea,
    points,
    triangles,
  };
}

export function projectVolumePoints(
  points: VolumePoint[],
  width: number,
  height: number,
  padding = 26,
) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const scale = Math.min(
    (width - padding * 2) / xRange,
    (height - padding * 2) / yRange,
  );
  const contentWidth = xRange * scale;
  const contentHeight = yRange * scale;
  const offsetX = (width - contentWidth) / 2;
  const offsetY = (height - contentHeight) / 2;

  return points.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: height - (offsetY + (point.y - minY) * scale),
  }));
}
