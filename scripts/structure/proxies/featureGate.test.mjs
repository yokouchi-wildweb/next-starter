// Feature Gate（ルートゲート + スキーマゲート）の規律テスト。
// 実行: pnpm test scripts/structure/proxies/featureGate.test.mjs (node:test + tsx。config / registry の .ts を読むため tsx ランナーを使う)
//
// 定義: src/featureGate/rules/<名前>.ts(一覧 src/featureGate/extensions/rules.ts、入口 @/featureGate/node)/ 設計: src/featureGate/README.md・src/proxies/README.md
//
// 検査の対象は「今 enabled: false のルール」だけ。有効な機能のルートは開いていて正しく、
// 機能を切ったときに初めて「テーブルが無いのに開いているルート」が問題になるため。
// upstream は全機能が有効なので、ゲート対象ドメインを触るときは FEATURE_GATE_CHECK=all で全ルールを無効とみなして検査する:
//   FEATURE_GATE_CHECK=all pnpm test scripts/structure/proxies/featureGate.test.mjs
//
// 守りたい契約:
// 1. features のフォルダから導いた表名(生成一覧の tables)は schemaRegistry に実在する
// 2. 無効なルールのドメイン（規則の features のフォルダ。表の数は問わない）を
//    import するルート（route.ts / page.tsx と、その _screen/ _components/ 配下）は、そのルールの pathPatterns で閉じている
//    （新しいルートを足して定義に書き忘れると失敗する）。意図的に閉じないルートは ROUTE_EXCEPTIONS に理由付きで書く（upstream 用）
// 3. 同じドメインの汎用 CRUD（/api/<domain>）も閉じている（汎用 CRUD が全操作 "none" の INTERNAL_ONLY の行は対象外）
//    (2・3 の判定は ./routeImports.mjs。features を持たない規則は対象外)
// 4. 現在のフラグの組み合わせでスキーマゲートが成立する（外すテーブルを残すテーブルが外部キーで参照しない）
//    外部キーに現れない機能間の前提（紹介 → クーポン）も満たす
// 5. スキーマゲートは enum を外さず、無効なテーブルだけを両側（imports / tablesFilter）から外す
// 7. 常時実行の入口(cron の task.ts・後片付けと照合の登録表・常に読み込まれる結線)が規則の features の機能のフォルダを
//    import するなら閉じられる(D17・D30・D20 K4。判定は ./alwaysOnEntries.mjs)。全規則を無効とみなして見る
// 6. 行き先(redirectTo)の違う規則の住所の重なり(L1.22): 上流の規則どうしは失敗、fork の規則と上流の重なりは表示だけ
//    (判定はファイル名の順で最初の無効な規則の行き先)。一覧は規則ファイルと同じ並び
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve, sep } from "node:path";

import { getTableName, is } from "drizzle-orm";
import { isPgEnum, PgTable } from "drizzle-orm/pg-core";

import { serviceRegistry } from "../../../src/registry/serviceRegistry.ts";
import { isGenericApiClosed } from "../../../src/lib/domain/definition/apiAccess.ts";
import { APP_FEATURES } from "../../../src/config/app/app-features.config.ts";
// 規則の値だけの一覧(全開スイッチを通さない。検査は env で揺れない、L2.3)
import { alwaysOnExceptions, alwaysOnRegistries, configRules as featureGateRules, gatedSchema as applySchemaGate } from "../../../src/featureGate/node.ts";
import { forkAddedFiles } from "../../../src/lib/forkOwnership/check.mjs";
import { itemsOf, planExtensions } from "../extensions/extensions.mjs";
import { ALWAYS_ON_DIR, judgeAlwaysOnEntries, readForkAlwaysOn, staleAlwaysOnFiles } from "../../../src/featureGate/checks/alwaysOnEntries.mjs";
import { findOpenGenericApis, findOpenRouteImports, rulesWithFeatures } from "../../../src/featureGate/checks/routeImports.mjs";
import { matchesPath, patternCoversRoute } from "../../../src/lib/pathPattern/index.mjs";

// schemaRegistry は `export *` の再 export だけで構成されるため、ESM の namespace import では
// 名前を拾えない（CJS として読まれ default しか見えない）。db:push と同じく require で全 export を得る
const schema = createRequire(import.meta.url)("../../../src/registry/schemaRegistry.ts");

const ROOT = resolve(import.meta.dirname, "../../..");
const APP_DIR = join(ROOT, "src/app");

// 対象ドメインを import するが、意図的にゲートで閉じないルート（src/app 相対 → 理由）。upstream のルート用
const ROUTE_EXCEPTIONS = {
  "api/auth/register/route.ts": "本登録(紹介・流入経路が閉でも登録は動く)。読むのは referral の lib/inviteLinkCookie の cookie 名と userAcquisition の constants・lib/attributionCookie(cookie の読み取りだけ)で、招待コードは gate.enabled(\"referral\")、流入経路は gate.enabled(\"userAcquisition\") が開のときだけ読む",
  "api/auth/send-early-registration-link/route.ts": "事前登録のメール(紹介が閉でも動く)。読むのは referral の lib/inviteLinkCookie の cookie 名だけで、招待コードは gate.enabled(\"referral\") が開のときだけ渡す",
  "api/auth/send-email-link/route.ts": "サインインのメール(紹介が閉でも動く)。読むのは referral の lib/inviteLinkCookie の cookie 名だけで、招待コードは gate.enabled(\"referral\") が開のときだけ渡す",
  "(user)/_layout/UserLayout.tsx": "利用者の枠(常に描く)。既定の未読のお知らせのモーダルは useGate().enabled(\"notification\") が開のときだけ描く(閉なら描かず未読数も取りに行かない)",
};

// FEATURE_GATE_CHECK=all: 全ルールを無効とみなして検査する（upstream 用）
const CHECK_ALL = process.env.FEATURE_GATE_CHECK === "all";
const CHECK_ALL_ONLY = "FEATURE_GATE_CHECK=all のときだけ実行（upstream 用）";

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

// テーブル名 → それを定義するドメイン名（src/features/<domain> または src/features/core/<domain>）
// src/app 配下のファイルパス → それが属するルートの URL セグメント
// （ルートグループは除き、private フォルダ（_screen / _components 等）以降は切り捨て、動的セグメントは "[x]" のまま）
const toUrlSegments = (file) => {
  const dirs = relative(APP_DIR, file).split(sep).slice(0, -1);
  const privateIndex = dirs.findIndex((seg) => seg.startsWith("_"));
  return (privateIndex === -1 ? dirs : dirs.slice(0, privateIndex)).filter(
    (seg) => !(seg.startsWith("(") && seg.endsWith(")")),
  );
};

// パターンがルートを覆うか(完全一致の `=` も含む)は門番と同じ src/lib/pathPattern

// 表の実在を見る検査だけが使う(閉じるドメインは表ではなく features のフォルダから導く)
const rulesWithTables = featureGateRules.filter((rule) => (rule.tables ?? []).length > 0);
// ルートの被覆を検査するルール（features を持ち、無効なもの。CHECK_ALL なら全部）
const checkedRules = rulesWithFeatures(featureGateRules).filter((rule) => CHECK_ALL || !rule.enabled());
const schemaTableNames = new Set(
  Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table)),
);

test("パターン: 前方一致はセグメント境界、= は完全一致(fork が下に足したページを巻き込まない)", () => {
  assert.equal(matchesPath("/demo/x", "/demo"), true);
  assert.equal(matchesPath("/demo-login", "/demo"), false);
  assert.equal(matchesPath("/demo", "/demo/"), true);
  assert.equal(matchesPath("/mypage", "=/mypage"), true);
  assert.equal(matchesPath("/mypage/mine", "=/mypage"), false);
  assert.equal(patternCoversRoute("=/mypage/account", ["mypage", "account"]), true);
  assert.equal(patternCoversRoute("=/mypage/account", ["mypage", "account", "mine"]), false);
  assert.equal(patternCoversRoute("/wallet", ["wallet", "[slug]"]), true);
});

test("upstream の画面を止めるスイッチ: 各規則のパターンが実在のページに当たる(書き違い・ページの移動の検出)", () => {
  const pages = walk(APP_DIR)
    .filter((f) => /[\\/]page\.tsx$/.test(f))
    .map((f) => toUrlSegments(f));
  const switchRules = featureGateRules.filter((rule) => rule.pathPatterns.some((pattern) => pattern.startsWith("=")));
  const stale = switchRules
    .flatMap((rule) => rule.pathPatterns)
    .filter((pattern) => !pattern.startsWith("/api/") && !pages.some((segments) => patternCoversRoute(pattern, segments)));
  assert.deepEqual(stale, [], `ページの無いパターン: ${stale.join(", ")}`);
});

test("features から導いた表名は schemaRegistry に実在する(導出は pnpm generate extensions、走査の一致は pnpm test scripts/structure/registry/)", () => {
  const unknown = rulesWithTables.flatMap((rule) => rule.tables.filter((name) => !schemaTableNames.has(name)));
  assert.deepEqual(unknown, [], `schemaRegistry に無いテーブル名: ${unknown.join(", ")}`);
});

test("無効な機能のドメインを import するルートは、そのドメインのルールで閉じている", () => {
  // route.ts / page.tsx だけでなく、そのルートの Screen / loader / 部品（_screen/ _components/）も見る
  const routeFiles = walk(APP_DIR)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ rel: relative(APP_DIR, f).split(sep).join("/"), segments: toUrlSegments(f), text: readFileSync(f, "utf8") }));
  const problems = findOpenRouteImports(checkedRules, routeFiles, ROUTE_EXCEPTIONS);
  assert.deepEqual(problems, [], `pathPatterns に追加するか ROUTE_EXCEPTIONS に理由付きで書く:\n${problems.join("\n")}`);
});

test("無効な機能のドメインの汎用 CRUD（/api/<domain>）は閉じている", () => {
  // 汎用 CRUD が全操作 "none"（INTERNAL_ONLY）の行は /api/<domain> が存在しない（404）ので対象外
  const problems = findOpenGenericApis(checkedRules, (domain) => domain in serviceRegistry && !isGenericApiClosed(serviceRegistry[domain].access));
  assert.deepEqual(problems, [], `pathPatterns に追加する: ${problems.join(", ")}`);
});

test("ROUTE_EXCEPTIONS の各行は実在するルート", () => {
  const missing = Object.keys(ROUTE_EXCEPTIONS).filter((rel) => {
    try {
      readFileSync(join(APP_DIR, rel));
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(missing, [], `存在しないルートの例外行: ${missing.join(", ")}`);
});

test("現在のフラグの組み合わせでスキーマゲートが成立する", () => {
  assert.doesNotThrow(() => applySchemaGate(schema, featureGateRules));
});

test("紹介機能はクーポン機能を前提にする（招待コードの実体はクーポン）", () => {
  assert.ok(
    !APP_FEATURES.marketing.referral.enabled || APP_FEATURES.marketing.coupon.enabled,
    "marketing.referral.enabled=true のときは marketing.coupon.enabled も true にする",
  );
});

test("全機能を無効にしてもスキーマゲートが成立する（外部キーが無効な機能の外へ出ていない）", { skip: !CHECK_ALL && CHECK_ALL_ONLY }, () => {
  const allDisabled = featureGateRules.map((rule) => ({ ...rule, enabled: () => false }));
  assert.doesNotThrow(() => applySchemaGate(schema, allDisabled));
});

test("スキーマゲートは無効なテーブルを両側から外し、enum は残す", { skip: !CHECK_ALL && CHECK_ALL_ONLY }, () => {
  const rules = featureGateRules.map((rule) => ({ ...rule, enabled: () => false }));
  const gate = applySchemaGate(schema, rules);
  const gatedNames = rules.flatMap((rule) => rule.tables ?? []);

  const keptTables = Object.values(gate.imports)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table));
  assert.deepEqual(keptTables.filter((name) => gatedNames.includes(name)), []);
  assert.deepEqual([...gate.tablesFilter].sort(), gatedNames.map((name) => `!${name}`).sort());

  const enumCount = (exports) => Object.values(exports).filter((value) => isPgEnum(value)).length;
  assert.equal(enumCount(gate.imports), enumCount(schema));
});

test("全機能が有効ならスキーマゲートは何も外さない", () => {
  const rules = featureGateRules.map((rule) => ({ ...rule, enabled: () => true }));
  const gate = applySchemaGate(schema, rules);
  assert.equal(gate.tablesFilter, undefined);
  assert.equal(Object.keys(gate.imports).length, Object.keys(schema).length);
});

test("payment だけ有効で wallet が無効な組み合わせは外部キーで拒否される", () => {
  const rules = featureGateRules.map((rule) => ({
    ...rule,
    enabled: () => !(rule.tables ?? []).includes("wallets"),
  }));
  assert.throws(() => applySchemaGate(schema, rules), /purchase_requests → wallet_histories/);
});

// 住所の重なり: どちらかの住所(= を外した形)が相手のパターンに当たれば重なる
const patternPath = (pattern) => (pattern.startsWith("=") ? pattern.slice(1) : pattern);
const overlaps = (a, b) => matchesPath(patternPath(a), b) || matchesPath(patternPath(b), a);

// 規則ファイルの走査(生成器と同じ。ファイル名の順)
const gateRuleFiles = () => {
  const plan = planExtensions(ROOT);
  return { rules: itemsOf(plan, "src/featureGate", "rules"), problems: plan.problems };
};

test("一覧は規則ファイルと同じ並び・同じ数(pnpm generate extensions のずれは pnpm check extensions でも止まる)", () => {
  const { rules, problems } = gateRuleFiles();
  assert.deepEqual(problems, []);
  assert.equal(rules.length, featureGateRules.length);
  for (const rule of featureGateRules) assert.equal(typeof rule.enabled, "function");
});

// fork の規則か = fork が足したファイルか(git の分岐点。名前では見ない、D137)。Tier1 は git に触れず全部が上流の規則。
// 基準が求められない fork(親の remote が無い・shallow)では skip(合格にしない)
const forkAdded = forkAddedFiles(ROOT, { fetch: false });

test(
  "行き先の違う規則の住所の重なり(L1.22): 上流どうしは不可、fork と上流は表示だけ",
  { skip: forkAdded.status === "unverified" ? `fork の規則を見分けられない(${forkAdded.reason})` : false },
  () => {
    const { rules: files } = gateRuleFiles();
    const entries = featureGateRules.map((rule, i) => ({ rule, file: files[i].path.split("/").pop(), fork: forkAdded.added.has(files[i].path) }));
    const upstreamConflicts = [];
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        if ((a.rule.redirectTo ?? null) === (b.rule.redirectTo ?? null)) continue;
        const hit = a.rule.pathPatterns.flatMap((p) => b.rule.pathPatterns.filter((q) => overlaps(p, q)).map((q) => `${p} × ${q}`));
        if (hit.length === 0) continue;
        const line = `${a.file}(${a.rule.redirectTo ?? "404"})と ${b.file}(${b.rule.redirectTo ?? "404"}): ${hit.join(", ")}`;
        if (a.fork || b.fork) console.log(`[feature-gate] 行き先の違う重なり(fork、先の規則が優先): ${line}`);
        else upstreamConflicts.push(line);
      }
    }
    assert.deepEqual(upstreamConflicts, [], `上流の規則どうしで行き先の違う重なり:\n${upstreamConflicts.join("\n")}`);
  },
);

// 汎用 API の住所(/api/<domain>)は生成器が features のフォルダの domainEntry.ts から導いて pathPatterns に足す(domainApiPaths)。
// 設定の節の住所(/admin/settings/<key>)も節の feature から導く(settingPaths、L1.17)。cron の task の住所は task の import から導く(cronPaths、目録 D10)。
// 規則に同じ住所を手書きすると重なる: 上流の規則は不可、fork の規則は表示だけ
test(
  "汎用 API・設定の節・cron の住所は規則に手書きしない(生成器が domainApiPaths・settingPaths・cronPaths として pathPatterns に足す)",
  { skip: forkAdded.status === "unverified" ? `fork の規則を見分けられない(${forkAdded.reason})` : false },
  () => {
    const { rules: files } = gateRuleFiles();
    const upstream = [];
    featureGateRules.forEach((rule, i) => {
      const derived = [...rule.domainApiPaths, ...rule.settingPaths, ...rule.cronPaths];
      const handWritten = rule.pathPatterns.slice(0, rule.pathPatterns.length - derived.length);
      const dup = handWritten.filter((pattern) => derived.includes(pattern));
      if (dup.length === 0) return;
      const line = `${files[i].path}: ${dup.join(", ")}`;
      if (forkAdded.added.has(files[i].path)) console.log(`[feature-gate] 生成器が導く住所を手書きしている(fork、消してよい): ${line}`);
      else upstream.push(line);
    });
    assert.deepEqual(upstream, [], `汎用 API・設定の節・cron の住所は生成器が導く。規則から消す:\n${upstream.join("\n")}`);
  },
);

test("上流の規則の汎用 API の住所(導出の固定。domainEntry のキー・規則の features が変わったら見直す)", { skip: forkAdded.status !== "tier1" ? "Tier1 だけ(fork は自分の規則が足される)" : false }, () => {
  const derived = Object.fromEntries(featureGateRules.filter((rule) => rule.domainApiPaths.length > 0).map((rule) => [rule.name, rule.domainApiPaths]));
  assert.deepEqual(derived, {
    chatRoom: ["/api/chatRoom"],
    coupon: ["/api/coupon", "/api/couponHistory", "/api/couponAttributionReward", "/api/couponIssuerGrant"],
    deviceFingerprint: ["/api/deviceFingerprint"],
    fingerprintChallenge: ["/api/fingerprintChallenge"],
    interactionTracking: ["/api/interactionEvent"],
    milestone: ["/api/milestone"],
    notification: ["/api/notification"],
    notificationTemplate: ["/api/notificationTemplate"],
    pairedDevice: ["/api/pairedDevice"],
    payment: ["/api/purchaseRequest", "/api/bankTransferReview"],
    referral: ["/api/referral", "/api/referralReward"],
    sampleDomain: ["/api/sample", "/api/sampleCategory", "/api/sampleTag", "/api/sampleImage"],
    userCounter: ["/api/userCounter"],
    userLineProfile: ["/api/userLineProfile"],
    userXProfile: ["/api/userXProfile"],
    wallet: ["/api/wallet", "/api/walletHistory"],
  });
  // 上流の設定の節は feature を持たない
  assert.deepEqual(featureGateRules.filter((rule) => rule.settingPaths.length > 0).map((rule) => rule.name), []);
});

// 常時実行の入口の閉じ漏れ(D17・D30・D20 K4)
// 後片付け・照合など常に読まれる項目は、宣言の alwaysOn: true の点(項目ごとに enabled で閉じる)。手書きの登録表は fork の口だけ
// 常に読み込まれる結線のうち、規則の features の機能のフォルダを import してよいもの(path → 理由)。縮む表。
// fork の分は src/featureGate/alwaysOnExceptions/<名前>.ts に 1 項目 1 ファイルで理由つきで(L1.24。ここは編集しない)
const ALWAYS_ON_EXCEPTIONS = {
  "src/wiring/apiRoute.ts":
    "pairedDevice の apiRouteDeviceDeps を Factory に結ぶだけ。端末の解決(表の読み取り)は createDeviceRoute の route が呼ばれたときだけ走り、その route は pairedDevice の規則で閉じる",
  "src/proxies/attribution.ts":
    "proxy の項目。読むのは userAcquisition の constants と lib/attributionCookie・lib/classifyVisit(edge で動く cookie の読み書きと訪問の分類だけ、表に届かない)。処理は先頭の gate.enabled(\"userAcquisition\") で閉じる",
  "src/wiring/GoogleTag.tsx":
    "root layout が描く GoogleTag に判別表を結ぶだけ。読むのは userAcquisition の lib/classifyVisit(config と受け口の項目から表を作る値だけ、表に届かない)。gate.enabled(\"userAcquisition\") が閉なら空の表を渡す",
  "src/proxies/inviteLink.ts":
    "proxy の項目。読むのは referral の lib/inviteLinkCookie(edge で動く cookie 名と URL の読み取りだけ、表に届かない)。処理は先頭の gate.enabled(\"referral\") で閉じる",
};

test("常時実行の入口: 規則の features の機能を import するなら閉じられる(cron は住所が規則の pathPatterns に入る、alwaysOn の点の項目は enabled、手書きの登録表は条件つき spread、結線は例外表)", async () => {
  const oldDir = join(ROOT, "scripts/proxies", ALWAYS_ON_DIR);
  const stale = staleAlwaysOnFiles(
    existsSync(join(ROOT, "scripts/proxies")) ? readdirSync(join(ROOT, "scripts/proxies")) : [],
    existsSync(oldDir) ? readdirSync(oldDir) : [],
  );
  assert.deepEqual(stale, [], stale.join("\n"));
  const fork = readForkAlwaysOn({ exceptions: alwaysOnExceptions, registries: alwaysOnRegistries });
  assert.deepEqual(fork.problems, [], fork.problems.join("\n"));
  const rel = (abs) => relative(ROOT, abs).split(sep).join("/");
  const code = (f) => /\.(ts|tsx|mts|mjs)$/.test(f) && !/\.test\./.test(f);
  const plan = planExtensions(ROOT);
  const alwaysOnItems = plan.points.filter((p) => p.spec.alwaysOn).flatMap((p) => plan.itemsByPoint.get(p).map((item) => item.itemFile));
  assert.ok(alwaysOnItems.length > 0, "alwaysOn の点の項目が無い(宣言の読み取りを確認)");
  const entries = [
    ...walk(join(APP_DIR, "api/cron")).filter((f) => /[\\/]task\.ts$/.test(f)).map((f) => ({ path: rel(f), kind: "cronTask" })),
    ...alwaysOnItems.map((path) => ({ path, kind: "alwaysOnItem" })),
    ...fork.registries.map((path) => ({ path, kind: "registry" })),
    ...[join(APP_DIR, "layout.tsx"), ...walk(join(ROOT, "src/wiring")), ...walk(join(ROOT, "src/proxies")), ...walk(join(ROOT, "src/featureGate"))]
      .filter(code)
      .map((f) => ({ path: rel(f), kind: "wiring" })),
  ].map((entry) => ({ ...entry, text: readFileSync(join(ROOT, entry.path), "utf8") }));
  assert.ok(featureGateRules.some((rule) => (rule.features ?? []).length > 0), "features を持つ規則が無い(features の読み取りを確認)");
  const { problems, hits } = judgeAlwaysOnEntries(entries, featureGateRules, { ...ALWAYS_ON_EXCEPTIONS, ...fork.exceptions });
  assert.deepEqual(problems, [], `常時実行の入口の閉じ漏れ:\n${problems.join("\n")}\n該当: ${hits.join(" / ")}`);
});

// 表を持たないドメイン(Firestore 版の core/chatRoom など)の規則も、表のある規則と同じに見る(fixture。閉じるドメインは features のフォルダ)
test("fixture: 表 0 のドメインの規則も、ルート・汎用 CRUD・常時実行の入口の検査に掛かる。features の無い規則は対象外", () => {
  const chat = { name: "chatRoom", features: ["core/chatRoom"], tables: [], pathPatterns: ["/chat", "/api/chatRoom", "/api/cron/chat-sweep"] };
  const plain = { name: "plain", pathPatterns: ["/plain"] };
  const IMPORT_CHAT = 'import { useChat } from "@/features/chatRoom/hooks/useChat";\nexport const x = useChat;\n';
  const routeFiles = [
    { rel: "(user)/mypage/_screen/MypageScreen.tsx", segments: ["mypage"], text: IMPORT_CHAT },
    { rel: "(user)/chat/[id]/page.tsx", segments: ["chat", "[id]"], text: IMPORT_CHAT },
    { rel: "(user)/plain/page.tsx", segments: ["plain"], text: 'import { x } from "@/features/core/wallet/hooks/x";\n' },
  ];
  assert.deepEqual(
    findOpenRouteImports([chat, plain], routeFiles, {}).map((p) => p.split("（")[0]),
    ["(user)/mypage/_screen/MypageScreen.tsx"],
  );
  assert.deepEqual(findOpenRouteImports([chat], routeFiles, { "(user)/mypage/_screen/MypageScreen.tsx": "理由" }), []);

  const hasOpen = (domain) => domain === "chatRoom";
  assert.deepEqual(findOpenGenericApis([chat, plain], hasOpen), []);
  assert.deepEqual(findOpenGenericApis([{ ...chat, pathPatterns: ["/chat"] }], hasOpen), ["/api/chatRoom"]);

  const task = (pathPatterns) =>
    judgeAlwaysOnEntries(
      [{ path: "src/app/api/cron/chat-sweep/task.ts", kind: "cronTask", text: 'import { sweep } from "@/features/core/chatRoom/services/server/sweep";\nexport const run = sweep;\n' }],
      [{ ...chat, pathPatterns }],
      {},
    ).problems;
  assert.deepEqual(task(chat.pathPatterns), []);
  assert.equal(task(["/chat"]).length, 1);
});
