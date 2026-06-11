import nextConfig from "eslint-config-next";

import auditPlugin from "./eslint-rules/audit-action-naming.mjs";
import routeAuthzPlugin from "./eslint-rules/route-authz.mjs";

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
];
