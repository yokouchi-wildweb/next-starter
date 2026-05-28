import nextConfig from "eslint-config-next";

import auditPlugin from "./eslint-rules/audit-action-naming.mjs";

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
];
