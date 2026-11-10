// src/featureGate/node.ts
// 門番の道具の入口(scripts と test だけが読む。proxy・アプリからは読まない)。
// - rules: 規則の一覧(生成一覧を全開スイッチで包んだ物。名前・tables 付き、ruleList.ts)。db:push・seed・pnpm ops db clear・pnpm ops features list が読む
// - configRules / configEnabled / configPath: 規則の値だけ(スイッチを通さない)。cron・pnpm generate routes・検査・codemod が読む(L2.3)
// - isOpenedBySwitch: 全開スイッチで開いているか(pnpm ops features list の見せ方)
// - gatedDomains / derivedPaths / closedDomainsOf / domainEnabled / closedDerivedEntries: ドメインの開閉と導出の住所(汎用 API・cron。D24・D34 K4)
// - withCoveredPatterns: 規則の pathPatterns に規則のドメインの導出の住所を足した写し(住所で覆うかを見る検査の入力)
// - ownEnabled / switchMissingDependencies: 規則の値そのもの(スイッチも依存先も通さない)・名前指定のスイッチの足りない依存先(同じく見せ方)
// - gatedSchema: db:push / db:push:check に渡す入力(閉じた機能の表を両側から外す)
// - closedTables: 今閉じている機能の表名
// - dependencyExceptions: 依存の検査の例外(fork の受け口)
// - describeFeatures / readFeatureReport: 規則ごとの説明(pnpm ops features list)
// - planFeatureSet / applyFeatureSet: 入切の書き換え(pnpm ops features set。fork = src/config/featureGate/switches.config.ts、Tier1 = 規則の defaultEnabled。必須の機能が依存する機能の off は止める)
// - readRequired: 必須の機能(required/)
// - checkAddresses: 読み込み後の一覧の住所の検査(二重書き・入れ子の依存の欠け、D25・D31)
// - checkFeatureRequirements: 機能を要する設定の値の検査(設定 D110、門 build の pnpm check proxies)
// - gate: server の道具の束(@/featureGate の gate と同じ物。scripts から gate.path・gate.enabled を呼ぶ。cron のタスクの住所の判定は configPath)
// - Tier1 の判別: 注入(next.config の FEATURE_GATE_TIER1)の無い node で全開スイッチが Tier1 を知る読み手を渡す(node/tier1.ts、読むだけで効く)
import "./node/tier1";

export { serverTools as gate } from "./tools/server";
export {
  closedDerivedEntries,
  closedDomainsOf,
  configEnabled,
  configRules,
  derivedPaths,
  domainEnabled,
  gatedDomains,
  isOpenedBySwitch,
  ownEnabled,
  rules,
  switchMissingDependencies,
  withCoveredPatterns,
} from "./ruleList";
export { configPath } from "./node/configPath";
export { ADDRESS_EXCEPTIONS, checkAddresses } from "./node/addressCheck";
export { alwaysOnExceptions } from "./extensions/alwaysOnExceptions";
export { alwaysOnRegistries } from "./extensions/alwaysOnRegistries";
export { dependencyExceptions } from "./extensions/dependencyExceptions";
export { applySchemaGate as gatedSchema, closedTables, type SchemaGateResult } from "./node/gatedSchema";
export { describeFeatures, readFeatureReport, readRequired, type FeatureDescription } from "./node/describe";
export { checkFeatureRequirements } from "./checks/featureRequirements";
export { applyFeatureSet, planFeatureSet, planFeatureSetFromText, requiredDependencyChains, SWITCHES_FILE, type FeatureSetPlan } from "./node/setEnabled";
