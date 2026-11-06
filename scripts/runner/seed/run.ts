// scripts/runner/seed/run.ts
//
// 閉じた機能の項目(feature の規則が 1 つでも閉じている)は選択肢と --all から外し、名前を出す(scripts/runner/seed/gate.ts)。
// feature の無い項目は走る。表が無くて失敗したら項目名と直し方を出す。詳細: scripts/runner/seed/README.md「閉じた機能と seed」

import { config } from "dotenv";
import { checkbox } from "@inquirer/prompts";

// .env.development を読み込む（import文より先に実行）
config({ path: ".env.development" });

async function main() {
  console.log("🌱 データベースのシード実行");
  console.log("");

  // 環境変数読み込み後に動的import
  const [{ seedRegistry, resolveDependencyOrder }, { gate }, { partitionSeeds, isUndefinedTableError }] = await Promise.all([
    import("./data"),
    import("@/featureGate/node"),
    import("./gate"),
  ]);
  type SeedKey = (typeof seedRegistry)[number]["key"];
  type SeedResults = Partial<Record<SeedKey, unknown>>;

  // 閉じた機能の項目は外す(選択肢にも --all にも出さない)
  const { run: openSeeds, skipped } = partitionSeeds(seedRegistry, (feature) => gate.enabled(feature));
  if (skipped.length > 0) {
    console.log("🔒 閉じた機能の項目なので飛ばします:");
    for (const { seed, closed } of skipped) console.log(`   ${seed.name}(${seed.key}): 閉じた機能 ${closed.join(", ")}`);
    console.log("");
  }
  if (openSeeds.length === 0) {
    console.log("実行できるシードがありません。終了します。");
    process.exit(0);
  }

  // --all フラグで全シードを実行（インタラクティブ選択をスキップ）
  const runAll = process.argv.includes("--all");

  let selectedKeys: SeedKey[];

  if (runAll) {
    selectedKeys = openSeeds.map((s) => s.key);
    console.log("📋 全てのシードを実行します");
  } else {
    // チェックボックスで実行するシードを選択
    selectedKeys = await checkbox<SeedKey>({
      message: "実行するシードを選択してください（スペースで選択、Enterで確定）",
      choices: openSeeds.map((seed) => ({
        name: seed.deps.length > 0 ? `${seed.name} (依存: ${seed.deps.join(", ")})` : seed.name,
        value: seed.key,
        checked: true, // デフォルトで全選択
      })),
    });
  }

  if (selectedKeys.length === 0) {
    console.log("シードが選択されませんでした。終了します。");
    process.exit(0);
  }

  // 依存関係を解決して実行順序を決定
  const orderedKeys = resolveDependencyOrder(selectedKeys);
  const selectedSet = new Set(selectedKeys);

  console.log("");
  console.log(`📋 実行順序: ${orderedKeys.join(" → ")}`);
  console.log("");

  // 各シードの実行結果を保持
  const results: SeedResults = {};

  // 順番にシードを実行
  for (const key of orderedKeys) {
    const seedConfig = seedRegistry.find((s) => s.key === key);
    if (!seedConfig) continue;

    console.log(`▶ ${seedConfig.name}`);

    // 依存関係のデータを収集（選択されているもののみ）
    const deps: SeedResults = {};
    for (const depKey of seedConfig.deps) {
      if (selectedSet.has(depKey) && results[depKey] !== undefined) {
        deps[depKey] = results[depKey];
      }
    }

    // シード実行
    try {
      results[key] = await seedConfig.fn(deps as any);
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.error(`❌ ${seedConfig.name}(${key}): 書き込む表が DB にありません。`);
        console.error("   閉じた機能の表なら registry.ts のこの項目に feature: \"<規則名>\" を付ける(閉じている間は飛ばす)。");
        console.error("   開いた機能の表なら pnpm db:push で作る。");
      }
      throw error;
    }
  }

  console.log("");
  console.log("✅ シードの実行が完了しました");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ シードの実行に失敗しました:", error);
  process.exit(1);
});
