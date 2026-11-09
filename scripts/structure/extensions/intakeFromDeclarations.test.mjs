// 実リポの受け口の一覧(src/lib/forkOwnership/intake.txt): src の下の行は全部生成区画にあり(4 つの型: 画面 = ルートと 1 行スイッチ・
// 受け口と上書き = 拡張点の宣言・置き場 = placement の宣言・生成物と区画 = 生成器の gate.json)、種類(edit / add / region / append / generated)は
// 手書きだったときと同じ。手書きの区画に残るのはリポ直下の道具の設定・素材・servers/room・規則と負債だけ
// 実行: pnpm test scripts/structure/extensions/intakeFromDeclarations.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { collectPoints } from "../../../src/lib/districtMap/declarations.mjs";
import { OVERRIDE_ROOT } from "../../../src/lib/districtMap/kinds.mjs";
import { INTAKE_BLOCK_END, INTAKE_BLOCK_START, INTAKE_FILE, matchIntake, parseIntake } from "../../../src/lib/forkOwnership/intake.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { FORK_OWNED_DIR } from "../../../src/lib/screens/checks.mjs";
import { loadGates, scanTargets } from "../../runner/gates/scan.mjs";
import { literalGlob, overrideGlobOf } from "./intake.mjs";
import { checkSwitches } from "./switches.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const text = readFileSync(join(repoRoot, INTAKE_FILE), "utf8");
const lines = text.split("\n");
const start = lines.indexOf(INTAKE_BLOCK_START);
const end = lines.indexOf(INTAKE_BLOCK_END);
const { rules } = parseIntake(text);
const inBlock = (rule) => rule.line - 1 > start && rule.line - 1 < end;
const key = (rule) => `${rule.kind} ${rule.glob}`;

/** 宣言と 1 行スイッチから作れる行(種類つき) */
function derivedRows() {
  const { switches } = checkSwitches(repoRoot, { isTier1: readForkIdentity(repoRoot).isTier1 });
  const rows = switches.map((s) => `edit ${literalGlob(s.path)}`);
  const { points } = collectPoints(repoRoot);
  for (const point of points.filter((p) => p.spec.placement !== undefined)) rows.push(`${point.spec.kind} ${point.spec.placement}`);
  for (const t of scanTargets(join(repoRoot, "scripts"), loadGates(join(repoRoot, "scripts")))) {
    for (const glob of t.decl.regions ?? []) rows.push(`region ${glob}`);
    for (const glob of t.decl.outputs ?? []) rows.push(`generated ${glob}`);
  }
  for (const point of points.filter((p) => p.spec.overrides !== undefined)) {
    rows.push(`edit ${overrideGlobOf(point.spec.overrides)}`);
    if (point.spec.addable) rows.push(`add ${point.spec.overrides}`);
  }
  return rows.sort();
}

test("宣言・1 行スイッチ・生成器から作れる行は生成区画にだけある(種類つき)", () => {
  const derived = derivedRows();
  const block = new Set(rules.filter(inBlock).map(key));
  const hand = new Set(rules.filter((r) => !inBlock(r)).map(key));
  assert.deepEqual(derived.filter((row) => !block.has(row)), [], "生成区画に無い");
  assert.deepEqual(derived.filter((row) => hand.has(row)), [], "手書きの区画に残っている");
  for (const row of [
    "edit src/config/**",
    "edit src/business/**",
    "edit src/styles/*.css",
    "edit src/app/favicon.ico",
    "edit src/app/**/_components/**",
    "append src/lib/CATALOG.md",
    "region src/registry/**/*.ts",
    "generated src/registry/serviceRegistry.ts",
    "generated src/**/extensions/**",
    "generated vercel.json",
    "edit src/app/_providers/ForkProviders.tsx",
    "edit src/app/(user)/layout.tsx",
    "edit src/app/(user)/(protected)/wallet/[[]slug[]]/page.tsx",
  ]) assert.ok(block.has(row), `${row} が生成区画に無い`);
});

test("置き場の宣言は仕組みの定数と同じ(config = 上書きの根の下全体、_components = 画面の fork の部品のフォルダ)", () => {
  const placements = Object.fromEntries(collectPoints(repoRoot).points.filter((p) => p.spec.placement !== undefined).map((p) => [p.name, p.spec.placement]));
  assert.equal(placements.configValues, `${OVERRIDE_ROOT}/**`);
  assert.equal(placements.forkScreenParts, `src/app/**/${FORK_OWNED_DIR}/**`);
});

test("手書きの区画: src の下の行も生成物の行も無い(残るのはリポ直下の道具の設定・素材・servers/room・規則・負債)", () => {
  const hand = rules.filter((r) => !inBlock(r));
  assert.deepEqual(hand.filter((r) => r.glob.startsWith("src/")).map(key), []);
  assert.deepEqual(hand.filter((r) => r.kind === "generated").map(key), []);
  assert.deepEqual(rules.filter(inBlock).filter((r) => !r.glob.startsWith("src/") && r.glob !== "vercel.json").map(key), [], "生成区画は src の下(と生成物の vercel.json)だけ");
});

test("効く種類(最後に当たった行)は生成区画へ移す前と同じ(印の付いた意図した変化を除く): 見本のパス", () => {
  const kindOf = (path) => matchIntake(rules, path)?.kind ?? null;
  const expected = {
    "src/app/api/cron/storage-sweep/task.override.ts": "edit",
    "src/app/api/cron/storage-sweep/task.ts": null,
    "src/features/core/user/services/server/domainEntry.override.ts": "edit",
    "src/features/core/user/coreRoles/user.role.override.ts": "edit",
    "src/features/core/user/coreRoles/user.role.json": null,
    "src/features/core/user/roles/contributor.role.override.ts": "edit",
    "src/features/core/user/roles/contributor.role.json": "add",
    "src/features/core/userProfile/profiles/user.profile.override.ts": "edit",
    "src/features/core/userProfile/profiles/user.profile.json": "add",
    "src/features/core/auth/services/server/onDemoUserCreated.ts": "edit",
    "src/features/core/auth/services/server/onDemoUserCreated.replace.ts": "add",
    "src/features/core/auth/services/server/onDemoUserCreated.default.ts": null,
    // 意図した唯一の変化: 6 本目のスイッチ AdminHeader の素の名前に edit の行が付く(前は受け口の外 = null。指令 30 Q1)
    "src/app/admin/_layout/AdminHeader.tsx": "edit",
    "src/features/core/userProfile/entities/profiles/user.ts": "generated",
    "src/config/app/payment.config.ts": "edit",
    "src/config/features/legal.config.ts": "edit",
    "src/business/business.ts": "edit",
    "src/styles/palette.css": "edit",
    "src/styles/core/base.css": null,
    "src/app/favicon.ico": "edit",
    "src/app/(user)/(protected)/wallet/[slug]/page.tsx": "edit",
    "src/app/(user)/(protected)/wallet/s/page.tsx": null,
    "src/app/(user)/layout.tsx": "edit",
    "src/app/(user)/(protected)/layout.tsx": null,
    "src/app/admin/(protected)/users/_components/X.tsx": "edit",
    "src/app/admin/(protected)/users/_components/extensions/x.ts": "generated",
    "src/lib/CATALOG.md": "append",
    "src/registry/serviceRegistry.ts": "generated",
    "src/registry/handList.ts": "region",
    "src/app/route-map.jsonl": "generated",
    "vercel.json": "generated",
    "src/wiring/dbAgent.ts": "generated",
    "src/features/core/mail/constants/colors.ts": "generated",
    "src/features/core/user/entities/display.ts": "generated",
    // 指令 31 の意図した変化(Q1): ForkProviders は 1 行スイッチ(.replace を足せる)、生成器の雛形のページはルートでないので edit でない
    "src/app/_providers/ForkProviders.tsx": "edit",
    "src/app/_providers/ForkProviders.replace.tsx": "add",
    "src/app/admin/_template/__domains__/page.tsx": null,
  };
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map((path) => [path, kindOf(path)])), expected);
});
