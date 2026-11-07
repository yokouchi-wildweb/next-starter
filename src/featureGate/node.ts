// src/featureGate/node.ts
// 門番の道具の入口(scripts と test だけが読む。proxy・アプリからは読まない)。
// - rules: 規則の一覧(生成一覧を全開スイッチで包んだ物。名前・tables 付き、ruleList.ts)
// - gatedSchema: db:push / db:push:check に渡す入力(閉じた機能の表を両側から外す)
// - closedTables: 今閉じている機能の表名
// - dependencyExceptions: 依存の検査の例外(fork の受け口)
// - describeFeatures / readFeatureReport: 規則ごとの説明(pnpm features:list)
// - planFeatureSet / applyFeatureSet: 入切の書き換え(pnpm features:set。ドメインの config の <X>_CONFIG.enabled の形だけ)
// - readRequired: 必須の機能(required/)
// - Tier1 の判別: 注入(next.config の FEATURE_GATE_TIER1)の無い node で全開スイッチが Tier1 を知る読み手を渡す(node/tier1.ts、読むだけで効く)
// - gate: server の道具の束(@/featureGate の gate と同じ物。scripts から gate.path・gate.enabled を呼ぶ。例 cron のタスクの住所の判定 scripts/cron/discover.ts)

import "./node/tier1";

export { serverTools as gate } from "./tools/server";
export { rules } from "./ruleList";
export { alwaysOnExceptions } from "./extensions/alwaysOnExceptions";
export { alwaysOnRegistries } from "./extensions/alwaysOnRegistries";
export { dependencyExceptions } from "./extensions/dependencyExceptions";
export { applySchemaGate as gatedSchema, closedTables, type SchemaGateResult } from "./node/gatedSchema";
export { describeFeatures, readFeatureReport, readRequired, type FeatureDescription } from "./node/describe";
export { applyFeatureSet, planFeatureSet, planFeatureSetFromText, type FeatureSetPlan } from "./node/setEnabled";
