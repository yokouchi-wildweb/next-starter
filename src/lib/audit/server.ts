// src/lib/audit/server.ts — 監査コンテキスト(node の AsyncLocalStorage)の入口。server だけが読む
// routeFactory・cron・task の入口がスコープを開き、server のコードが getAuditContext() で読む。

export {
  runWithAuditContext,
  getAuditContext,
  requireAuditContext,
  runAsSystem,
} from "./context";
