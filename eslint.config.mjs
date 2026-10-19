import nextConfig from "eslint-config-next";

import auditPlugin from "./eslint-rules/audit-action-naming.mjs";
import clientServiceBoundaryPlugin from "./eslint-rules/client-service-boundary.mjs";
import deprecatedImportsPlugin from "./eslint-rules/deprecated-imports.mjs";
import realtimeRoomPlugin from "./eslint-rules/realtime-room-purity.mjs";
import routeAuthzPlugin from "./eslint-rules/route-authz.mjs";
import styleTokensPlugin from "./eslint-rules/style-tokens.mjs";

export default [
  ...nextConfig,
  {
    ignores: [
      "src/_stash/**",
      ".firebase/**",
      ".next/**",
      "node_modules/**",
    ],
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
  // カスタム API ルート（createApiRoute 直接利用）の認可漏れ検出。
  // 汎用ルート（createDomainRoute）は domain.json の apiAccess で守られるが、
  // 手書きルートは fail-open なため、認可・session 参照の痕跡が無ければ警告する。
  // 未認証で公開するのが正当なルートは理由付き eslint-disable で明示する。
  {
    files: ["src/app/api/**/route.{ts,tsx}"],
    plugins: { "route-authz": routeAuthzPlugin },
    rules: {
      "route-authz/require-authz": "warn",
    },
  },
  // 生パレット色(bg-slate-900 / text-white / bg-[#fff] 等)の禁止。色はテーマトークンで書く
  // (詳細: eslint-rules/style-tokens.mjs, src/styles/README.md)。
  // upstream 所有の UI(共有 UI・core ドメイン・ドメイン雛形)は error。下流固有 UI(features/<business>, app/)は対象外
  // (下流が同じ規律を敷きたい場合は files にパスを足す)。
  // 除外: _shadcn(vendored。見た目はラッパー側が上書きする) / Three(3D 演出) / gradient(トークン生成元)。
  // ブランドロゴ色・ユーザーが選ぶ固定パレットなど正当な例外は理由付き eslint-disable で明示する。
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/features/core/**/*.{ts,tsx}",
      "src/features/_template/**/*.{ts,tsx}",
    ],
    ignores: ["src/components/_shadcn/**", "src/components/Three/**", "src/lib/gradient/**"],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/no-raw-palette": "error",
    },
  },
  // _shadcn の直接 import 禁止(CLAUDE.md PROHIBITED)。ラッパーは src/components に置く。
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
  // 現在の一覧 = 空(ui-layers-rename の旧パスは checkpoint ui-layers-shim-removal で shim ごと削除済み)。
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
    ],
    plugins: { "client-service-boundary": clientServiceBoundaryPlugin },
    rules: {
      "client-service-boundary/no-direct-import": "error",
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
];
