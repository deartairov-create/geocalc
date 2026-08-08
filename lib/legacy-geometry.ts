import proj4 from "proj4";

export type GeoPoint = {
  lat: number;
  lon: number;
};

export type MetricPoint = {
  x: number;
  y: number;
};

export type CoordinateErrorCode =
  | "incomplete"
  | "invalid-number"
  | "invalid-latitude"
  | "invalid-longitude";

export class CoordinateParseError extends Error {
  constructor(
    public readonly line: number,
    public readonly code: CoordinateErrorCode,
  ) {
    super(`${line}:${code}`);
    this.name = "CoordinateParseError";
  }
}

proj4.defs(
  "EPSG:4326",
  "+proj=longlat +datum=WGS84 +no_defs +type=crs",
);
proj4.defs(
  "EPSG:32641",
  "+proj=utm +zone=41 +datum=WGS84 +units=m +no_defs +type=crs",
);
proj4.defs(
  "EPSG:32642",
  "+proj=utm +zone=42 +datum=WGS84 +units=m +no_defs +type=crs",
);
proj4.defs(
  "EPSG:32643",
  "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs +type=crs",
);

// The functions below preserve the original GeoCalc formulas and thresholds.
// Keep their arithmetic unchanged: the modern UI depends on this legacy core.
export function getMetricCrsForLon(lon: number) {
  if (lon >= 60 && lon < 66) return "EPSG:32641";
  if (lon >= 66 && lon < 72) return "EPSG:32642";
  if (lon >= 72 && lon < 78) return "EPSG:32643";
  return "EPSG:32642";
}

export function parseCoordinates(text: string): GeoPoint[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const points: GeoPoint[] = [];

  for (let i = 0; i < lines.length; i++) {
    const clean = lines[i].replace(/,/g, " ").replace(/;/g, " ");
    const parts = clean.split(/\s+/).filter(Boolean);

    if (parts.length < 2) {
      throw new CoordinateParseError(i + 1, "incomplete");
    }

    const lat = Number(parts[0]);
    const lon = Number(parts[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new CoordinateParseError(i + 1, "invalid-number");
    }

    if (lat < -90 || lat > 90) {
      throw new CoordinateParseError(i + 1, "invalid-latitude");
    }

    if (lon < -180 || lon > 180) {
      throw new CoordinateParseError(i + 1, "invalid-longitude");
    }

    points.push({ lat, lon });
  }

  return points;
}

export function transformPointsToMetric(points: GeoPoint[]): MetricPoint[] {
  if (!points.length) return [];

  const meanLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  const dst = getMetricCrsForLon(meanLon);

  return points.map((p) => {
    const [x, y] = proj4("EPSG:4326", dst, [p.lon, p.lat]);
    return { x, y };
  });
}

export function calculatePolygonAreaXY(projectedPoints: MetricPoint[]) {
  let area = 0;

  for (let i = 0; i < projectedPoints.length; i++) {
    const p1 = projectedPoints[i];
    const p2 = projectedPoints[(i + 1) % projectedPoints.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }

  return Math.abs(area) / 2;
}

export function calculateAccurateArea(points: GeoPoint[]) {
  const metricPoints = transformPointsToMetric(points);
  return calculatePolygonAreaXY(metricPoints);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function projectPointsToCanvas(
  points: GeoPoint[],
  width: number,
  height: number,
  padding = 40,
) {
  const projected = transformPointsToMetric(points);

  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let xRange = maxX - minX;
  let yRange = maxY - minY;

  if (xRange === 0) xRange = 1;
  if (yRange === 0) yRange = 1;

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const scaleX = drawWidth / xRange;
  const scaleY = drawHeight / yRange;
  const scale = Math.min(scaleX, scaleY);

  const contentWidth = xRange * scale;
  const contentHeight = yRange * scale;

  const offsetX = (width - contentWidth) / 2;
  const offsetY = (height - contentHeight) / 2;

  return projected.map((p) => {
    const x = offsetX + (p.x - minX) * scale;
    const y = height - (offsetY + (p.y - minY) * scale);
    return { x, y };
  });
}

export function trimTrailingZeros(numStr: string) {
  if (!numStr.includes(".")) return numStr;
  return numStr.replace(/\.?0+$/, "");
}

export function toDMS(decimalValue: number, type: "lat" | "lon") {
  if (!Number.isFinite(decimalValue)) {
    throw new Error("Invalid number.");
  }

  const abs = Math.abs(decimalValue);
  const degrees = Math.floor(abs);
  const minutesFull = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  let seconds = (minutesFull - minutes) * 60;

  seconds = Number(seconds.toFixed(10));
  const secondsStr = trimTrailingZeros(seconds.toString());

  let hemisphere = "";
  if (type === "lat") {
    hemisphere = decimalValue >= 0 ? "N" : "S";
  } else {
    hemisphere = decimalValue >= 0 ? "E" : "W";
  }

  return `${degrees}° ${minutes}' ${secondsStr}" ${hemisphere}`;
}

export function fromDMS(
  deg: number,
  min: number,
  sec: number,
  hemisphere: "E" | "W" | "N" | "S",
) {
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) {
    throw new Error("Invalid values.");
  }

  if (min < 0 || min >= 60 || sec < 0 || sec >= 60) {
    throw new Error("Minutes or seconds are out of range.");
  }

  let decimal = Math.abs(deg) + min / 60 + sec / 3600;

  if (["W", "S"].includes(hemisphere)) {
    decimal *= -1;
  }

  if (["N", "S"].includes(hemisphere) && decimal > 90) {
    throw new Error("Latitude cannot be greater than 90.");
  }

  if (["E", "W"].includes(hemisphere) && decimal > 180) {
    throw new Error("Longitude cannot be greater than 180.");
  }

  return decimal;
}

export function calculateMetricPerimeter(points: GeoPoint[]) {
  const metricPoints = transformPointsToMetric(points);
  let perimeter = 0;

  for (let i = 0; i < metricPoints.length; i++) {
    const p1 = metricPoints[i];
    const p2 = metricPoints[(i + 1) % metricPoints.length];
    perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  return perimeter;
}
