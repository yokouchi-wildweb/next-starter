// eslint-rules/import-boundaries.mjs
//
// 層の境目の import を、書き方(エイリアス・相対・"src/…"・サブパス・dynamic import・require)によらず実パスで検査する
// ローカル ESLint プラグイン。解決は resolve-import.mjs。強さ: 全 Tier error(所有で変えない。eslint.config.mjs)。
//
// ── route-factory-via-wiring(D5 K1) ──
// @/lib/routeFactory(src/lib/routeFactory/** のどのファイルも)を値 import できるのは src/wiring/**(fork のドット名の
// wiring を含む)と src/lib/routeFactory 自身だけ。型だけの import は誰でも可。
// 理由: 汎用版の Factory は主体の解き方・access の評価・登録表を差し込んで初めて使える。route は wiring の設定済み版
// (@/wiring/apiRoute)を使い、差し込み忘れ・別の束での組み立てを構造で防ぐ。createCrudService・lib/cron は対象外(D5 K2)。
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
// 限界: 直接の import だけを見る(値を変数に入れて別ファイルへ渡す形は追わない)。

import { isUnder, moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const ROUTE_FACTORY = "src/lib/routeFactory";
const PAGE_GUARD = "src/lib/pageGuard";
const SERVER_SERVICE_DIR = /(^|\/)services\/server(\/|$)/;
const WIRING = "src/wiring";
const LIB = "src/lib";
const REGISTRY = "src/registry";
const FEATURES = "src/features";

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

/** features の barrel(services/server の外の index.ts)が services/server を値で再 export するか */
export function classifyFeaturesIndexReexport(importerRel, resolved, typeOnly, isReexport) {
  if (!isReexport || typeOnly || !resolved) return null;
  if (!/^src\/features\/.+\/index\.(ts|tsx)$/.test(importerRel) || SERVER_SERVICE_DIR.test(importerRel)) return null;
  return SERVER_SERVICE_DIR.test(resolved) ? "serverReexport" : null;
}

export function classifyLibRegistryImport(importerRel, resolved) {
  return isUnder(importerRel, LIB) && isUnder(resolved, REGISTRY) ? "libRegistry" : null;
}

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

const plugin = {
  meta: { name: "eslint-plugin-local-import-boundaries", version: "1.0.0" },
  rules: {
    "route-factory-via-wiring": routeFactoryViaWiring,
    "page-guard-via-wiring": pageGuardViaWiring,
    "features-index-no-server-reexport": featuresIndexNoServerReexport,
    "lib-no-registry": libNoRegistry,
    "lib-no-features": libNoFeatures,
  },
};

export default plugin;
