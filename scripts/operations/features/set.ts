// scripts/operations/features/set.ts(pnpm ops features set <規則名> on|off)
// 機能の入切を書き換える(L1.19): 規則の enabled が機能のドメインの config の <X>_CONFIG.enabled を読む形だけ書く。
// 書き先は持ち主の上書き src/config/features/<名前>.config.ts の enabled(上書きを合成する持ち主、目録 D19・L1.26)か、上書きを持たない config.ts のリテラルの 1 行。
// 必須(src/featureGate/required/)の機能と、必須の機能が dependsOn で推移的に依存する機能を off にしようとすると何も書かずに exit 1(依存の連鎖を出す)。
// on にした機能の依存先が規則の値で閉なら、書いた上で「依存先 <名前> が閉なので閉のまま」と出す。書けない形は値を読む場所を出して exit 2。
// db:push・pnpm generate extensions は打たない。中身は門番の道具 @/featureGate/node の planFeatureSet。詳細: src/featureGate/README.md

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
  if (plan.kind === "requiredDependent") {
    console.error(`❌ ${name} は必須の機能が依存しています(off にすると必須の機能が閉じる):`);
    for (const chain of plan.chains) console.error(`   ${chain.join(" → ")}(src/featureGate/required/${chain[0]}.ts)`);
    console.error("   閉じるなら先に必須の項目を消すか、依存元の dependsOn を見直す");
    process.exit(1);
  }
  if (plan.kind === "unwritable") {
    console.error(`⚠️  ${name} は書き換えられない形です: ${plan.why}`);
    console.error(`   規則の enabled: ${plan.enabledSource}`);
    console.error(`   この値を手で直す(src/featureGate/rules/${name}.ts の enabled が読む config)`);
    process.exit(2);
  }
  const stillClosed = () => {
    for (const dep of plan.closedDependencies) console.log(`   ⚠️  依存先 ${dep} が閉なので ${name} は閉のまま(開けるなら pnpm ops features set ${dep} on)`);
  };
  if (!plan.changed) {
    console.log(`${name} は既に ${state} です(${plan.configFile})`);
    stillClosed();
    return;
  }
  applyFeatureSet(root, plan);
  console.log(`✅ ${name} を ${state} にしました(${plan.configFile})`);
  stillClosed();
  if (state === "on" && plan.closedDependencies.length === 0) console.log("   表を持つ機能なら pnpm db:push で表を作る(人が打つ)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
