import proj4 from "proj4";
import {
  GeoPoint,
  MetricPoint,
  transformPointsToMetric,
  calculatePolygonAreaXY,
  calculateMetricPerimeter,
} from "./legacy-geometry";

export type AzimuthResult = {
  distanceMeters: number;
  distanceKm: number;
  initialAzimuthDeg: number;
  finalAzimuthDeg: number;
  rhumbAngle: number;
  rhumbQuadrant: "NE" | "SE" | "SW" | "NW";
  rhumbString: string;
  deltaX: number;
  deltaY: number;
};

export type DirectGeodeticResult = {
  lat: number;
  lon: number;
  dmsLat: string;
  dmsLon: string;
};

export type LevelingStation = {
  id: string;
  stationName: string;
  backsight?: number; // BS (Ortga qarash)
  intermediate?: number; // IS (Oraliq qarash)
  foresight?: number; // FS (Oldinga qarash)
  heightOfInstrument?: number; // HI (Asbob balandligi)
  reducedLevel?: number; // RL (Relyef nuqtasi)
  remark?: string;
};

export type SlopeResult = {
  deltaH: number;
  horizontalDistance: number;
  slopePercent: number;
  slopePromille: number;
  slopeAngleDeg: number;
  ratioString: string;
};

export type SimpleShapeResult = {
  area: number;
  perimeter: number;
  details: Record<string, number | string>;
};

// Earth radius constants (WGS-84)
const WGS84_A = 6378137.0; // semi-major axis (m)
const WGS84_F = 1 / 298.257223563; // flattening
const WGS84_B = 6356752.314245; // semi-minor axis (m)
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function roundPrecision(val: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * High-accuracy geodesic distance and azimuth via Vincenty Inverse formula
 */
export function calculateVincentyDistanceAndAzimuth(
  p1: GeoPoint,
  p2: GeoPoint,
): AzimuthResult {
  const L = (p2.lon - p1.lon) * DEG_TO_RAD;
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(p1.lat * DEG_TO_RAD));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(p2.lat * DEG_TO_RAD));
  const sinU1 = Math.sin(U1),
    cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2),
    cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP = 2 * Math.PI;
  let iterLimit = 100;
  let cosSqAlpha = 0;
  let sinSigma = 0;
  let cos2SigmaM = 0;
  let cosSigma = 0;
  let sigma = 0;

  while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      cosU2 * sinLambda * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
          (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda),
    );

    if (sinSigma === 0) {
      return {
        distanceMeters: 0,
        distanceKm: 0,
        initialAzimuthDeg: 0,
        finalAzimuthDeg: 0,
        rhumbAngle: 0,
        rhumbQuadrant: "NE",
        rhumbString: "0° 00' 00\" NE",
        deltaX: 0,
        deltaY: 0,
      };
    }

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM =
      cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;

    const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L +
      (1 - C) *
        WGS84_F *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  }

  const uSq =
    (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) /
    (WGS84_B * WGS84_B);
  const A =
    1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  const distanceMeters = WGS84_B * A * (sigma - deltaSigma);
  const alpha1 = Math.atan2(
    cosU2 * Math.sin(lambda),
    cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lambda),
  );
  const alpha2 = Math.atan2(
    cosU1 * Math.sin(lambda),
    -sinU1 * cosU2 + cosU1 * sinU2 * Math.cos(lambda),
  );

  const initialAzimuthDeg = (alpha1 * RAD_TO_DEG + 360) % 360;
  const finalAzimuthDeg = (alpha2 * RAD_TO_DEG + 360) % 360;

  // Rhumb calculation
  let rhumbAngle = initialAzimuthDeg;
  let rhumbQuadrant: "NE" | "SE" | "SW" | "NW" = "NE";

  if (initialAzimuthDeg >= 0 && initialAzimuthDeg <= 90) {
    rhumbQuadrant = "NE";
    rhumbAngle = initialAzimuthDeg;
  } else if (initialAzimuthDeg > 90 && initialAzimuthDeg <= 180) {
    rhumbQuadrant = "SE";
    rhumbAngle = 180 - initialAzimuthDeg;
  } else if (initialAzimuthDeg > 180 && initialAzimuthDeg <= 270) {
    rhumbQuadrant = "SW";
    rhumbAngle = initialAzimuthDeg - 180;
  } else {
    rhumbQuadrant = "NW";
    rhumbAngle = 360 - initialAzimuthDeg;
  }

  const rhumbDeg = Math.floor(rhumbAngle);
  const rhumbMinFull = (rhumbAngle - rhumbDeg) * 60;
  const rhumbMin = Math.floor(rhumbMinFull);
  const rhumbSec = Math.round((rhumbMinFull - rhumbMin) * 60);
  const rhumbString = `${rhumbQuadrant} ${rhumbDeg}° ${rhumbMin}' ${rhumbSec}"`;

  const projected = transformPointsToMetric([p1, p2]);
  const deltaX = projected.length === 2 ? projected[1].x - projected[0].x : 0;
  const deltaY = projected.length === 2 ? projected[1].y - projected[0].y : 0;

  return {
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    initialAzimuthDeg,
    finalAzimuthDeg,
    rhumbAngle,
    rhumbQuadrant,
    rhumbString,
    deltaX,
    deltaY,
  };
}

/**
 * Direct geodetic problem: find target point given start point, azimuth (deg), and distance (m)
 */
export function calculateDirectGeodeticPoint(
  p1: GeoPoint,
  azimuthDeg: number,
  distanceMeters: number,
): GeoPoint {
  const alpha1 = azimuthDeg * DEG_TO_RAD;
  const sinAlpha1 = Math.sin(alpha1);
  const cosAlpha1 = Math.cos(alpha1);

  const tanU1 = (1 - WGS84_F) * Math.tan(p1.lat * DEG_TO_RAD);
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;

  const sigma1 = Math.atan2(tanU1, cosAlpha1);
  const sinAlpha = cosU1 * sinAlpha1;
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;

  const uSq =
    (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) /
    (WGS84_B * WGS84_B);
  const A =
    1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  let sigma = distanceMeters / (WGS84_B * A);
  let sigmaP = 2 * Math.PI;
  let cos2SigmaM = 0;
  let sinSigma = 0;
  let cosSigma = 0;
  let iterLimit = 100;

  while (Math.abs(sigma - sigmaP) > 1e-12 && --iterLimit > 0) {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    const deltaSigma =
      B *
      sinSigma *
      (cos2SigmaM +
        (B / 4) *
          (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            (B / 6) *
              cos2SigmaM *
              (-3 + 4 * sinSigma * sinSigma) *
              (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    sigmaP = sigma;
    sigma = distanceMeters / (WGS84_B * A) + deltaSigma;
  }

  const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
  const lat2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
    (1 - WGS84_F) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp),
  );

  const lambda = Math.atan2(
    sinSigma * sinAlpha1,
    cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1,
  );

  const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
  const L =
    lambda -
    (1 - C) *
      WGS84_F *
      sinAlpha *
      (sigma +
        C *
          sinSigma *
          (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

  const lon2 = p1.lon * DEG_TO_RAD + L;

  return {
    lat: lat2 * RAD_TO_DEG,
    lon: lon2 * RAD_TO_DEG,
  };
}

/**
 * Polygon centroid and bounding box
 */
export function calculatePolygonProperties(points: GeoPoint[]) {
  if (!points.length) return null;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const centroidLat = lats.reduce((a, b) => a + b, 0) / points.length;
  const centroidLon = lons.reduce((a, b) => a + b, 0) / points.length;

  const metric = transformPointsToMetric(points);
  const areaM2 = calculatePolygonAreaXY(metric);
  const perimeterM = calculateMetricPerimeter(points);

  return {
    centroid: { lat: centroidLat, lon: centroidLon },
    bounds: { minLat, maxLat, minLon, maxLon },
    areaM2,
    areaSotix: areaM2 / 100, // 1 sotix = 100 m²
    areaHectares: areaM2 / 10000,
    areaSqKm: areaM2 / 1000000,
    areaSqFt: areaM2 * 10.7639,
    areaAcres: areaM2 * 0.000247105,
    perimeterMeters: perimeterM,
    perimeterKm: perimeterM / 1000,
    pointCount: points.length,
  };
}

/**
 * Slope and Leveling calculations
 */
export function calculateSlope(
  deltaH: number,
  horizontalDistance: number,
): SlopeResult {
  if (horizontalDistance <= 0) {
    throw new Error("Gorizontal masofa 0 dan katta bo‘lishi kerak.");
  }

  const slopePercent = roundPrecision((Math.abs(deltaH) / horizontalDistance) * 100, 3);
  const slopePromille = roundPrecision((Math.abs(deltaH) / horizontalDistance) * 1000, 2);
  const slopeAngleRad = Math.atan(Math.abs(deltaH) / horizontalDistance);
  const slopeAngleDeg = roundPrecision(slopeAngleRad * RAD_TO_DEG, 4);
  const ratio = roundPrecision(horizontalDistance / Math.max(1e-6, Math.abs(deltaH)), 2);
  const ratioString = `1 : ${ratio.toFixed(2)}`;

  return {
    deltaH,
    horizontalDistance,
    slopePercent,
    slopePromille,
    slopeAngleDeg,
    ratioString,
  };
}

/**
 * Differential Leveling calculation table
 */
export function solveDifferentialLeveling(
  initialBenchmarkRL: number,
  rows: Array<{ bs?: number; is?: number; fs?: number; remark?: string }>,
): LevelingStation[] {
  let currentHI = roundPrecision(initialBenchmarkRL + (rows[0]?.bs ?? 0), 4);
  const result: LevelingStation[] = [];

  rows.forEach((row, idx) => {
    let rl: number | undefined;
    if (idx === 0) {
      rl = roundPrecision(initialBenchmarkRL, 4);
      if (row.bs !== undefined) {
        currentHI = roundPrecision(rl + row.bs, 4);
      }
    } else {
      if (row.is !== undefined) {
        rl = roundPrecision(currentHI - row.is, 4);
      } else if (row.fs !== undefined) {
        rl = roundPrecision(currentHI - row.fs, 4);
        if (row.bs !== undefined) {
          currentHI = roundPrecision(rl + row.bs, 4);
        }
      }
    }

    result.push({
      id: String(idx + 1),
      stationName: `ST-${idx + 1}`,
      backsight: row.bs !== undefined ? roundPrecision(row.bs, 4) : undefined,
      intermediate: row.is !== undefined ? roundPrecision(row.is, 4) : undefined,
      foresight: row.fs !== undefined ? roundPrecision(row.fs, 4) : undefined,
      heightOfInstrument: roundPrecision(currentHI, 4),
      reducedLevel: rl !== undefined ? roundPrecision(rl, 4) : undefined,
      remark: row.remark,
    });
  });

  return result;
}

/**
 * Simple Geometry Shapes (Quick calculator)
 */
export const SimpleShapes = {
  rectangle(width: number, length: number): SimpleShapeResult {
    const area = roundPrecision(width * length, 3);
    const perimeter = roundPrecision(2 * (width + length), 3);
    return {
      area,
      perimeter,
      details: {
        "Eni (a)": width,
        "Bo‘yi (b)": length,
        "Diagonal": roundPrecision(Math.hypot(width, length), 3),
      },
    };
  },

  triangleHeron(a: number, b: number, c: number): SimpleShapeResult {
    if (a + b <= c || a + c <= b || b + c <= a) {
      throw new Error(
        "Uchburchak tengsizligi buzildi: bunday tomonli uchburchak mavjud emas.",
      );
    }
    const s = (a + b + c) / 2;
    const area = roundPrecision(Math.sqrt(s * (s - a) * (s - b) * (s - c)), 3);
    const perimeter = roundPrecision(a + b + c, 3);
    return {
      area,
      perimeter,
      details: {
        "Yarim perimetr (p)": s,
        "Ichki chizilgan aylana radiusi (r)": roundPrecision(area / s, 3),
        "Tashqi chizilgan aylana radiusi (R)": roundPrecision((a * b * c) / (4 * area), 3),
      },
    };
  },

  trapezoid(a: number, b: number, h: number): SimpleShapeResult {
    const area = roundPrecision(((a + b) / 2) * h, 3);
    const sideApprox = Math.hypot(Math.abs(a - b) / 2, h);
    const perimeter = roundPrecision(a + b + 2 * sideApprox, 3);
    return {
      area,
      perimeter,
      details: {
        "Asos a": a,
        "Asos b": b,
        "Balandlik h": h,
        "O‘rta chiziq": roundPrecision((a + b) / 2, 3),
      },
    };
  },

  circle(radius: number): SimpleShapeResult {
    const area = roundPrecision(Math.PI * radius * radius, 3);
    const perimeter = roundPrecision(2 * Math.PI * radius, 3);
    return {
      area,
      perimeter,
      details: {
        "Radius (R)": radius,
        "Diametr (D)": radius * 2,
      },
    };
  },

  pitVolume(topArea: number, bottomArea: number, depth: number) {
    const volume = roundPrecision(
      (depth / 3) * (topArea + bottomArea + Math.sqrt(topArea * bottomArea)),
      3
    );
    return {
      volume,
      topArea,
      bottomArea,
      depth,
    };
  },
};
