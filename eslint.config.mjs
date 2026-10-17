import nextConfig from "eslint-config-next";

import auditPlugin from "./eslint-rules/audit-action-naming.mjs";
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
  // 共有 UI は error。core ドメイン UI は色スイープ(Step 4)完了まで warn。下流固有 UI(features/<business>, app/)は対象外。
  // 除外: _shadcn(vendored。見た目はラッパー側が上書きする) / Three(3D 演出) / gradient(トークン生成元)。
  // ブランドロゴ色など正当な例外は理由付き eslint-disable-next-line で明示する。
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    ignores: ["src/components/_shadcn/**", "src/components/Three/**", "src/lib/gradient/**"],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/no-raw-palette": "error",
    },
  },
  {
    files: ["src/features/core/**/*.{ts,tsx}"],
    plugins: { "style-tokens": styleTokensPlugin },
    rules: {
      "style-tokens/no-raw-palette": "warn",
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
