// scripts/structure/registry/drizzleKitPin.test.mjs — pnpm test scripts/structure/registry/drizzleKitPin.test.mjs
// drizzle-kit の版の固定: 範囲・別の版・無い・パッチのキーの版違いで止める。このリポの package.json は合っている。

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { checkDrizzleKitPin, DRIZZLE_KIT_VERSION, drizzleKitPinProblems } from "./drizzleKitPin.mjs";

const pkg = (version, patchKey = `drizzle-kit@${DRIZZLE_KIT_VERSION}`) => ({
  devDependencies: version === undefined ? {} : { "drizzle-kit": version },
  pnpm: { patchedDependencies: patchKey ? { [patchKey]: `patches/${patchKey}.patch` } : {} },
});

test("合っている: 0.31.8 ぴったり + パッチのキーも 0.31.8", () => {
  assert.deepEqual(drizzleKitPinProblems(pkg("0.31.8")), []);
});

test("止める: 範囲・別の版・無い", () => {
  assert.match(drizzleKitPinProblems(pkg("^0.31.4"))[0], /"\^0\.31\.4" です。範囲でなく "0\.31\.8"/);
  assert.match(drizzleKitPinProblems(pkg("0.31.9"))[0], /"0\.31\.9"/);
  assert.match(drizzleKitPinProblems(pkg(undefined))[0], /drizzle-kit がありません/);
  assert.match(drizzleKitPinProblems(pkg("~0.31.8"))[0], /fork は drizzle-kit の版を変えない/);
});

test("止める: パッチのキーの版が違う・無い", () => {
  assert.match(drizzleKitPinProblems(pkg("0.31.8", "drizzle-kit@0.31.9"))[0], /drizzle-kit@0\.31\.9 が固定の版 drizzle-kit@0\.31\.8 と違います/);
  assert.match(drizzleKitPinProblems(pkg("0.31.8", null))[0], /patchedDependencies に drizzle-kit@0\.31\.8 がありません/);
});

test("このリポの package.json は固定されている", () => {
  assert.deepEqual(checkDrizzleKitPin(join(import.meta.dirname, "../../..")), []);
});
