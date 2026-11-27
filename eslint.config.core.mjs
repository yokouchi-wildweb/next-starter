// eslint.config.core.mjs
// ESLint の設定の Tier1 の本体(core)。各リポの素の eslint.config.mjs(型 5 self)がこれを読み、後ろに自分の設定を足す。ここは Tier1 だけが書く。
// 全 Tier の必須の規則(eslint-rules/required-rules.mjs)は、素の版で緩めても pnpm check eslint が止める

import nextConfig from "eslint-config-next";

import auditPlugin from "./eslint-rules/audit-action-naming.mjs";
import clientServiceBoundaryPlugin from "./eslint-rules/client-service-boundary.mjs";
import coreUiGuardsPlugin from "./eslint-rules/core-ui-guards.mjs";
import { CORE_UI_GUARDS_ALLOW } from "./eslint-rules/core-ui-guards.allow.mjs";
import noServerActionPlugin from "./eslint-rules/no-server-action.mjs";
import deprecatedImportsPlugin from "./eslint-rules/deprecated-imports.mjs";
import fieldTypeGuardPlugin from "./eslint-rules/field-type-guard.mjs";
import intersectionObserverPlugin from "./eslint-rules/intersection-observer.mjs";
import activityPlugin from "./eslint-rules/activity.mjs";
import appEnvPlugin from "./eslint-rules/app-env.mjs";
import useClientPlugin from "./eslint-rules/use-client.mjs";
import assetPathsPlugin from "./eslint-rules/asset-paths.mjs";
import rawElementsPlugin from "./eslint-rules/raw-elements.mjs";
import configOverridesPlugin from "./eslint-rules/config-overrides.mjs";
import hiddenColumnsPlugin, { collectHiddenColumns } from "./eslint-rules/hidden-columns.mjs";
import pageAuthzPlugin from "./eslint-rules/page-authz.mjs";
import rawSqlDatePlugin from "./eslint-rules/raw-sql-date.mjs";
import realtimeRoomPlugin from "./eslint-rules/realtime-room-purity.mjs";
import entryPlugin from "./eslint-rules/entry.mjs";
import importBoundariesPlugin from "./eslint-rules/import-boundaries.mjs";
import routeHttpExportPlugin from "./eslint-rules/route-http-export.mjs";
import segmentConfigPlugin from "./eslint-rules/segment-config.mjs";
import useCachePlugin from "./eslint-rules/use-cache.mjs";
import styleTokensPlugin from "./eslint-rules/style-tokens.mjs";
import { loadCatalogOwnership } from "./src/lib/folderCatalog/node.mjs";

// src/lib のライブラリの所有(src/lib/CATALOG.md の節)。自分の origin の節 = 自分のライブラリ。
// 自分が先頭の節(Tier1)でなければ、自分のライブラリは「下流の UI」と同じく warn に落とす(上流のライブラリは error のまま)。
// origin が無い・目録が読めないときは自分の所有なし = 全部 error(安全側)。
const libOwnership = loadCatalogOwnership({ repoRoot: import.meta.dirname, folder: "src/lib" });
const forkOwnedLibFiles = libOwnership.isRoot ? [] : libOwnership.ownPaths.map((path) => `${path}/**/*.{ts,tsx}`);
/** 部品の棚 Primitives へ移した旧パスの削除の区切り(deprecated-imports の until) */
const PRIMITIVES_REMOVED = "checkpoint primitives-radix で削除済み";
/** stores の廃止で閉じた lib へ移した旧パスの削除の区切り(deprecated-imports の until) */
const STORES_REMOVED = "checkpoint stores-removal で削除済み";
/** 素の表 PlainTable へ移した旧パスの削除の区切り(deprecated-imports の until) */
const SHADCN_REMOVED = "checkpoint shadcn-close で削除済み";
/** 部品の棚の Fanctional(綴りの誤り)を Functional へ改名した旧パスの削除の区切り(deprecated-imports の until) */
const FUNCTIONAL_RENAMED = "checkpoint context-after-v2 で削除済み";
/** 部品の棚の場所の整理(入口の廃止・spacing を lib へ・Kiosk / BodyPortal / useHeaderHeight / Elements の移動)の旧パスの削除の区切り(deprecated-imports の until) */
const SHELF_S1_MOVED = "checkpoint shelf-s1 で削除済み";
/** 部品の棚の Form をほどく移行(Button・Input の単位、入力の型と関数を Input/options へ)の旧パスの削除の区切り(deprecated-imports の until) */
const SHELF_S2_MOVED = "checkpoint shelf-s2 で削除済み";
/** lib の小物の移行(lib は @/hooks・@/utils を読まない、lib/appStatus、useDarkModeSwitch)の旧パスの削除の区切り(deprecated-imports の until) */
const SHELF_S3_MOVED = "checkpoint shelf-s3 で削除済み";

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
      "src/domains/_template/components/Admin__Domain__List/Table.tsx",
      "src/domains/_template/components/Admin__Domain__List/Table.withDetailModal.tsx",
      "src/domains/_template/services/server/__domain__Base.ts",
      "src/domains/_template/services/server/__domain__Base.firestore.ts",
    ],
  },
  // テンプレートのフックは名前がプレースホルダー(use__Domain__)でフックの命名規則を満たせないため、
  // react-hooks の規則だけ外す。生成後のフックは sample 系ドメインで通常どおり検査される。
  {
    files: ["src/domains/_template/hooks/**/*.{ts,tsx}"],
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
  // page・layout・route の segment config のうち cacheComponents と両立しない 5 つ(dynamic・dynamicParams・fetchCache・
  // revalidate・runtime)を書かない。cacheComponents が有効なので全 Tier error(fork 分岐なし、必須の規則の表 required-rules.mjs)。
  // page.tsx・layout.tsx の切り替えの形の検査(src/lib/screens/checks.mjs)でも違反。詳細: eslint-rules/segment-config.mjs
  {
    files: ["src/app/**/{page,layout,route}.{ts,tsx}"],
    plugins: { "segment-config": segmentConfigPlugin },
    rules: {
      "segment-config/cc-incompatible": "error",
    },
  },
  // 共有の "use cache"(と remote)の中で利用者・権限を引数の外から読まない(セッション・ガードの API・cookies / headers・監査の文脈の主体)。
  // 引数に含めるか "use cache: private"。認可の検査なので全 Tier error(必須の規則の表)。詳細: eslint-rules/use-cache.mjs
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}"],
    plugins: { "use-cache": useCachePlugin },
    rules: {
      "use-cache/no-principal-outside-args": "error",
      // 共有の読みのキャッシュの標準の形(D52・D53 K1): 手書きの remote・cache の中の DB の直の読み・next/cache の直の消しを止める
      "use-cache/remote-only-generated": "error",
      "use-cache/no-data-read-in-cache": "error",
      "use-cache/no-manual-revalidate": "error",
    },
  },
  // 層の境目の import を実パスで検査する(エイリアス・相対・"src/…"・サブパス・dynamic import も同じ)。全 Tier error。
  // - route-factory-via-wiring: @/lib/routeFactory の値 import は src/wiring/** だけ(D5 K1。型だけは可)
  // - page-guard-via-wiring: @/lib/pageGuard の値 import は src/wiring/** だけ(L1.18。型だけは可)
  // - cron-route-via-wiring: @/lib/cron の作り手 createCronTaskRoute / createCronRoute の値 import は src/wiring/** だけ(D19。cron の route は @/wiring/cronRoute)
  // - domains-index-no-server-reexport: features の index.ts は services/server を値で再 export しない(D73 K5)
  // - lib-no-registry: src/lib/** → src/registry/** は値も型も禁止(D23 K3、例外の一覧なし)
  // - district-no-domains(下のブロック): ゲートの無い地区 → src/domains/** は値も型も禁止(D22。lib だけを見た前の規則を広げた 1 本)
  // - feature-gate-entries: 門番 src/featureGate の外からは入口 3 つだけ、lib は読まない、node.ts は scripts だけ(D7。テストは対象外 L1.3)
  // 詳細: eslint-rules/import-boundaries.mjs
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}", "scripts/**/*.{ts,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/route-factory-via-wiring": "error",
      "import-boundaries/page-guard-via-wiring": "error",
      "import-boundaries/cron-route-via-wiring": "error",
      "import-boundaries/feature-gate-entries": "error",
    },
  },
  // 置き場の境目(計画書 06、全 Tier error、場所の判定は規則の中):
  // - src-no-scripts: src/**(テストも)→ scripts/** の import 禁止(D78)
  // - src-no-district-map: src/**(テストも)→ src/registry/district-map.jsonl の import 禁止(地区の地図の写し、目録 D12)
  // - scripts-no-static-wiring: 道具(scripts・ドメインの scripts・.notices の codemod)→ src/wiring の静的 import 禁止、import() は可(D79)
  // - seed-reader: ドメインのシード src/domains/**/seed.ts を読むのは scripts/runner/seed だけ(D52)
  // - tools-no-db-write: ドメインの scripts/tasks・scripts/operations(db を除く)・seed.ts・scripts/workflow/dev-admin → DB を直接書く部品の import 禁止、移行は例外(D75・D90)
  {
    files: ["src/**/*.{ts,tsx,mts,mjs,js,cjs}", "scripts/**/*.{ts,mts,mjs,js,cjs}", ".notices/*.mjs"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/src-no-scripts": "error",
      "import-boundaries/src-no-district-map": "error",
      "import-boundaries/scripts-no-static-wiring": "error",
      "import-boundaries/tools-no-db-write": "error",
      "import-boundaries/seed-reader": "error",
    },
  },
  // 入口(全 Tier error。D85):
  // - entry/only-entries: 棚の単位・core の部品・宣言済みの lib は入口からだけ読む(値も型も)。宣言済みの lib は
  //   "libs" の lib の入口・"peers" の棚・@lib-config/<自分> だけを読む(D80・D83・D84。詳細: eslint-rules/entry.mjs)
  // - lib-self-relative: 宣言済みの lib の中で自分を @/lib/<自分> で読まない(相対パスで読む。D100)
  // scripts・テスト・eslint 設定からの読みも対象(D84)。出荷済みの notice の道具(.notices/<id>.*.mjs とそのテスト)だけは
  // entry/only-entries から外す: 道具は自分の区切り(checkpoint)の時点の木に対して走り、出荷後は書き換えない(D267)。
  // その木では正しい中のファイルの道(閉じる前の lib など)を、今の木の入口で止めない。ほかの lint は .notices にも掛かる
  {
    files: ["**/*.{ts,tsx,mts,mjs,js,cjs}"],
    ignores: [".notices/*.mjs"],
    plugins: { entry: entryPlugin },
    rules: {
      "entry/only-entries": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,mjs,js,cjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/lib-self-relative": "error",
    },
  },
  // - link-via-shelf: next/link を直接 import しない(棚の Link が閉じた機能の住所を自動で隠す。D14・L1.9)。
  //   強さは field-type-guard と同じく Tier で切り替える(libOwnership.isRoot = src/lib/CATALOG.md の先頭の節が自分):
  //   Tier1 は全部 error、fork は閉じられる住所の字面を持つファイルだけ warn。テストは対象外
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/link-via-shelf": libOwnership.isRoot ? "error" : ["warn", { closableOnly: true }],
      // router-via-guard: next/navigation の useRouter は守り付きの router(@/lib/unsavedGuard)へ。上流 error / fork warn、例外は守りの lib の中だけ
      "import-boundaries/router-via-guard": libOwnership.isRoot ? "error" : "warn",
      // radix-unified: Radix は統合版の radix-ui から読む(@radix-ui/* の個別パッケージは依存から外した)。上流 error / fork warn
      // (Primitives の外の @radix-ui/* の値の import は ui-libs-in-primitives の受け持ち。ここは Primitives の中と型だけの import)
      "import-boundaries/radix-unified": libOwnership.isRoot ? "error" : "warn",
    },
  },
  // - client-no-domain-json: client のコードはドメインの宣言(domain.json・entity.json)を import しない(写しを読む。判定はプラグインの中)
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/client-no-domain-json": "error",
      // ui-libs-in-primitives: radix-ui・@radix-ui/*・cmdk・react-day-picker(/*)・embla-carousel* を値で読むのは src/components/Primitives の中だけ
      // (D233、例外なし。テストも lib も対象、上流も fork も error)。Primitives の外の @radix-ui/* の値の import もここが報告する
      "import-boundaries/ui-libs-in-primitives": "error",
    },
  },
  // hooks-utils-no-domains: src/hooks・src/utils → src/domains は値も型も禁止(D87、district-no-domains と同じくテストは対象外)。上流も fork も error
  {
    files: ["src/hooks/**/*.{ts,tsx,mts,mjs}", "src/utils/**/*.{ts,tsx,mts,mjs}"],
    ignores: ["src/hooks/**/*.test.{ts,tsx,mts,mjs}", "src/utils/**/*.test.{ts,tsx,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/hooks-utils-no-domains": "error",
    },
  },
  // shelf-purity: 棚(src/components)は features・app・wiring・registry・stores・services・フォームとデータの lib・SDK と SDK を包む lib・
  // 棚を値で読む lib(src/lib の実際の import から求める)を値で読まず、fetch を呼ばない(D50)。型だけは可、テストは対象外。上流も fork も error
  {
    files: ["src/components/**/*.{ts,tsx,mts,mjs}"],
    ignores: ["src/components/**/*.test.{ts,tsx,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/shelf-purity": "error",
    },
  },
  {
    files: ["src/domains/**/index.{ts,tsx}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/domains-index-no-server-reexport": "error",
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
  // district-no-domains: ゲートの無い地区(lib・枠・門番・登録表・結線・proxies)と src/proxy.ts・src/instrumentation.ts → src/domains/** は値も型も禁止
  // (地区の議会 D22、lib だけを見た前の規則を広げた 1 本。どのファイルが地区かは規則が地区の地図の読み手で決める。生成物・テスト・__tests__/ の補助は対象外)。上流も fork も error
  // points-entry: 差す側の項目(plugs/**)は点の約束の型を持ち主の型だけの入口 points から読み、枠・proxies の値を読まない。points.ts は型だけ(D33)
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}"],
    ignores: ["src/**/*.test.{ts,tsx,mts,mjs}", "src/**/__tests__/**"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/district-no-domains": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx,mts}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/points-entry": "error",
    },
  },
  // 見出しの直下の <Span> に size / weight を書かせる(Span の既定 text-base font-normal が見出しを上書きするため。
  // 詳細: eslint-rules/style-tokens.mjs span-in-heading, src/components/TextBlocks/README.md)。
  // 下流の画面(app/ と domains/<business>)は warn。upstream 所有の UI は下の style-tokens ブロックで error に上書きする。
  {
    files: ["src/app/**/*.tsx", "src/domains/**/*.tsx"],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/span-in-heading": "warn",
    },
  },
  // 生パレット色(bg-slate-900 / text-white / bg-[#fff] 等)の禁止。色はテーマトークンで書く
  // 同じ範囲で意味色の素の文字 text-success / text-info / text-warning / text-destructive も禁止(no-bare-semantic-text。CLAUDE.md semantic_colors)。
  // (詳細: eslint-rules/style-tokens.mjs, src/styles/README.md)。
  // upstream 所有の UI(共有 UI・core ドメイン・ドメイン雛形)は error。下流固有 UI(domains/<business>, app/)は対象外
  // (下流が同じ規律を敷きたい場合は files にパスを足す)。
  // 除外: Three(3D 演出) / gradient(トークン生成元)。
  // ブランドロゴ色・ユーザーが選ぶ固定パレットなど正当な例外は理由付き eslint-disable で明示する。
  // 枠の既定部品(src/app/**/_layout/。AppFrames から移した物)も upstream 所有の UI として error。
  // 隣に置く fork の丸ごと置き換え(<Name>.replace.tsx)は ignores で外し、上の app/ の warn に従う。
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/domains/core/**/*.{ts,tsx}",
      "src/domains/_template/**/*.{ts,tsx}",
      "src/app/**/_layout/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/lib/gradient/**",
      "src/app/**/_layout/**/*.replace.{ts,tsx}",
    ],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/no-raw-palette": "error",
      "style-tokens/no-bare-semantic-text": "error",
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
            "style-tokens/no-bare-semantic-text": "warn",
            "style-tokens/span-in-heading": "warn",
          },
        },
      ]
    : []),
  // 当議会 D133 の検査(詳細: eslint-rules/import-boundaries.mjs の各節、eslint-rules/asset-paths.mjs):
  // - axios-in-client-layer: axios は src/lib/** と **/services/client/** だけ。上流 error / fork warn(テストは対象外)
  // - asset-paths/no-literal-asset-path: 資産のパスは src/utils/assets.ts の関数で組む。上流 error / fork warn(組み立て役とテストは対象外)
  // - mail-send-via-messaging: lib/mail の send は messaging の送り口と確認の道具 pnpm ops mail test-send だけ。全 Tier error(必須の規則の一覧)
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/axios-in-client-layer": libOwnership.isRoot ? "error" : "warn",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/utils/assets.ts"],
    plugins: { "asset-paths": assetPathsPlugin },
    rules: {
      "asset-paths/no-literal-asset-path": libOwnership.isRoot ? "error" : "warn",
    },
  },
  // 生の要素(当議会 D182・D208。詳細: eslint-rules/raw-elements.mjs): 包みの部品がある HTML の要素を生で書かない。
  // 上流リポ(目録の先頭の節)だけ error、fork は off(fork の既存の生の要素は直させない)。必須の規則の一覧には載せない(Tier で強さが変わる)。
  // 対象外: 包みそのもの src/components/** とテスト。包みで同じ形にできない 1 か所だけの物は理由つきの行ごとの eslint-disable(toast = D208)
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/**", "src/**/*.test.tsx", "src/**/__tests__/**"],
    plugins: { "raw-elements": rawElementsPlugin },
    rules: {
      "raw-elements/no-raw-element": libOwnership.isRoot ? "error" : "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}", "scripts/**/*.{ts,mts,mjs}"],
    plugins: { "import-boundaries": importBoundariesPlugin },
    rules: {
      "import-boundaries/mail-send-via-messaging": "error",
    },
  },
  // 改名・移動済み module の旧パス import を警告する(詳細: eslint-rules/deprecated-imports.mjs)。
  // upstream が改名したとき、旧パスには再 export の shim が 1 checkpoint だけ残る。warn の間に新パスへ直す
  // (次の checkpoint で shim が消えると tsc が止める)。下流が自分の改名で使ってもよい(paths に足す)。
  // 現在の一覧 = 部品の棚 Primitives へ移した物(計画書 02、checkpoint primitives-radix で旧パスは shim なしで削除済み)と、
  // stores の廃止で閉じた lib へ移した物(checkpoint stores-removal、同じく shim なし。
  // 旧パスの import は tsc も止めるので、ここは置き換え先の案内だけ)と、棚の場所の整理で消した入口・動かした物(checkpoint shelf-s1、
  // 同じく shim なし。入口の行は exact: 配下の部品のファイル @/components/<Category>/<Unit> は検出しない。直し方は
  // .notices/20261120-150000-shelf-s1.places.mjs が名前ごとに分ける)と、Form をほどいて Button・Input の単位へ移した物(checkpoint shelf-s2、
  // 同じく shim なし。直し方は .notices/20261120-160000-shelf-s2.shelf.mjs)。
  // 書式: { from: "@/domains/...", to: "@/domains/...", until: "checkpoint <label> の次"[, exact: true | collapse: true] }
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "deprecated-imports": deprecatedImportsPlugin },
    rules: {
      "deprecated-imports/no-deprecated-path": [
        "warn",
        {
          paths: [
            { from: "@/components/_shadcn/checkbox", to: "@/components/Primitives/Checkbox", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/radio-group", to: "@/components/Primitives/RadioGroup", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/select", to: "@/components/Primitives/Select", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/label", to: "@/components/Primitives/Label", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/input", to: "@/components/Primitives/Input", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/textarea", to: "@/components/Primitives/Input", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/button", to: "@/components/Primitives/Button", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/badge", to: "@/components/Primitives/Badge", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/tabs", to: "@/components/Primitives/Tabs", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/skeleton", to: "@/components/Primitives/Skeleton", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/calendar", to: "@/components/Primitives/Calendar", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/carousel", to: "@/components/Primitives/Carousel", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/dialog", to: "@/components/Primitives/Dialog", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/command", to: "@/components/Primitives/Command", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/popover", to: "@/components/Primitives/Popover", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/tooltip", to: "@/components/Primitives/Tooltip", until: PRIMITIVES_REMOVED },
            { from: "@/components/_shadcn/table", to: "@/lib/tableSuite", until: SHADCN_REMOVED },
            { from: "@/components/Overlays/DialogPrimitives", to: "@/components/Primitives/Dialog", until: PRIMITIVES_REMOVED },
            { from: "@/components/Overlays/CommandPrimitives", to: "@/components/Primitives/Command", until: PRIMITIVES_REMOVED },
            { from: "@/components/Overlays/Popover/PopoverPrimitives", to: "@/components/Primitives/Popover", until: PRIMITIVES_REMOVED },
            { from: "@/components/Badge/BadgeCore", to: "@/components/Primitives/Badge", until: PRIMITIVES_REMOVED },
            { from: "@/stores/viewportSize", to: "@/lib/viewport", until: STORES_REMOVED },
            { from: "@/hooks/useViewportOrientation", to: "@/lib/viewport", until: STORES_REMOVED },
            { from: "@/hooks/useMediaQuery", to: "@/lib/viewport", until: STORES_REMOVED },
            { from: "@/components/Fanctional/ViewportHeightWatcher", to: "@/lib/viewport", until: STORES_REMOVED },
            { from: "@/stores/siteTheme", to: "@/lib/siteTheme", until: STORES_REMOVED },
            { from: "@/utils/siteTheme", to: "@/lib/siteTheme", until: STORES_REMOVED },
            { from: "@/components/Fanctional/SiteThemeSync", to: "@/lib/siteTheme", until: STORES_REMOVED },
            { from: "@/components/Fanctional", to: "@/components/Functional", until: FUNCTIONAL_RENAMED },
            { from: "@/stores/globalLoader", to: "@/lib/globalLoader", until: STORES_REMOVED },
            { from: "@/hooks/useGlobalLoader", to: "@/lib/globalLoader", until: STORES_REMOVED },
            { from: "@/components/Overlays/Loading/GlobalScreenLoader", to: "@/lib/globalLoader", until: STORES_REMOVED },
            { from: "@/components/Providers/RecaptchaProvider", to: "@/lib/recaptcha", until: STORES_REMOVED },
            { from: "@/components/TextBlocks", to: "@/components/TextBlocks/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Navigation", to: "@/components/Navigation/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Badge", to: "@/components/Badge/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Layout", to: "@/components/Layout/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Icons", to: "@/components/Icons/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Widgets", to: "@/components/Widgets/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Animation", to: "@/components/Animation/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Functional", to: "@/components/Functional/<Unit>", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Layout/spacing", to: "@/lib/spacing", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Layout/spacingScale", to: "@/lib/spacing", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Layout/spacingClasses.generated", to: "@/lib/spacing", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Layout/commonVariants", to: "@/components/Layout/appearance", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/AppFrames/Kiosk", to: "@/components/Layout/KioskFrame", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/AppFrames/Kiosk/KioskFrame", to: "@/components/Layout/KioskFrame", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/Functional/BodyPortal", to: "@/components/Overlays/BodyPortal", until: SHELF_S1_MOVED, exact: true },
            { from: "@/hooks/useHeaderHeight", to: "@/app/_layout/useHeaderHeight", until: SHELF_S1_MOVED, exact: true },
            { from: "@/components/AppFrames/Admin/Elements", to: "@/components/Admin", until: SHELF_S1_MOVED },
            // shelf-s2: 入口と名前ごとに行き先が分かれた物は exact を先に(後ろの prefix の行より先に当たる)
            { from: "@/components/Form/Button", to: "@/components/Button/<Unit>", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Form/Button/button-variants", to: "@/components/Button/variants", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Form/Button/tablet-button-variants", to: "@/components/Button/variants", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Form/Button", to: "@/components/Button", until: SHELF_S2_MOVED },
            { from: "@/components/Form/Input/Manual", to: "@/components/Input/<Unit>", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Form/Input/Manual", to: "@/components/Input", until: SHELF_S2_MOVED },
            { from: "@/components/Form/Label", to: "@/components/Input/Label", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Form/FilePickButton", to: "@/components/Input/FilePickButton", until: SHELF_S2_MOVED },
            { from: "@/components/Form/utils", to: "@/components/Input/options", until: SHELF_S2_MOVED, exact: true },
            // 注文 09: Form の残りは閉じた lib formSuite の入口 1 本、MediaHandler は mediaInputSuite(上の行より後 = 先に上の行が当たる)
            { from: "@/components/Form/MediaHandler", to: "@/lib/mediaInputSuite", until: SHELF_S2_MOVED, collapse: true },
            { from: "@/components/Form", to: "@/lib/formSuite", until: SHELF_S2_MOVED, collapse: true },
            // 注文 10: useRelationOptions は formSuite へ(残る入口の中で動いた名前は tsc が挙げる)
            { from: "@/lib/domain/hooks/useRelationOptions", to: "@/lib/formSuite", until: SHELF_S2_MOVED, exact: true },
            // 注文 11: 棚の単位の中のファイルの道は単位の入口へ(lint entry/only-entries も止める)。Widgets/_shared は SliderParts
            { from: "@/components/Overlays/Loading/InlineLoader", to: "@/components/Overlays/Loading", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Loading/ScreenLoader", to: "@/components/Overlays/Loading", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Loading/Spinner", to: "@/components/Overlays/Loading", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/DetailModal/DetailModal", to: "@/components/Overlays/DetailModal", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/DetailModal/types", to: "@/components/Overlays/DetailModal", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/Popover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/ConfirmPopover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/PromptPopover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/ActionPopover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/InfoPopover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/ChecklistPopover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/SelectPopover", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/Popover/PopoverAsyncContent", to: "@/components/Overlays/Popover", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/ImageViewer/Provider", to: "@/components/Overlays/ImageViewer", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/ImageViewer/ZoomableImage", to: "@/components/Overlays/ImageViewer", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Overlays/ImageViewer/context", to: "@/components/Overlays/ImageViewer", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Primitives/Carousel/Carousel", to: "@/components/Primitives/Carousel", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Input/AsyncOptionSource/AsyncOptionListStates", to: "@/components/Input/AsyncOptionSource", until: SHELF_S2_MOVED, exact: true },
            { from: "@/components/Widgets/_shared", to: "@/components/Widgets/SliderParts", until: SHELF_S2_MOVED, collapse: true },
            { from: "@/components/Functional/FirebaseAnalytics", to: "@/app/_mounts/FirebaseAnalytics", until: SHELF_S2_MOVED, exact: true },
            // 注文 12(区切り shelf-s3): 置き換え .notices/20261120-170000-shelf-s3.small.mjs
            { from: "@/utils/object", to: "@/lib/crud/server", until: SHELF_S3_MOVED, exact: true },
            { from: "@/utils/json", to: "@/lib/firebase", until: SHELF_S3_MOVED, exact: true },
            { from: "@/hooks/useAppStatus", to: "@/lib/appStatus", until: SHELF_S3_MOVED, exact: true },
            { from: "@/components/AppStatusGuard", to: "@/lib/appStatus(useAppStatus を部品の本体で呼ぶ)", until: SHELF_S3_MOVED, exact: true },
            { from: "@/components/Functional/DarkModeSwitch", to: "@/lib/siteTheme(useDarkModeSwitch + @/components/Button/Button)", until: SHELF_S3_MOVED, exact: true },
          ],
        },
      ],
    },
  },
  // UI から ClientService を直接 import しない(HTTP は Hook → ClientService。詳細: eslint-rules/client-service-boundary.mjs)。
  // 下流の UI(domains/<business>/components, app/ の画面)は warn、upstream 所有の UI は error(後のブロックが上書き)。
  // 除外: app/api(UI ではない) / demo(エンジンに fetcher を渡す使い方の見本)。
  // セッション状態の持ち主の Provider など正当な例外は理由付き eslint-disable で明示する。
  {
    files: ["src/domains/**/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**", "src/app/(user)/demo/**"],
    plugins: { "client-service-boundary": clientServiceBoundaryPlugin },
    rules: {
      "client-service-boundary/no-direct-import": "warn",
    },
  },
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/domains/core/**/components/**/*.{ts,tsx}",
      "src/domains/_template/**/components/**/*.{ts,tsx}",
      "src/app/**/_layout/**/*.{ts,tsx}",
    ],
    // 枠の既定部品は upstream 所有の UI。隣の丸ごと置き換え(<Name>.replace.tsx)は上の app/ の warn
    ignores: ["src/app/**/_layout/**/*.replace.{ts,tsx}"],
    plugins: { "client-service-boundary": clientServiceBoundaryPlugin },
    rules: {
      "client-service-boundary/no-direct-import": "error",
    },
  },
  // 型の表の外で fieldType の名前を比べない（番人。詳細: eslint-rules/field-type-guard.mjs・src/lib/domain/README.md「番人」）。
  // 強さはリポジトリ単位: 上流リポ（目録の先頭の節）= error、fork = warn（fork に残る上流の旧版の写しで fork の lint を止めない）。
  // 対象外: 表そのもの（src/lib/domain/fields/）・型名の union（Field/types.ts。表との突き合わせは pnpm test src/lib/formSuite/FieldRenderer/defaultValueBuilder.test.ts）・テストだけ。
  // 決め打ちの許可リストは無い（型の答えが要る所は表の属性・述語を足して引く）
  {
    files: ["src/**/*.{ts,tsx}", "scripts/structure/**/*.mjs"],
    ignores: [
      "src/lib/domain/fields/**",
      "src/lib/formSuite/Field/types.ts",
      "**/*.test.{ts,tsx,mjs,mts}",
      "scripts/structure/domain/tests/**",
    ],
    plugins: { "field-type-guard": fieldTypeGuardPlugin },
    rules: {
      "field-type-guard/no-literal-field-type": libOwnership.isRoot ? "error" : "warn",
    },
  },
  // IntersectionObserver を直書きしない: 要素の表示の監視は @/hooks/useInView に寄せる(棚の評議会 D148。
  // 詳細: eslint-rules/intersection-observer.mjs)。強さはリポジトリ単位: 上流リポ = error、fork = warn。
  // 対象外: useInView 自身・useInfiniteScrollQuery の番兵(役目が違うので寄せない)・テスト
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/hooks/useInView.ts", "src/hooks/useInfiniteScrollQuery.ts", "**/*.test.{ts,tsx,mjs,mts}"],
    plugins: { "intersection-observer": intersectionObserverPlugin },
    rules: {
      "intersection-observer/via-use-in-view": libOwnership.isRoot ? "error" : "warn",
    },
  },
  // <Activity>(cacheComponents)は離れたページの状態と ref を保ち、戻ると effect を走らせ直す。ref の守りの 1 回だけの初期化を
  // 戻す所なしに書かない(core/client.md activity_state。詳細: eslint-rules/activity.mjs)。強さはリポジトリ単位: 上流リポ = error、fork = warn
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx,mjs,mts}"],
    plugins: { activity: activityPlugin },
    rules: {
      "activity/once-ref-guard": libOwnership.isRoot ? "error" : "warn",
    },
  },
  // 段階の読み手は 1 つだけ(本部 D178。詳細: eslint-rules/app-env.mjs, src/lib/appEnv/README.md)。process.env.APP_ENV / NODE_ENV を
  // 直接読まず @/lib/appEnv を通す。テストも対象(差し替えは withAppEnv)。対象外 = 読み手の src/lib/appEnv/ だけ。
  // 強さはリポジトリ単位: 上流リポ = error、fork = warn
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}", "scripts/**/*.{ts,mts,mjs}", "servers/**/*.{ts,mts,mjs}", "*.config.{ts,mjs}"],
    ignores: ["src/lib/appEnv/**"],
    plugins: { "app-env": appEnvPlugin },
    rules: {
      "app-env/single-reader": libOwnership.isRoot ? "error" : "warn",
    },
  },
  // hook を使うファイルは先頭に "use client"(core/components.md use_client。詳細: eslint-rules/use-client.mjs)。
  // 無いファイルがサーバーのコンポーネントから届くと本番のビルドが落ちる。ビルドを止める守りなので全 Tier で error(fork 分岐なし)
  {
    files: ["src/**/*.{ts,tsx}"],
    // テストと、テストだけが読む門番の検査の道具(src/featureGate/checks/、node:assert で描いて確かめる)
    ignores: ["**/*.test.*", "src/featureGate/checks/**"],
    plugins: { "use-client": useClientPlugin },
    rules: {
      "use-client/hooks-need-directive": "error",
    },
  },
  // 生の sql`` に JS の Date を埋め込まない(CLAUDE.md core/services.md raw_sql。Postgres が読めずクエリの時に落ちる)。
  // .toISOString() で渡すか Drizzle の演算子を使う。クエリが落ちるのを止める守りなので upstream・下流とも error(fork 分岐なし)。
  // 詳細: eslint-rules/raw-sql-date.mjs, src/lib/crud/drizzle/query/README.md「落とし穴」
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}", "scripts/**/*.{ts,mts,mjs}"],
    plugins: { "raw-sql-date": rawSqlDatePlugin },
    rules: {
      "raw-sql-date/no-date-param": "error",
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
        { hiddenColumns: collectHiddenColumns(import.meta.dirname) },
      ],
    },
  },
  // UI の場所はサーバーのデータを取らない(M4 を D73 K1 の範囲へ。詳細: eslint-rules/page-authz.mjs, src/domains/core/auth/README.md)。
  // 対象 = src/app の Screen・page・layout・_layout・guard.ts・_components の部品と components・hooks。services/server・DB(L1.20)を
  // 値で import しない(型は可)。取得は同じルートの loader(guard.ts の createLoader)へ。loader.ts・route.ts・API は対象外。
  // domains/**/hooks は React の hook(層 3)の意味。services/server/**/hooks 等のサーバーのコードは UI ではないので外す。
  // 名前付き例外 = AuthSessionProvider(Cookie の解析とセッション解決)。セキュリティの検査なので upstream・下流とも error(fork 分岐なし)。
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/domains/**/components/**/*.{ts,tsx}",
      "src/domains/**/hooks/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/app/**/loader.ts",
      "src/app/**/route.{ts,tsx}",
      "src/app/api/**",
      "src/domains/**/services/server/**",
      "src/domains/core/auth/components/AuthSessionProvider.tsx",
    ],
    plugins: { "page-authz": pageAuthzPlugin },
    rules: {
      "page-authz/layout-no-server-data": "error",
    },
  },
  // セッション・ガード API(authGuard・getSessionUser・requireCurrentUser 等)をページ層・UI・API で import しない(M3、D73 K4・K5)。
  // 対象 = src/app 全体(page・Screen・layout・_layout・loader.ts・guard.ts・_components・API)と UI 側。許可の場所は無い:
  // ページの主体は guard.ts の createLoader が loader の ctx.user で渡し、範囲の守りは guard()。API の主体は Factory の ctx.user(D8 K4)。
  // proxy の骨組み(src/proxies/**)と項目(<ドメイン>/plugs/proxyHandlers・proxyDecorators・proxyRedirects、上流・fork)の主体は proxy.ts が渡す ctx.user()(D10)。解決器を作る src/proxy.ts と項目 plugs/proxyUser は対象外。
  // 門番(src/featureGate/**、規則と判定。proxy の鎖に載る)もセッションを解かない(規則は config だけを読む)。
  // AuthSessionProvider は認証基盤の名前付き例外(root layout の Provider)。
  // セキュリティの検査なので upstream・下流とも error(fork 分岐なし)。詳細: eslint-rules/page-authz.mjs
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/domains/**/components/**/*.{ts,tsx}",
      "src/domains/**/hooks/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/proxies/**/*.{ts,tsx,mts,mjs}",
      // proxy の項目は各ドメインの plugs の点の下(D30、注文 31)。利用者の解き方の項目 plugs/proxyUser は対象外(解決器そのもの)
      "src/domains/**/plugs/proxyHandlers/**/*.{ts,tsx,mts,mjs}",
      "src/domains/**/plugs/proxyDecorators/**/*.{ts,tsx,mts,mjs}",
      "src/domains/**/plugs/proxyRedirects/**/*.{ts,tsx,mts,mjs}",
      "src/featureGate/**/*.{ts,tsx,mts,mjs}",
    ],
    ignores: [
      "src/domains/core/auth/components/AuthSessionProvider.tsx",
      // サーバーのコード(services/server/**/hooks 等)は UI の hooks ではない。core の分は次の項目で見る
      "src/domains/**/services/server/**",
    ],
    plugins: { "page-authz": pageAuthzPlugin },
    rules: {
      "page-authz/session-api-callsite": "error",
    },
  },
  // core のサービスもセッションを読まない(主体は呼び手が引数で渡す)。主体を解く基盤だけ外す。
  // fork のサービスは対象外: 自前のドメインで読んでいる fork があり、別の依頼で判断する。
  // 上の UI の項目と分けているのは、flat config の ignores が項目全体に効くため(UI 側で services/server を外すと core の分まで外れる)
  {
    files: ["src/domains/core/**/services/server/**/*.{ts,tsx}"],
    ignores: [
      "src/domains/core/auth/services/server/**",
      "src/domains/core/pairedDevice/services/server/session/**",
    ],
    plugins: { "page-authz": pageAuthzPlugin },
    rules: {
      "page-authz/session-api-callsite": "error",
    },
  },
  // server action の禁止(全 Tier で error。詳細: eslint-rules/no-server-action.mjs)
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}"],
    plugins: { "no-server-action": noServerActionPlugin },
    rules: {
      "no-server-action/no-server-action": "error",
    },
  },
  // core の部品と既定 Screen の部品(src/app/**/_screen/)は useForm と守りの処理(reCAPTCHA・ID トークン・
  // セッション更新・遷移の守り・コンバージョン計測)と取得・送信(SWR の hook・client 関数の import)を直接持たない。
  // 持ち主ドメインの公開 hook に置く(詳細: eslint-rules/core-ui-guards.mjs)。
  // upstream(目録の先頭の節)だけ error、fork では off(fork に残る上流の旧版の部品で fork の lint を止めない)。
  // 除外: demo(lib の使い方の見本。useForm・getIdToken を直に使って見せる)。
  // 許可一覧 eslint-rules/core-ui-guards.allow.mjs は縮める一方(部品を hook 化したらその行を消す。足すのは規則を広げた時だけ)。
  {
    files: ["src/domains/core/**/components/**/*.tsx", "src/app/**/_screen/**/*.tsx"],
    ignores: ["src/app/(user)/demo/**"],
    plugins: { "core-ui-guards": coreUiGuardsPlugin },
    rules: {
      "core-ui-guards/no-guard-in-part": libOwnership.isRoot ? ["error", { allow: CORE_UI_GUARDS_ALLOW }] : "off",
    },
  },
  // ルームロジック (servers/room にバンドルされる) の純度制約。
  // Node/Next/DB import を静的に遮断する (詳細: eslint-rules/realtime-room-purity.mjs)。
  {
    files: ["src/domains/**/room/**/*.ts"],
    plugins: { "realtime-room": realtimeRoomPlugin },
    rules: {
      "realtime-room/purity": "error",
    },
  },
  // ドメインの config.ts の読み込み(地区の議会 D28): @/lib/defineConfig・自分の上書き・zod と型だけ。全 Tier error
  {
    files: ["src/domains/**/config.ts"],
    plugins: { "config-overrides": configOverridesPlugin },
    rules: {
      "config-overrides/config-imports": "error",
    },
  },
  // 上書きファイル(src/config/{lib,domains,layout} と中身の名前で置く上書き featureGate)の 2 規則(設定 D34・D35・D38・D91・L1.19・L1.31。詳細: eslint-rules/config-overrides.mjs, src/config/README.md)。
  // 新しいフォルダだけが対象なので全 Tier error(縮む表なし)。fork に残る古い src/config/app・ui・documents と直下のファイルには掛けない
  // - literal-only: 上書きは値のリテラル。読めるのは型・process.env・@/business・持ち主が overrideImports で宣言した指定子だけ
  // - owner-reads-only: 上書きを読めるのは持ち主の config.ts(描画用は config.ui.ts)だけ。lib の中は entry/only-entries の持ち分
  {
    files: ["src/config/{lib,domains,layout,featureGate}/*.config.ts"],
    plugins: { "config-overrides": configOverridesPlugin },
    rules: {
      "config-overrides/literal-only": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx,mts,mjs}", "scripts/**/*.{ts,mts,mjs}"],
    plugins: { "config-overrides": configOverridesPlugin },
    rules: {
      "config-overrides/owner-reads-only": "error",
    },
  },
];

export default config;
