// 実リポの受け口の一覧(src/lib/forkOwnership/intake.txt): 宣言と 1 行スイッチから作れる行は生成区画にだけあり、種類(edit / add)は
// 手書きだったときと同じ。手書きの区画の src の下に残るのは宣言から作れない行だけ
// 実行: pnpm test scripts/structure/extensions/intakeFromDeclarations.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { collectPoints } from "../../../src/lib/districtMap/declarations.mjs";
import { INTAKE_BLOCK_END, INTAKE_BLOCK_START, INTAKE_FILE, matchIntake, parseIntake } from "../../../src/lib/forkOwnership/intake.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { overrideGlobOf } from "./intake.mjs";
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
  const rows = switches.map((s) => `edit ${s.path}`);
  for (const point of collectPoints(repoRoot).points.filter((p) => p.spec.overrides !== undefined)) {
    rows.push(`edit ${overrideGlobOf(point.spec.overrides)}`);
    if (point.spec.addable) rows.push(`add ${point.spec.overrides}`);
  }
  return rows.sort();
}

test("宣言から作れる行は生成区画にだけある(種類つき): 1 行スイッチの素の名前 = edit、上書きの対象の .override = edit、足してよい対象 = add", () => {
  const derived = derivedRows();
  const block = new Set(rules.filter(inBlock).map(key));
  const hand = new Set(rules.filter((r) => !inBlock(r)).map(key));
  assert.deepEqual(derived.filter((row) => !block.has(row)), [], "生成区画に無い");
  assert.deepEqual(derived.filter((row) => hand.has(row)), [], "手書きの区画に残っている");
  assert.deepEqual(derived, [
    "add src/features/core/user/roles/*.role.json",
    "add src/features/core/userProfile/profiles/*.profile.json",
    "edit src/app/admin/_layout/AdminHeader.tsx",
    "edit src/app/api/cron/*/task.override.ts",
    "edit src/features/**/services/server/domainEntry.override.ts",
    "edit src/features/core/auth/components/Registration/RateLimitWarningContent.tsx",
    "edit src/features/core/auth/services/server/onDemoUserCreated.ts",
    "edit src/features/core/couponIssuerGrant/services/server/programConfig.ts",
    "edit src/features/core/purchaseRequest/services/server/payment/sessionEnricher.ts",
    "edit src/features/core/user/coreRoles/*.role.override.ts",
    "edit src/features/core/user/roles/*.role.override.ts",
    "edit src/features/core/userProfile/profiles/*.profile.override.ts",
    "edit src/features/core/wallet/services/server/notification/adjustmentNotificationTemplate.ts",
  ]);
});

test("手書きの区画の src の下に残るのは宣言から作れない行だけ(値・事業・CSS・favicon・page / 枠の layout・_components・ForkProviders・registry の region・CATALOG の append・生成物)", () => {
  const handSrc = rules.filter((r) => !inBlock(r) && r.glob.startsWith("src/")).map(key);
  assert.deepEqual(handSrc, [
    "edit src/config/**",
    "edit src/business/**",
    "edit src/styles/*.css",
    "edit src/app/favicon.ico",
    "edit src/app/**/page.tsx",
    "edit src/app/(user)/layout.tsx",
    "edit src/app/admin/layout.tsx",
    "edit src/app/(user)/(protected)/mypage/layout.tsx",
    "edit src/app/(marketing)/layout.tsx",
    "edit src/app/**/_components/**",
    "edit src/app/_providers/ForkProviders.tsx",
    "region src/registry/**/*.ts",
    "append src/lib/CATALOG.md",
    "generated src/registry/serviceRegistry.ts",
    "generated src/registry/storagePurposeRegistry.ts",
    "generated src/wiring/dbAgent.ts",
    "generated src/registry/schemaRegistry.ts",
    "generated src/registry/domainConfigRegistry.ts",
    "generated src/registry/adminDomains.ts",
    "generated src/registry/district-map.jsonl",
    "generated src/features/core/*/entities/display.ts",
    "generated src/app/route-map.jsonl",
    "generated src/features/core/mail/constants/colors.ts",
    "generated src/features/core/userProfile/entities/profiles/**",
    "generated src/**/extensions/**",
  ]);
});

test("効く種類(最後に当たった行)は生成区画へ移す前と同じ: 上書き・足す・スイッチのパスの見本", () => {
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
  };
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map((path) => [path, kindOf(path)])), expected);
});
