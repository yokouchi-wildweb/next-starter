// scripts/operations/features/set.ts(pnpm ops features set <規則名> on|off)
// 機能の入切を書き換える(L1.19): 規則の enabled が機能のドメインの config の <X>_CONFIG.enabled を読む形だけ、その 1 行を書く。
// 必須(src/featureGate/required/)の機能を off にしようとすると何も書かずに exit 1。書けない形は値を読む場所を出して exit 2。
// db:push・extensions:generate は打たない。中身は門番の道具 @/featureGate/node の planFeatureSet。詳細: src/featureGate/README.md

import { applyFeatureSet, planFeatureSet, readRequired, rules } from "@/featureGate/node";

async function main() {
  const [name, state] = process.argv.slice(2);
  if (!name || (state !== "on" && state !== "off")) {
    console.error("使い方: pnpm ops features set <規則名> on|off(規則名の一覧: pnpm ops features list)");
    process.exit(1);
  }
  if (!rules.some((rule) => rule.name === name)) {
    console.error(`規則 ${name} がありません(src/featureGate/rules/<名前>.ts)`);
    process.exit(1);
  }
  const root = process.cwd();
  const plan = planFeatureSet(root, name, state === "on", await readRequired(root));
  if (plan.kind === "required") {
    console.error(`❌ ${name} は必須の機能です(src/featureGate/required/${name}.ts: ${plan.reason})。閉じるなら先にその項目を消す`);
    process.exit(1);
  }
  if (plan.kind === "unwritable") {
    console.error(`⚠️  ${name} は書き換えられない形です: ${plan.why}`);
    console.error(`   規則の enabled: ${plan.enabledSource}`);
    console.error(`   この値を手で直す(src/featureGate/rules/${name}.ts の enabled が読む config)`);
    process.exit(2);
  }
  if (!plan.changed) {
    console.log(`${name} は既に ${state} です(${plan.configFile})`);
    return;
  }
  applyFeatureSet(root, plan);
  console.log(`✅ ${name} を ${state} にしました(${plan.configFile})`);
  if (state === "on") console.log("   表を持つ機能なら pnpm db:push で表を作る(人が打つ)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
