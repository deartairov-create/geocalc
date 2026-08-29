import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateVincentyDistanceAndAzimuth,
  calculateDirectGeodeticPoint,
  calculatePolygonProperties,
  calculateSlope,
  solveDifferentialLeveling,
  SimpleShapes,
} from "../lib/geodesy-advanced";

test("Vincenty distance between Tashkent and Samarkand is accurate (~270 km)", () => {
  const p1 = { lat: 41.311081, lon: 69.240562 };
  const p2 = { lat: 39.6547, lon: 66.9758 };

  const res = calculateVincentyDistanceAndAzimuth(p1, p2);
  assert.ok(res.distanceKm > 260 && res.distanceKm < 280);
  assert.ok(res.initialAzimuthDeg > 220 && res.initialAzimuthDeg < 240);
  assert.equal(res.rhumbQuadrant, "SW");
});

test("Direct geodetic point calculates expected destination coordinate", () => {
  const p1 = { lat: 41.311081, lon: 69.240562 };
  const azimuth = 90;
  const distance = 1000;

  const p2 = calculateDirectGeodeticPoint(p1, azimuth, distance);
  assert.ok(Math.abs(p2.lat - p1.lat) < 0.001);
  assert.ok(p2.lon > p1.lon);

  const check = calculateVincentyDistanceAndAzimuth(p1, p2);
  assert.ok(Math.abs(check.distanceMeters - 1000) < 0.05);
});

test("Polygon properties calculates area in m2, sotix, hectare and centroid", () => {
  const points = [
    { lat: 41.311081, lon: 69.240562 },
    { lat: 41.311081, lon: 69.241562 },
    { lat: 41.310281, lon: 69.241562 },
    { lat: 41.310281, lon: 69.240562 },
  ];

  const props = calculatePolygonProperties(points);
  assert.ok(props !== null);
  assert.ok(props.areaM2 > 7000 && props.areaM2 < 8000);
  assert.ok(props.areaSotix > 70 && props.areaSotix < 80);
  assert.ok(props.areaHectares > 0.7 && props.areaHectares < 0.8);
  assert.ok(props.perimeterMeters > 300 && props.perimeterMeters < 400);
});

test("Slope calculation computes percent, promille, angle and ratio", () => {
  const res = calculateSlope(5, 100);
  assert.equal(res.slopePercent, 5);
  assert.equal(res.slopePromille, 50);
  assert.ok(Math.abs(res.slopeAngleDeg - 2.8624) < 0.01);
  assert.equal(res.ratioString, "1 : 20.00");
});

test("Leveling solver calculates HI and Reduced Levels accurately", () => {
  const rows = [
    { bs: 1.5, remark: "BM 100.00" },
    { is: 1.2 },
    { is: 1.8 },
    { fs: 2.1, bs: 1.4 },
    { fs: 1.0, remark: "TBM" },
  ];

  const table = solveDifferentialLeveling(100.0, rows);
  assert.equal(table.length, 5);
  assert.equal(table[0].heightOfInstrument, 101.5);
  assert.equal(table[0].reducedLevel, 100.0);
  assert.equal(table[1].reducedLevel, 100.3);
  assert.equal(table[2].reducedLevel, 99.7);
  assert.equal(table[3].reducedLevel, 99.4);
  assert.equal(table[3].heightOfInstrument, 100.8);
  assert.equal(table[4].reducedLevel, 99.8);
});

test("Simple shapes calculate correct areas", () => {
  const rect = SimpleShapes.rectangle(20, 50);
  assert.equal(rect.area, 1000);
  assert.equal(rect.perimeter, 140);

  const tri = SimpleShapes.triangleHeron(3, 4, 5);
  assert.equal(tri.area, 6);
  assert.equal(tri.perimeter, 12);

  const trap = SimpleShapes.trapezoid(10, 20, 5);
  assert.equal(trap.area, 75);

  const circ = SimpleShapes.circle(10);
  assert.ok(Math.abs(circ.area - 314.1592653589793) < 0.01);
});
