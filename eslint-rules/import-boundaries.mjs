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
// 今ある違反は import-boundaries.exceptions.mjs の縮むだけの一覧(upstream の物。fork は足せない)。
// 一覧の行(file + target)に当たる import は通す。一覧の行のファイルにその import が無くなったら、行を消すよう error。
//
// 限界: 直接の import だけを見る(値を変数に入れて別ファイルへ渡す形は追わない)。

import { LIB_REGISTRY_EXCEPTIONS } from "./import-boundaries.exceptions.mjs";
import { isUnder, moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const ROUTE_FACTORY = "src/lib/routeFactory";
const WIRING = "src/wiring";
const LIB = "src/lib";
const REGISTRY = "src/registry";

/** 違反の判定(テストから直接呼ぶ)。違反なら messageId、無ければ null */
export function classifyRouteFactoryImport(importerRel, resolved, typeOnly) {
  if (typeOnly) return null;
  if (!isUnder(resolved, ROUTE_FACTORY)) return null;
  if (isUnder(importerRel, WIRING) || isUnder(importerRel, ROUTE_FACTORY)) return null;
  return "routeFactory";
}

export function classifyLibRegistryImport(importerRel, resolved, exceptions = LIB_REGISTRY_EXCEPTIONS) {
  if (!isUnder(importerRel, LIB) || !isUnder(resolved, REGISTRY)) return null;
  const bare = resolved.replace(/\.(ts|tsx|mts|mjs|js)$/, "");
  const listed = exceptions.some((e) => e.file === importerRel && (e.target === bare || isUnder(resolved, e.target)));
  return listed ? "listed" : "libRegistry";
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

const libNoRegistry = {
  meta: {
    type: "problem",
    docs: { description: "src/lib/** から src/registry/** を import しない(値も型も。結ぶのは src/wiring/**)" },
    messages: {
      libRegistry:
        '"{{source}}" は登録表(src/registry)です。lib は登録表を import しない(値も型も)。引数・注入で受け、結ぶのは src/wiring/**(詳細: src/wiring/README.md)',
      staleException:
        "{{file}} は {{target}} を import しなくなりました。eslint-rules/import-boundaries.exceptions.mjs の行を消す(縮むだけの一覧)",
    },
    schema: [],
  },
  create(context) {
    const repoRoot = repoRootOf(context);
    const importerRel = repoRelative(context.filename, repoRoot);
    const listedHere = LIB_REGISTRY_EXCEPTIONS.filter((e) => e.file === importerRel);
    const used = new Set();
    return {
      ...moduleVisitors(({ node, source }) => {
        const resolved = resolveImport(source, context.filename, repoRoot);
        const kind = classifyLibRegistryImport(importerRel, resolved);
        if (kind === "libRegistry") context.report({ node, messageId: "libRegistry", data: { source } });
        if (kind === "listed") {
          for (const e of listedHere) if (isUnder(resolved, e.target)) used.add(e.target);
        }
      }),
      "Program:exit"(program) {
        for (const e of listedHere) {
          if (!used.has(e.target)) {
            context.report({ node: program, messageId: "staleException", data: { file: e.file, target: e.target } });
          }
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-import-boundaries", version: "1.0.0" },
  rules: {
    "route-factory-via-wiring": routeFactoryViaWiring,
    "lib-no-registry": libNoRegistry,
  },
};

export default plugin;
