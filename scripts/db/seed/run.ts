// scripts/db/seed/run.ts

import { config } from "dotenv";
import { checkbox } from "@inquirer/prompts";

// .env.development を読み込む（import文より先に実行）
config({ path: ".env.development" });

async function main() {
  console.log("🌱 データベースのシード実行");
  console.log("");

  // 環境変数読み込み後に動的import
  const { seedRegistry, resolveDependencyOrder } = await import("./data");
  type SeedKey = (typeof seedRegistry)[number]["key"];
  type SeedResults = Partial<Record<SeedKey, unknown>>;

  // --all フラグで全シードを実行（インタラクティブ選択をスキップ）
  const runAll = process.argv.includes("--all");

  let selectedKeys: SeedKey[];

  if (runAll) {
    selectedKeys = seedRegistry.map((s) => s.key);
    console.log("📋 全てのシードを実行します");
  } else {
    // チェックボックスで実行するシードを選択
    selectedKeys = await checkbox<SeedKey>({
      message: "実行するシードを選択してください（スペースで選択、Enterで確定）",
      choices: seedRegistry.map((seed) => ({
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
    const result = await seedConfig.fn(deps as any);
    results[key] = result;
  }

  console.log("");
  console.log("✅ シードの実行が完了しました");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ シードの実行に失敗しました:", error);
  process.exit(1);
});
