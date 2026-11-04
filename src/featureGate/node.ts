// src/featureGate/node.ts
// 門番の道具の入口(scripts と test だけが読む。proxy・アプリからは読まない)。
// - rules: 規則の生成一覧(名前・tables 付き)
// - gatedSchema: db:push / db:push:check に渡す入力(閉じた機能の表を両側から外す)
// - closedTables: 今閉じている機能の表名
// - dependencyExceptions: 依存の検査の例外(fork の受け口)
// - gate: server の道具の束(@/featureGate の gate と同じ物。scripts から gate.path・gate.enabled を呼ぶ。例 cron のタスクの住所の判定 scripts/cron/discover.ts)

export { serverTools as gate } from "./tools/server";
export { rules } from "./extensions/rules";
export { alwaysOnExceptions } from "./extensions/alwaysOnExceptions";
export { alwaysOnRegistries } from "./extensions/alwaysOnRegistries";
export { dependencyExceptions } from "./extensions/dependencyExceptions";
export { applySchemaGate as gatedSchema, closedTables, type SchemaGateResult } from "./node/gatedSchema";
