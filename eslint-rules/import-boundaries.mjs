// eslint-rules/import-boundaries.mjs
//
// 層の境目の import を、書き方(エイリアス・相対・"src/…"・サブパス・dynamic import・require)によらず実パスで検査する
// ローカル ESLint プラグイン。解決は resolve-import.mjs。強さ: 全 Tier error(所有で変えない。eslint.config.mjs)。
//
// ── route-factory-via-wiring(D5 K1) ──
// @/lib/routeFactory(src/lib/routeFactory/** のどのファイルも)を値 import できるのは src/wiring/**(fork が足した
// wiring を含む)と src/lib/routeFactory 自身だけ。型だけの import は誰でも可。
// 理由: 汎用版の Factory は主体の解き方・access の評価・登録表を差し込んで初めて使える。route は wiring の設定済み版
// (@/wiring/apiRoute)を使い、差し込み忘れ・別の束での組み立てを構造で防ぐ。createCrudService・lib/cron は対象外(D5 K2)。
//
// ── cron-route-via-wiring(D19、route-factory-via-wiring と同じ形) ──
// @/lib/cron の作り手 createCronTaskRoute / createCronRoute を値 import できるのは src/wiring/** と src/lib/cron 自身だけ。
// 型・他の名前(runBudgetedBatches・型 CronTaskDefinition など)とテスト(*.test.*、作り手の単体テスト)は誰でも可。名前を問わない形(namespace・動的 import・
// export *)は作り手を含みうるので止める。理由: cron の route は wiring の設定済み版(@/wiring/cronRoute)が門番の判定を結ぶ。
// 汎用版を直に使うと閉じた機能のタスクが route で飛ばない。
//
// ── lib-no-registry(D23 K3) ──
// src/lib/** から src/registry/** を import しない(値も型も)。lib の関数は登録表を引数・注入で受け、結ぶのは src/wiring/**。
// 一覧の行(file + target)に当たる import は通す。一覧の行のファイルにその import が無くなったら、行を消すよう error。
//
// ── lib-no-features(親 D8) ──
// src/lib/** から src/features/** を import しない(値も型も、例外の一覧なし)。型は lib が持つか型引数で受け、
// 値は注入で受ける。渡し方の既定 = 組み立て側 1 モジュールが import 時に作る設定済みの版(src/wiring/**)。
//
// ── page-guard-via-wiring(L1.18、D5 K1 と同じ形) ──
// @/lib/pageGuard(src/lib/pageGuard/** のどのファイルも)を値 import できるのは src/wiring/** と src/lib/pageGuard 自身だけ。
// 型だけの import は誰でも可(auth の束 pageGuardUserDeps は型だけ)。guard.ts は root を @/wiring/pageGuard から、子を親の extend で作る。
//
// ── features-index-no-server-reexport(D73 K5) ──
// src/features/**/index.ts(services/server の外の barrel)は services/server を値で再 export しない(export … from / export * from)。
// 型だけの再 export は可。理由: UI が barrel 経由でサーバーのサービスを値 import すると、UI の場所の検査(page-authz M4)を
// 迂回できる(barrel のパスに services/server が出ない)。サーバーの値は services/server のパスから直接 import する。
//
// ── client-no-domain-json(D39) ──
// client のコードは domain.json を import しない(値も型も。import() と export … from も)。読むのは写し entities/display.ts。
// client のコード = "use client" のファイル、または src の components/・hooks/・_components/ の下のファイル。
// _components/ の下で "use client" の無い *Screen.tsx と loader.ts は server の差し替えなので対象外。テストも対象外。
// 判定は isClientCodeFile に 1 つ(置き換えスクリプト .notices/20261101-121000-domain-display-client.domain-json-client-display.mjs も同じものを使う)。
//
// ── feature-gate-entries(D7、L1.3) ──
// 門番 src/featureGate/ の外からは入口 3 つ(index.ts = @/featureGate・client.ts・node.ts)だけを読む(値も型も)。
// - lib(src/lib/**)は門番を読まない(入口も。値も型も)。lib の関数は規則や判定を引数で受ける(例 routeMap の gateRules)
// - node.ts(規則の一覧・gatedSchema・closedTables)は scripts/** とテストだけ。アプリ・proxy は index.ts / client.ts
// - テスト(*.test.*)はこの規則の対象外(中の部品を確かめるのが役。lib-no-features がテストを外すのと同じ)
// - 配線用の 2 名(L1.7: index.ts の clientGateState・client.ts の GateProvider)は root layout・AppProviders・admin の守りの layout 2 つだけ
//   (名前で読む import / re-export を見る。namespace import・dynamic import は名前が分からないので見ない)
// 門番の中どうし(生成一覧 → 規則、道具 → evaluate、規則 → @/featureGate の型)は自由。到達の検査は src/featureGate/checks/reachability.test.mjs

// ── src-no-scripts(D78) ──
// src/**(テストを含む)から scripts/** を import しない(値も型も、import()・require も)。道具とアプリが両方使う物は lib に置く
// (例 src/lib/cron/discover.ts・src/lib/task)。道具の側のテストは scripts の側に置く(scripts → src は可)。
//
// ── src-no-district-map(目録 D12) ──
// src/**(テストを含む)から地区の地図の集約ファイル src/registry/district-map.jsonl を import しない(どの形も)。
// あれは人・agent・/ship と /flux の差分のための写し。道具・lint・生成は毎回読み手 src/lib/districtMap を呼ぶ(他の生成の入力にもしない)。
//
// ── scripts-no-static-wiring(D79) ──
// 道具(scripts/**・src/features/**/scripts/**・.notices/<id>.<名前>.mjs の codemod)は src/wiring/** を静的に import しない
// (import / export … from、値も型も)。run の中の動的 import()・require は可(読み込みのたびに結線の束を立ち上げないため。
// 道具の一覧・検査は結線を読まずに動く)。
//
// ── tools-no-db-write(D75・D90) ──
// DB を直接書く部品(@/lib/drizzle の db、表の定義 **/entities/drizzle、drizzle-orm の生 SQL sql・接続のドライバ、postgres 等)を
// import しない(どの形も): src/features/**/scripts/tasks/**・scripts/operations/**(scripts/operations/db/** を除く)・
// src/features/**/seed.ts・scripts/workflow/dev-admin/**(DB に書く開発の道具)。書くのはドメインのサービスを通す。移行 src/features/**/scripts/migrations/**(.local.ts を含む)は例外(直接の SQL・db を許す)。

// 限界: 直接の import だけを見る(値を変数に入れて別ファイルへ渡す形は追わない)。
//
// ── seed-reader(D52) ──
// ドメインのシード src/features/**/seed.ts(データだけ)を読むのはシードのランナー scripts/runner/seed/** だけ(静的・動的とも)。
// アプリ・ほかの道具はシードを読まない(デモのデータが本番の経路に混ざらないため)。

// ── link-via-shelf(D14、L1.9) ──
// next/link を直接 import しない。リンクは棚の Link(src/components/Navigation/Link、閉じた機能の住所を自動で隠す)を使う。
// - 既定(上流 = Tier1): 棚の Link の外の next/link の値の import を全部報告する
// - option closableOnly(fork): 門番の規則の住所(src/featureGate/rules/*.ts の pathPatterns の文字列リテラル)に当たる
//   住所の字面('/' で始まる文字列・テンプレートの頭)を持つファイルの import だけを報告する
// 限界(closableOnly): 字面だけを見る。式で作る href・計算で作る規則の住所(payment の通貨 slug など)・別ファイルから渡る住所は見えない

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { matchesPath } from "../src/lib/pathPattern/index.mjs";
import { isUnder, moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const ROUTE_FACTORY = "src/lib/routeFactory";
const PAGE_GUARD = "src/lib/pageGuard";
const CRON_LIB = "src/lib/cron";
const CRON_FACTORY_NAMES = ["createCronTaskRoute", "createCronRoute"];
const SERVER_SERVICE_DIR = /(^|\/)services\/server(\/|$)/;
const WIRING = "src/wiring";
const LIB = "src/lib";
const REGISTRY = "src/registry";
const FEATURES = "src/features";
const FEATURE_GATE = "src/featureGate";
const FEATURE_GATE_ENTRIES = ["src/featureGate", "src/featureGate/index", "src/featureGate/client", "src/featureGate/node"];
/** 配線用の名前(L1.7)と、それを読んでよいファイル */
const FEATURE_GATE_WIRING_NAMES = ["clientGateState", "GateProvider"];
const FEATURE_GATE_WIRING_FILES = [
  "src/app/layout.tsx",
  "src/wiring/AppProviders.tsx",
  "src/app/admin/(protected)/layout.tsx",
];

/** 違反の判定(テストから直接呼ぶ)。違反なら messageId、無ければ null */
export function classifyRouteFactoryImport(importerRel, resolved, typeOnly) {
  if (typeOnly) return null;
  if (!isUnder(resolved, ROUTE_FACTORY)) return null;
  if (isUnder(importerRel, WIRING) || isUnder(importerRel, ROUTE_FACTORY)) return null;
  return "routeFactory";
}

export function classifyPageGuardImport(importerRel, resolved, typeOnly) {
  if (typeOnly) return null;
  if (!isUnder(resolved, PAGE_GUARD)) return null;
  if (isUnder(importerRel, WIRING) || isUnder(importerRel, PAGE_GUARD)) return null;
  return "pageGuard";
}

/**
 * cron の作り手の値 import か。違反なら作り手の名前(名前を問わない形は "*")、無ければ null
 * @param {{ name: string, typeOnly: boolean }[] | null} specifiers null = 名前を問わない形(namespace・動的 import・export *)
 */
export function classifyCronFactoryImport(importerRel, resolved, typeOnly, specifiers) {
  if (typeOnly || !isUnder(resolved, CRON_LIB)) return null;
  if (isUnder(importerRel, WIRING) || isUnder(importerRel, CRON_LIB) || TEST_FILE.test(importerRel)) return null;
  if (!Array.isArray(specifiers)) return "*";
  const hit = specifiers.find((s) => !s.typeOnly && CRON_FACTORY_NAMES.includes(s.name));
  return hit ? hit.name : null;
}

/** features の barrel(services/server の外の index.ts)が services/server を値で再 export するか */
export function classifyFeaturesIndexReexport(importerRel, resolved, typeOnly, isReexport) {
  if (!isReexport || typeOnly || !resolved) return null;
  if (!/^src\/features\/.+\/index\.(ts|tsx)$/.test(importerRel) || SERVER_SERVICE_DIR.test(importerRel)) return null;
  return SERVER_SERVICE_DIR.test(resolved) ? "serverReexport" : null;
}

export function classifyLibRegistryImport(importerRel, resolved) {
  return isUnder(importerRel, LIB) && isUnder(resolved, REGISTRY) ? "libRegistry" : null;
}

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** 門番の外から門番を読む import の判定(値も型も)。違反なら messageId、無ければ null */
export function classifyFeatureGateImport(importerRel, resolved) {
  if (!isUnder(resolved, FEATURE_GATE) || isUnder(importerRel, FEATURE_GATE) || TEST_FILE.test(importerRel)) return null;
  if (isUnder(importerRel, LIB)) return "gateFromLib";
  const bare = resolved.replace(/\.(ts|tsx|mts|mjs|js)$/, "");
  if (!FEATURE_GATE_ENTRIES.includes(bare)) return "gateInternal";
  if (bare === "src/featureGate/node" && !isUnder(importerRel, "scripts")) return "gateNode";
  return null;
}
/** 配線用の名前を配線の 4 ファイルの外で読むか。読むならその名前、無ければ null(テストは対象外) */
export function featureGateWiringNameOutside(importerRel, resolved, specifiers) {
  if (!resolved || !Array.isArray(specifiers) || TEST_FILE.test(importerRel)) return null;
  if (!isUnder(resolved, FEATURE_GATE) || isUnder(importerRel, FEATURE_GATE)) return null;
  if (FEATURE_GATE_WIRING_FILES.includes(importerRel)) return null;
  const hit = specifiers.find((s) => !s.typeOnly && FEATURE_GATE_WIRING_NAMES.includes(s.name));
  return hit ? hit.name : null;
}
const SHELF_LINK = "src/components/Navigation/Link/index.tsx";
/** 守りの lib(next/navigation の useRouter を読んでよい唯一の置き場) */
const UNSAVED_GUARD_LIB = "src/lib/unsavedGuard";
const GATE_RULES_DIR = "src/featureGate/rules";

const closablePatternCache = new Map();

/** 門番の規則の住所のパターン(pathPatterns の中の文字列リテラル、/api の下は除く)。字面で読む */
export function readClosablePatterns(repoRoot) {
  if (closablePatternCache.has(repoRoot)) return closablePatternCache.get(repoRoot);
  const patterns = [];
  let files = [];
  try {
    files = readdirSync(join(repoRoot, GATE_RULES_DIR)).filter((f) => /\.(ts|tsx)$/.test(f));
  } catch {
    files = [];
  }
  for (const file of files) {
    const text = readFileSync(join(repoRoot, GATE_RULES_DIR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const block = /pathPatterns\s*:\s*\[([\s\S]*?)\]/.exec(text);
    if (!block) continue;
    for (const m of block[1].matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const pattern = m[1] ?? m[2];
      if (pattern.startsWith("/") || pattern.startsWith("=/")) {
        if (!matchesPath(pattern.replace(/^=/, ""), "/api")) patterns.push(pattern);
      }
    }
  }
  closablePatternCache.set(repoRoot, patterns);
  return patterns;
}

/** 住所の字面が閉じられる住所に当たるか。当たればそのパターン、無ければ null */
export function closablePatternOf(text, patterns) {
  if (!text.startsWith("/") || text.startsWith("//")) return null;
  const end = text.search(/[?#]/);
  const pathname = end === -1 ? text : text.slice(0, end);
  if (pathname === "") return null;
  return patterns.find((pattern) => matchesPath(pathname, pattern)) ?? null;
}

const COMMENTS_AT_TOP = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;

/** ファイルの先頭(コメントの後)に "use client" があるか */
export function hasUseClientDirective(text) {
  return /^["']use client["']/.test(text.replace(COMMENTS_AT_TOP, ""));
}

/** client のコードか(lint 規則と置き換えスクリプトの共通の判定) */
export function isClientCodeFile(importerRel, text) {
  if (!importerRel.startsWith("src/") || TEST_FILE.test(importerRel)) return false;
  if (hasUseClientDirective(text)) return true;
  const dirs = importerRel.split("/").slice(0, -1);
  if (dirs.includes("components") || dirs.includes("hooks")) return true;
  if (!dirs.includes("_components")) return false;
  return !/(^|\/)(?:[^/]*Screen\.tsx|loader\.ts)$/.test(importerRel);
}

export const isDomainJsonPath = (resolved) => Boolean(resolved) && /(^|\/)domain\.json$/.test(resolved);

const repoRootOf = (context) => context.cwd ?? context.getCwd?.() ?? process.cwd();

const routeFactoryViaWiring = {
  meta: {
    type: "problem",
    docs: { description: "lib/routeFactory を値 import できるのは src/wiring/** だけ(route は @/wiring/apiRoute から)" },
    messages: {
      routeFactory:
        '"{{source}}" は汎用版の Factory(src/lib/routeFactory)です。値 import できるのは src/wiring/** だけ。route とその補助ファイルは @/wiring/apiRoute の設定済み版を使う(型だけの import は可。詳細: src/lib/routeFactory/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source, typeOnly }) => {
      const resolved = resolveImport(source, context.filename, repoRoot);
      if (classifyRouteFactoryImport(importerRel, resolved, typeOnly)) {
        context.report({ node, messageId: "routeFactory", data: { source } });
      }
    });
  },
};

const pageGuardViaWiring = {
  meta: {
    type: "problem",
    docs: { description: "lib/pageGuard を値 import できるのは src/wiring/** だけ(guard.ts は @/wiring/pageGuard と親の extend)" },
    messages: {
      pageGuard:
        '"{{source}}" は汎用版のページの守り(src/lib/pageGuard)です。値 import できるのは src/wiring/** だけ。root の guard.ts は @/wiring/pageGuard の defineRootGuard、子の guard.ts は親の extend で作る(型だけの import は可。詳細: src/lib/pageGuard/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source, typeOnly }) => {
      const resolved = resolveImport(source, context.filename, repoRoot);
      if (classifyPageGuardImport(importerRel, resolved, typeOnly)) {
        context.report({ node, messageId: "pageGuard", data: { source } });
      }
    });
  },
};

const cronRouteViaWiring = {
  meta: {
    type: "problem",
    docs: { description: "lib/cron の作り手(createCronTaskRoute / createCronRoute)を値 import できるのは src/wiring/** だけ(cron の route は @/wiring/cronRoute から)" },
    messages: {
      cronFactory:
        '"{{source}}" の {{name}} は cron の汎用版の作り手です。値 import できるのは src/wiring/** だけ。cron の route.ts は @/wiring/cronRoute の createCronTaskRoute を使う(門番がタスクの住所 /api/cron/<name> で閉じた機能のタスクを飛ばす。型と他の名前は可。詳細: src/lib/cron/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source, typeOnly, specifiers }) => {
      const resolved = resolveImport(source, context.filename, repoRoot);
      const name = classifyCronFactoryImport(importerRel, resolved, typeOnly, specifiers);
      if (name) context.report({ node, messageId: "cronFactory", data: { source, name: name === "*" ? "名前を問わない import" : name } });
    });
  },
};

const featuresIndexNoServerReexport = {
  meta: {
    type: "problem",
    docs: { description: "features の index.ts(services/server の外)は services/server を値で再 export しない" },
    messages: {
      serverReexport:
        '"{{source}}" はサーバーのサービスです。features の barrel(index.ts)から値で再 export しない(UI が barrel 経由でサーバーの値を import できてしまう)。サーバーの値は services/server のパスから直接 import する(型だけの再 export は可)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    const onExport = (node) => {
      if (!node.source || typeof node.source.value !== "string") return;
      const declarationTypeOnly = node.exportKind === "type";
      const specs = node.specifiers ?? [];
      const typeOnly = declarationTypeOnly || (specs.length > 0 && specs.every((sp) => sp.exportKind === "type"));
      const resolved = resolveImport(node.source.value, context.filename, repoRoot);
      if (classifyFeaturesIndexReexport(importerRel, resolved, typeOnly, true)) {
        context.report({ node: node.source, messageId: "serverReexport", data: { source: node.source.value } });
      }
    };
    return { ExportNamedDeclaration: onExport, ExportAllDeclaration: onExport };
  },
};

const libNoRegistry = {
  meta: {
    type: "problem",
    docs: { description: "src/lib/** から src/registry/** を import しない(値も型も。結ぶのは src/wiring/**)" },
    messages: {
      libRegistry:
        '"{{source}}" は登録表(src/registry)です。lib は登録表を import しない(値も型も)。引数・注入で受け、結ぶのは src/wiring/**(詳細: src/wiring/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source }) => {
      const resolved = resolveImport(source, context.filename, repoRoot);
      if (classifyLibRegistryImport(importerRel, resolved)) context.report({ node, messageId: "libRegistry", data: { source } });
    });
  },
};

/** src のファイルが scripts を指す import か(D78) */
export const isSrcScriptsImport = (importerRel, resolved) => isUnder(importerRel, "src") && isUnder(resolved, "scripts");

/** 道具のファイルか(D79: scripts・ドメインの scripts・.notices の codemod) */
export const isToolFile = (rel) => isUnder(rel, "scripts") || /^src\/features\/.+\/scripts\//.test(rel) || /^\.notices\/[^/]+\.mjs$/.test(rel);

/** 道具から wiring への静的 import か(D79。import()・require は通す) */
export const isToolStaticWiringImport = (importerRel, resolved, dynamic) => !dynamic && isToolFile(importerRel) && isUnder(resolved, WIRING);

/** DB を直接書く部品を禁じる場所か(D75・D90。移行は例外) */
export function isDbWriteGuardedFile(rel) {
  if (/^src\/features\/.+\/scripts\/migrations\//.test(rel)) return false;
  if (/^src\/features\/.+\/scripts\/tasks\//.test(rel)) return true;
  if (/^src\/features\/.+\/seed\.ts$/.test(rel)) return true;
  // DB に書く開発の道具(利用者を userService で作る。L1.30)
  if (isUnder(rel, "scripts/workflow/dev-admin")) return true;
  return isUnder(rel, "scripts/operations") && !isUnder(rel, "scripts/operations/db");
}

const DB_DRIVER = /^(postgres|pg|@neondatabase\/serverless|drizzle-orm\/(postgres-js|node-postgres|neon-http|neon-serverless|pg-proxy|pglite|vercel-postgres))(\/|$)/;

/** DB を直接書く部品の import か: { what } か null。specifiers = null は名前を問わない形 */
export function classifyDbWriteImport(source, resolved, specifiers) {
  if (resolved && isUnder(resolved, "src/lib/drizzle")) return { what: "@/lib/drizzle(db)" };
  if (resolved && /(^|\/)entities\/drizzle(\.[a-z]+)?$/.test(resolved)) return { what: "表の定義(entities/drizzle)" };
  if (DB_DRIVER.test(source)) return { what: `接続のドライバ(${source})` };
  if (source === "drizzle-orm" && (specifiers === null || specifiers.some((sp) => sp.name === "sql" && !sp.typeOnly))) return { what: "生 SQL(drizzle-orm の sql)" };
  return null;
}

/** ドメインのシード(src/features/<ドメイン>/seed.ts)を、シードのランナーの外から読む import か */
export const isSeedReaderViolation = (importerRel, resolved) =>
  Boolean(resolved) && /^src\/features\/(?:.+\/)?seed(?:\.ts)?$/.test(resolved) && !isUnder(importerRel, "scripts/runner/seed");

const seedReader = {
  meta: {
    type: "problem",
    docs: { description: "ドメインのシード(seed.ts)を読むのはシードのランナーだけ(D52)" },
    messages: {
      seedReader: '"{{source}}" はドメインのシード(データだけ)です。読むのはシードのランナー scripts/runner/seed だけです(pnpm ops db seed、src/lib/seed/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source }) => {
      if (isSeedReaderViolation(importerRel, resolveImport(source, context.filename, repoRoot))) context.report({ node, messageId: "seedReader", data: { source } });
    });
  },
};

/** 地区の地図の集約ファイルを指す import か(目録 D12。解決できない書き方も字面で見る) */
export const DISTRICT_MAP_JSONL = /(^|\/)district-map\.jsonl$/;
export const isSrcDistrictMapImport = (importerRel, source, resolved) => isUnder(importerRel, "src") && (DISTRICT_MAP_JSONL.test(source) || DISTRICT_MAP_JSONL.test(resolved ?? ""));

const srcNoDistrictMap = {
  meta: {
    type: "problem",
    docs: { description: "src/** から地区の地図の集約ファイル district-map.jsonl を import しない(テストも、目録 D12)" },
    messages: {
      srcDistrictMap: '"{{source}}" は地区の地図の写し(人と agent・差分用)です。src のコードは import しません。地区の一覧が要るときは読み手 src/lib/districtMap を呼びます(道具・検査・生成だけ。src/lib/districtMap/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source }) => {
      if (isSrcDistrictMapImport(importerRel, source, resolveImport(source, context.filename, repoRoot))) context.report({ node, messageId: "srcDistrictMap", data: { source } });
    });
  },
};

const srcNoScripts = {
  meta: {
    type: "problem",
    docs: { description: "src/** から scripts/** を import しない(テストも、D78)" },
    messages: {
      srcScripts: '"{{source}}" は道具の置き場(scripts)です。src は scripts を import しません(テストも)。アプリと道具が両方使う物は src/lib に置き、道具の側のテストは scripts の側に置きます(scripts/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source }) => {
      if (isSrcScriptsImport(importerRel, resolveImport(source, context.filename, repoRoot))) context.report({ node, messageId: "srcScripts", data: { source } });
    });
  },
};

const scriptsNoStaticWiring = {
  meta: {
    type: "problem",
    docs: { description: "道具(scripts・ドメインの scripts・codemod)から src/wiring を静的に import しない(D79。import() は可)" },
    messages: {
      toolWiring: '"{{source}}" は結線(src/wiring)です。道具は結線を静的に import しません。使うときは run の中で `await import("{{source}}")` にします(読み込みのたびに結線の束を立ち上げないため。scripts/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    if (!isToolFile(importerRel)) return {};
    return moduleVisitors(({ node, source, dynamic }) => {
      if (isToolStaticWiringImport(importerRel, resolveImport(source, context.filename, repoRoot), dynamic)) context.report({ node, messageId: "toolWiring", data: { source } });
    });
  },
};

const toolsNoDbWrite = {
  meta: {
    type: "problem",
    docs: { description: "タスク・操作・シードは DB を直接書く部品を import しない(D75・D90。移行は例外)" },
    messages: {
      dbWrite: '"{{source}}" は DB を直接書く部品({{what}})です。ドメインのタスク・操作(scripts/operations、db を除く)・seed.ts からは読みません。書くのはドメインのサービスを通します。直接の SQL が要るなら移行(src/features/<domain>/scripts/migrations/)にします',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    if (!isDbWriteGuardedFile(importerRel)) return {};
    return moduleVisitors(({ node, source, specifiers }) => {
      const hit = classifyDbWriteImport(source, resolveImport(source, context.filename, repoRoot), specifiers);
      if (hit) context.report({ node, messageId: "dbWrite", data: { source, what: hit.what } });
    });
  },
};

/** lib のファイルが features を指す import か */
export const isLibFeaturesImport = (importerRel, resolved) => isUnder(importerRel, LIB) && isUnder(resolved, FEATURES);

const libNoFeatures = {
  meta: {
    type: "problem",
    docs: { description: "src/lib から src/features を import しない(値も型も)" },
    messages: {
      libFeatures: '"{{source}}": lib は features を import しません(値も型も)。型は lib が持つか型引数で受け、値は注入で受けて src/wiring で結びます(CLAUDE.md CODE_PLACEMENT deps)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = context.cwd ?? process.cwd();
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source }) => {
      if (!isLibFeaturesImport(importerRel, resolveImport(source, context.filename, repoRoot))) return;
      context.report({ node, messageId: "libFeatures", data: { source } });
    });
  },
};

const featureGateEntries = {
  meta: {
    type: "problem",
    docs: { description: "門番 src/featureGate の外からは入口(index.ts・client.ts・node.ts)だけを読む。lib は読まない、node.ts は scripts とテストだけ" },
    messages: {
      gateFromLib: '"{{source}}": lib は門番(src/featureGate)を読みません(値も型も)。規則や判定は引数で受けます(例 routeMap の gateRules)',
      gateInternal: '"{{source}}": 門番の中(rules・evaluate・tools・extensions など)は外から読みません。入口 @/featureGate・@/featureGate/client・@/featureGate/node を使います(src/featureGate/README.md)',
      gateNode: '"{{source}}": @/featureGate/node は道具の入口(scripts とテストだけ)。アプリ・proxy は @/featureGate(gate.enabled / gate.path)を使います',
      gateWiringOnly:
        '"{{name}}" は門番の client への受け渡しの配線用です(root の layout.tsx・src/wiring/AppProviders.tsx・admin の守りの layout 2 つだけ)。画面・部品は useGate()(@/featureGate/client)か gate(@/featureGate)を使います',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    return moduleVisitors(({ node, source, specifiers }) => {
      const resolved = resolveImport(source, context.filename, repoRoot);
      const messageId = classifyFeatureGateImport(importerRel, resolved);
      if (messageId) {
        context.report({ node, messageId, data: { source } });
        return;
      }
      const name = featureGateWiringNameOutside(importerRel, resolved, specifiers);
      if (name) context.report({ node, messageId: "gateWiringOnly", data: { name } });
    });
  },
};

const linkViaShelf = {
  meta: {
    type: "problem",
    docs: { description: "next/link を直接 import しない(棚の Link を使う)。fork は閉じられる住所の字面を持つファイルだけ" },
    messages: {
      rawNextLink:
        '"next/link" を直接 import しません。棚の Link(import { Link } from "@/components/Navigation")を使うと閉じた機能の住所へのリンクが自動で消えます(閉じていても出すなら gate="always"。src/components/Navigation/Link/README.md)',
      rawNextLinkClosable:
        '"next/link" のリンクが閉じられる住所 "{{text}}"(門番の規則 {{pattern}})を指しています。棚の Link(import { Link } from "@/components/Navigation")を使うと機能を閉じたとき自動で消えます(src/components/Navigation/Link/README.md)',
    },
    schema: [
      {
        type: "object",
        properties: { closableOnly: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    if (importerRel === SHELF_LINK) return {};
    const closableOnly = context.options[0]?.closableOnly === true;
    const imports = [];
    const texts = [];
    const visitors = moduleVisitors(({ node, source, typeOnly }) => {
      if (source === "next/link" && !typeOnly) imports.push(node);
    });
    return {
      ...visitors,
      Literal(node) {
        if (closableOnly && typeof node.value === "string") texts.push(node.value);
      },
      TemplateLiteral(node) {
        if (closableOnly) texts.push(node.quasis[0]?.value.cooked ?? "");
      },
      "Program:exit"() {
        if (imports.length === 0) return;
        if (!closableOnly) {
          for (const node of imports) context.report({ node, messageId: "rawNextLink" });
          return;
        }
        const patterns = readClosablePatterns(repoRoot);
        for (const text of texts) {
          const pattern = closablePatternOf(text, patterns);
          if (!pattern) continue;
          for (const node of imports) context.report({ node, messageId: "rawNextLinkClosable", data: { text, pattern } });
          return;
        }
      },
    };
  },
};

// ── router-via-guard(D11、指令 18) ──
// next/navigation の useRouter を直接 import しない。移動は未保存の編集の守り付きの router(import { useRouter } from "@/lib/unsavedGuard"、
// 同じ名前・同じ形)を使う(棚の部品は useShelfRouter from "@/components/Navigation/NavigationPort")。例外は守りの lib の中だけ。
// 上流 = error・fork = warn(link-via-shelf の対)。置き換え: .notices/20261106-094557-shared-shelf-admin-header-band.guarded-router.mjs
const routerViaGuard = {
  meta: {
    type: "problem",
    docs: { description: "next/navigation の useRouter を直接 import しない(守り付きの router を使う)" },
    messages: {
      rawUseRouter:
        '"next/navigation" の useRouter を直接 import しません。編集中の離脱を確かめる守り付きの router(import { useRouter } from "@/lib/unsavedGuard"、同じ形)を使います(棚の部品は useShelfRouter from "@/components/Navigation/NavigationPort"。置き換え: .notices/20261106-094557-shared-shelf-admin-header-band.guarded-router.mjs。src/lib/unsavedGuard/README.md)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    if (isUnder(repoRelative(context.filename, repoRoot), UNSAVED_GUARD_LIB)) return {};
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "next/navigation" || node.importKind === "type") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const imported = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
          if (imported === "useRouter") context.report({ node: specifier, messageId: "rawUseRouter" });
        }
      },
    };
  },
};

const clientNoDomainJson = {
  meta: {
    type: "problem",
    docs: { description: "client のコードは domain.json を import しない(写し entities/display.ts を読む)" },
    messages: {
      clientDomainJson:
        '"{{source}}": client のコードは domain.json を import しません。写し entities/display.ts の domainDisplay を読みます。写しに無いキーが要るときは理由を書いて eslint-disable(詳細: src/lib/domain/README.md。置き換え: .notices/20261101-121000-domain-display-client.domain-json-client-display.mjs)',
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    if (!isClientCodeFile(repoRelative(context.filename, repoRoot), context.sourceCode.text)) return {};
    return moduleVisitors(({ node, source }) => {
      if (isDomainJsonPath(resolveImport(source, context.filename, repoRoot))) {
        context.report({ node, messageId: "clientDomainJson", data: { source } });
      }
    });
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-import-boundaries", version: "1.0.0" },
  rules: {
    "route-factory-via-wiring": routeFactoryViaWiring,
    "page-guard-via-wiring": pageGuardViaWiring,
    "cron-route-via-wiring": cronRouteViaWiring,
    "features-index-no-server-reexport": featuresIndexNoServerReexport,
    "lib-no-registry": libNoRegistry,
    "lib-no-features": libNoFeatures,
    "client-no-domain-json": clientNoDomainJson,
    "feature-gate-entries": featureGateEntries,
    "link-via-shelf": linkViaShelf,
    "router-via-guard": routerViaGuard,
    "src-no-scripts": srcNoScripts,
    "src-no-district-map": srcNoDistrictMap,
    "seed-reader": seedReader,
    "scripts-no-static-wiring": scriptsNoStaticWiring,
    "tools-no-db-write": toolsNoDbWrite,
  },
};

export default plugin;
