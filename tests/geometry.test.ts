import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAccurateArea,
  fromDMS,
  parseCoordinates,
  toDMS,
} from "../lib/legacy-geometry";
import { calculateCutFill, parseVolumeRows } from "../lib/volume";

function almostEqual(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test("legacy WGS84 area core keeps the original GeoCalc result", () => {
  const points = parseCoordinates(`41.311081 69.240562
41.311081 69.241562
41.310281 69.241562
41.310281 69.240562`);

  assert.equal(points.length, 4);
  almostEqual(calculateAccurateArea(points), 7434.14990234375);
});

test("legacy coordinate parser accepts comma and semicolon separators", () => {
  assert.deepEqual(parseCoordinates("41.1, 69.2\n41.2;69.3"), [
    { lat: 41.1, lon: 69.2 },
    { lat: 41.2, lon: 69.3 },
  ]);
});

test("legacy decimal and DMS formulas round-trip without drift", () => {
  assert.equal(toDMS(41.311081, "lat"), `41° 18' 39.8916" N`);
  almostEqual(fromDMS(41, 18, 39.8916, "N"), 41.311081, 1e-10);
});

test("TIN volume integrates a flat fill prism", () => {
  const points = parseVolumeRows("0 0 0\n10 0 0\n0 10 0", "local", "level", 1);
  const result = calculateCutFill(points);

  almostEqual(result.planArea, 50);
  almostEqual(result.fill, 50);
  almostEqual(result.cut, 0);
  almostEqual(result.net, 50);
});

test("TIN volume splits a mixed cut/fill triangle at the zero contour", () => {
  const points = parseVolumeRows(
    "0 0 0 1\n10 0 0 -1\n0 10 0 -1",
    "local",
    "per-point",
    0,
  );
  const result = calculateCutFill(points);

  almostEqual(result.planArea, 50);
  almostEqual(result.fill, 25 / 6);
  almostEqual(result.cut, 125 / 6);
  almostEqual(result.net, -50 / 3);
});
