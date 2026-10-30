import nextConfig from "eslint-config-next";

import auditPlugin from "./eslint-rules/audit-action-naming.mjs";
import clientServiceBoundaryPlugin from "./eslint-rules/client-service-boundary.mjs";
import coreUiEntryPlugin from "./eslint-rules/core-ui-entry.mjs";
import deprecatedImportsPlugin from "./eslint-rules/deprecated-imports.mjs";
import hiddenColumnsPlugin, { collectHiddenColumns } from "./eslint-rules/hidden-columns.mjs";
import pageAuthzPlugin from "./eslint-rules/page-authz.mjs";
import realtimeRoomPlugin from "./eslint-rules/realtime-room-purity.mjs";
import importBoundariesPlugin from "./eslint-rules/import-boundaries.mjs";
import routeHttpExportPlugin from "./eslint-rules/route-http-export.mjs";
import styleTokensPlugin from "./eslint-rules/style-tokens.mjs";
import { loadCatalogOwnership } from "./src/lib/folderCatalog/catalog.mjs";
import forkConfig from "./eslint.config.fork.mjs";

// src/lib のライブラリの所有(src/lib/CATALOG.md の節)。自分の origin の節 = 自分のライブラリ。
// 自分が先頭の節(Tier1)でなければ、自分のライブラリは「下流の UI」と同じく warn に落とす(上流のライブラリは error のまま)。
// origin が無い・目録が読めないときは自分の所有なし = 全部 error(安全側)。
const libOwnership = loadCatalogOwnership({ repoRoot: import.meta.dirname, folder: "src/lib" });
const forkOwnedLibFiles = libOwnership.isRoot ? [] : libOwnership.ownPaths.map((path) => `${path}/**/*.{ts,tsx}`);

const config = [
  ...nextConfig,
  {
    ignores: [
      "src/_stash/**",
      ".firebase/**",
      ".next/**",
      "node_modules/**",
      // Claude Code が作るワークツリー (リポジトリ丸ごとの複製)。lint するとファイルが二重になる
      ".claude/worktrees/**",
      // 生成器テンプレートのうち、プレースホルダー(__ASYNC__function / __RelationTableImports__import 等)が
      // TypeScript として構文エラーになるファイルだけを除外する(パースできないので lint しようがない)。
      // 他のテンプレートは lint 対象のまま(生パレット色・ClientService 直接 import 等の検査を生成元で効かせる)。
      // 新しいテンプレートがパースエラーを出したらここに足す。
      "src/app/admin/_template/__domains__/[[]id]/edit/_screen/Admin__Domain__EditScreen.tsx",
      "src/app/admin/_template/__domains__/new/_screen/Admin__Domain__CreateScreen.tsx",
      "src/app/admin/_template/__domains__/[[]id]/edit/_screen/loader.ts",
      "src/app/admin/_template/__domains__/new/_screen/loader.ts",
      "src/features/_template/components/Admin__Domain__List/Table.tsx",
      "src/features/_template/components/Admin__Domain__List/Table.withDetailModal.tsx",
      "src/features/_template/services/server/drizzleBase.ts",
    ],
  },
  // テンプレートのフックは名前がプレースホルダー(use__Domain__)でフックの命名規則を満たせないため、
  // react-hooks の規則だけ外す。生成後のフックは sample 系ドメインで通常どおり検査される。
  {
    files: ["src/features/_template/hooks/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // 監査ログの action 命名規約 (`<domain>.<entity>.<verb>`) を静的に強制する。
  // 動的に組み立てる必要がある正当なケースは個別 eslint-disable で許可する。
  //
  // subject-required は「ユーザーに紐づく操作」で subjectUserId 未指定を警告する。
  // metadata.userId に隠す構造的脆弱性を防ぐためのもの。bulk aggregate 等の正当な
  // 例外は action 名に `.bulk_` を含めるか個別 eslint-disable で抑止する。
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { audit: auditPlugin },
    rules: {
      "audit/action-naming": "error",
      "audit/subject-required": "warn",
    },
  },
  // route.ts の HTTP の export は wiring の Factory か lib/cron の作り手の呼び出し結果だけ(D8 K7)。
  // 主体と access は Factory が持ち、route は宣言だけを書く。api の外の route.ts も対象。
  // セキュリティの検査なので upstream・下流とも error(fork 分岐なし)。詳細: eslint-rules/route-http-export.mjs
  {
    files: ["src/app/**/route.{ts,tsx}"],
    plugins: { "route-http-export": routeHttpExportPlugin },
    rules: {
      "route-http-export/http-export": "error",
    },
  },
  // 層の境目の import を実パスで検査する(エイリアス・相対・"src/…"・サブパス・dynamic import も同じ)。全 Tier error。
  // - route-factory-via-wiring: @/lib/routeFactory の値 import は src/wiring/** だけ(D5 K1。型だけは可)
  // - page-guard-via-wiring: @/lib/pageGuard の値 import は src/wiring/** だけ(L1.18。型だけは可)
  // - features-index-no-server-reexport: features の index.ts は services/server を値で再 export しない(D73 K5)
  // - lib-no-registry: src/lib/** → src/registry/** は値も型も禁止(D23 K3)。今の違反は縮むだけの一覧
  //   (eslint-rules/import-boundaries.exceptions.mjs、upstream の物で fork は足せない)
  // 詳細: eslint-rules/import-boundaries.mjs
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}", "scripts/**/*.{ts,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/route-factory-via-wiring": "error",
      "import-boundaries/page-guard-via-wiring": "error",
    },
  },
  {
    files: ["src/features/**/index.{ts,tsx}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/features-index-no-server-reexport": "error",
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx,mts,mjs}"],
    // テストは実行時のコードでなく、登録表の中身を読んで確かめる検査なので対象外
    ignores: ["src/lib/**/*.test.{ts,tsx,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/lib-no-registry": "error",
    },
  },
  // 見出しの直下の <Span> に size / weight を書かせる(Span の既定 text-base font-normal が見出しを上書きするため。
  // 詳細: eslint-rules/style-tokens.mjs span-in-heading, src/components/TextBlocks/README.md)。
  // 下流の画面(app/ と features/<business>)は warn。upstream 所有の UI は下の style-tokens ブロックで error に上書きする。
  {
    files: ["src/app/**/*.tsx", "src/features/**/*.tsx"],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/span-in-heading": "warn",
    },
  },
  // 生パレット色(bg-slate-900 / text-white / bg-[#fff] 等)の禁止。色はテーマトークンで書く
  // (詳細: eslint-rules/style-tokens.mjs, src/styles/README.md)。
  // upstream 所有の UI(共有 UI・core ドメイン・ドメイン雛形)は error。下流固有 UI(features/<business>, app/)は対象外
  // (下流が同じ規律を敷きたい場合は files にパスを足す)。
  // 除外: _shadcn(vendored。見た目はラッパー側が上書きする) / Three(3D 演出) / gradient(トークン生成元)。
  // ブランドロゴ色・ユーザーが選ぶ固定パレットなど正当な例外は理由付き eslint-disable で明示する。
  // 枠の既定部品(src/app/**/_layout/。AppFrames から移した物)も upstream 所有の UI として error。
  // 隣に置く fork のカスタム(ドット区切り名 <Name>.<project>.tsx)は ignores で外し、上の app/ の warn に従う。
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/features/core/**/*.{ts,tsx}",
      "src/features/_template/**/*.{ts,tsx}",
      "src/app/**/_layout/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/components/_shadcn/**",
      "src/components/Three/**",
      "src/lib/gradient/**",
      "src/app/**/_layout/**/*.*.{ts,tsx}",
    ],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/no-raw-palette": "error",
      "style-tokens/span-in-heading": "error",
    },
  },
  // fork が足したライブラリ(src/lib/CATALOG.md の自分の節)は warn(上の error を上書き)。Tier1 自身では空
  ...(forkOwnedLibFiles.length > 0
    ? [
        {
          files: forkOwnedLibFiles,
          rules: {
            "style-tokens/no-raw-palette": "warn",
            "style-tokens/span-in-heading": "warn",
          },
        },
      ]
    : []),
  // _shadcn の直接 import 禁止(CLAUDE.md COMPONENTS wrappers)。ラッパーは src/components に置く。
  // 許可: src/components(ラッパー本体) / src/lib/tableSuite(table の指定ラッパー。セルエディタも primitive 層)。
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/**", "src/lib/tableSuite/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/_shadcn/*"],
              message:
                "_shadcn を直接 import しない。ラッパーを使う(対応表: src/components/_shadcn/README.md。無ければ src/components にラッパーを作る)",
            },
          ],
        },
      ],
    },
  },
  // 改名・移動済み module の旧パス import を警告する(詳細: eslint-rules/deprecated-imports.mjs)。
  // upstream が改名したとき、旧パスには再 export の shim が 1 checkpoint だけ残る。warn の間に新パスへ直す
  // (次の checkpoint で shim が消えると tsc が止める)。下流が自分の改名で使ってもよい(paths に足す)。
  // 現在の一覧 = なし(枠の移動の shim と一覧は checkpoint old-entry-removal で削除した)。
  // 書式: { from: "@/features/...", to: "@/features/...", until: "checkpoint <label> の次" }
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "deprecated-imports": deprecatedImportsPlugin },
    rules: {
      "deprecated-imports/no-deprecated-path": [
        "warn",
        {
          paths: [],
        },
      ],
    },
  },
  // UI から ClientService を直接 import しない(HTTP は Hook → ClientService。詳細: eslint-rules/client-service-boundary.mjs)。
  // 下流の UI(features/<business>/components, app/ の画面)は warn、upstream 所有の UI は error(後のブロックが上書き)。
  // 除外: app/api(UI ではない) / demo(エンジンに fetcher を渡す使い方の見本)。
  // セッション状態の持ち主の Provider など正当な例外は理由付き eslint-disable で明示する。
  {
    files: ["src/features/**/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**", "src/app/(user)/demo/**"],
    plugins: { "client-service-boundary": clientServiceBoundaryPlugin },
    rules: {
      "client-service-boundary/no-direct-import": "warn",
    },
  },
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/features/core/**/components/**/*.{ts,tsx}",
      "src/features/_template/**/components/**/*.{ts,tsx}",
      "src/app/**/_layout/**/*.{ts,tsx}",
    ],
    // 枠の既定部品は upstream 所有の UI。隣のドット区切り名(fork のカスタム)は上の app/ の warn
    ignores: ["src/app/**/_layout/**/*.*.{ts,tsx}"],
    plugins: { "client-service-boundary": clientServiceBoundaryPlugin },
    rules: {
      "client-service-boundary/no-direct-import": "error",
    },
  },
  // 秘匿カラム (defineHiddenColumns) を生 drizzle の select / returning で取り出さない。
  // 生 SQL は hiddenColumns の自動除去を通らず、行を HTTP / Client Component に渡すと漏れるため、
  // upstream・下流とも error。行を丸ごと取るなら getPublicColumns(<Table>)、秘匿値そのものが要るなら
  // services/server/finders/ の専用ファインダー(対象外)。詳細: eslint-rules/hidden-columns.mjs
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/services/server/finders/**", "src/**/entities/**"],
    plugins: { "hidden-columns": hiddenColumnsPlugin },
    rules: {
      "hidden-columns/no-raw-select": [
        "error",
        { hiddenColumns: collectHiddenColumns(`${import.meta.dirname}/src`) },
      ],
    },
  },
  // UI の場所はサーバーのデータを取らない(M4 を D73 K1 の範囲へ。詳細: eslint-rules/page-authz.mjs, src/features/core/auth/README.md)。
  // 対象 = src/app の Screen・page・layout・_layout・guard.ts・_components の部品と components・hooks。services/server・DB(L1.20)を
  // 値で import しない(型は可)。取得は同じルートの loader(guard.ts の createLoader)へ。loader.ts・route.ts・API は対象外。
  // 名前付き例外 = AuthSessionProvider(Cookie の解析とセッション解決)。セキュリティの検査なので upstream・下流とも error(fork 分岐なし)。
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/features/**/components/**/*.{ts,tsx}",
      "src/features/**/hooks/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/app/**/loader.ts",
      "src/app/**/route.{ts,tsx}",
      "src/app/api/**",
      "src/features/core/auth/components/AuthSessionProvider.tsx",
    ],
    plugins: { "page-authz": pageAuthzPlugin },
    rules: {
      "page-authz/layout-no-server-data": "error",
    },
  },
  // セッション・ガード API(authGuard・getSessionUser・requireCurrentUser 等)をページ層・UI・API で import しない(M3、D73 K4・K5)。
  // 対象 = src/app 全体(page・Screen・layout・_layout・loader.ts・guard.ts・_components・API)と UI 側。許可の場所は無い:
  // ページの主体は guard.ts の createLoader が loader の ctx.user で渡し、範囲の守りは guard()。API の主体は Factory の ctx.user(D8 K4)。
  // proxy の項目(src/proxies/**、上流・fork)の主体は proxy.ts が渡す ctx.user()(D10)。解決器を作る src/proxy.ts は対象外。
  // AuthSessionProvider は認証基盤の名前付き例外(root layout の Provider)。
  // セキュリティの検査なので upstream・下流とも error(fork 分岐なし)。詳細: eslint-rules/page-authz.mjs
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/features/**/components/**/*.{ts,tsx}",
      "src/features/**/hooks/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/proxies/**/*.{ts,tsx,mts,mjs}",
      // core のサービスもセッションを読まない(主体は呼び手が引数で渡す)。主体を解く基盤だけ外す。
      // fork のサービスは対象外: 自前のドメインで読んでいる fork があり、別の依頼で判断する
      "src/features/core/**/services/server/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/features/core/auth/components/AuthSessionProvider.tsx",
      "src/features/core/auth/services/server/**",
      "src/features/core/pairedDevice/services/server/session/**",
    ],
    plugins: { "page-authz": pageAuthzPlugin },
    rules: {
      "page-authz/session-api-callsite": "error",
    },
  },
  // core の部品は入口だけを読む(全 Tier で error。詳細: eslint-rules/core-ui-entry.mjs)
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "core-ui-entry": coreUiEntryPlugin },
    rules: {
      "core-ui-entry/no-inner-import": "error",
    },
  },
  // ルームロジック (servers/room にバンドルされる) の純度制約。
  // Node/Next/DB import を静的に遮断する (詳細: eslint-rules/realtime-room-purity.mjs)。
  {
    files: ["src/features/**/room/**/*.ts"],
    plugins: { "realtime-room": realtimeRoomPlugin },
    rules: {
      "realtime-room/purity": "error",
    },
  },
  // fork が足す設定(業務の規則・追加の plugin)。eslint.config.fork.mjs は fork の物(upstream は空で出荷)
  ...forkConfig,
];

export default config;
