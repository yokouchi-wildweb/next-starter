// scripts/registry/push.ts
//
// pnpm db:push の本体。schemaRegistry を実 DB に反映する（drizzle-kit push の代わり）。
// drizzle-kit の CLI ではなく drizzle-kit/api の pushSchema を使うのは、スキーマゲート
// （feature-gate.config.ts で無効な機能のテーブルを push 対象から外す）をコード側・DB 側の両方に掛けるため。
// CLI はスキーマファイルの export をそのまま拾うので、コード側から外せない。
//
// 実行:
//   pnpm db:push                                        # .env.development 固定
//   APP_ENV=.env.production pnpm exec tsx scripts/registry/push.ts   # 任意の env ファイル
//   ... --force                                         # データ消失を伴う文も確認なしで実行
//
// 挙動は drizzle-kit push に合わせる:
// - 実行する SQL を表示してから実行する（差分が無ければ何もしない）
// - テーブル / 列の rename 判定は drizzle-kit の対話プロンプトがそのまま出る
// - データ消失を伴う文（DROP / truncate / 型変更）を含むときは y/N で確認する（--force で省略）
//
// 詳細: scripts/registry/README.md
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { config as loadEnv } from "dotenv";

const envFile = process.env.APP_ENV ?? ".env.development";
const envFilePath = resolve(process.cwd(), envFile);
if (!existsSync(envFilePath)) {
  console.error(`APP_ENV="${envFile}" で指定された環境変数ファイルが見つかりません。`);
  process.exit(2);
}
loadEnv({ path: envFilePath });

const force = process.argv.includes("--force");

const confirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
};

const main = async () => {
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    console.error(`DATABASE_URL が未設定です (${envFile})。`);
    return 2;
  }

  // env ロード後に読み込む (schemaRegistry 側の import が env に依存しないよう動的 import)
  const [{ default: postgres }, { drizzle }, { pushSchema }, schema, { featureGateRules }, { applySchemaGate }] =
    await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
      import("drizzle-kit/api"),
      import("@/registry/schemaRegistry"),
      import("@/config/app/feature-gate.config"),
      import("./schemaGate"),
    ]);

  const gate = applySchemaGate(schema, featureGateRules);

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    const result = await pushSchema(gate.imports, db, undefined, gate.tablesFilter);
    const statements: string[] = result.statementsToExecute;

    console.log("");
    console.log(`対象: ${envFile}`);
    if (gate.gatedTables.length > 0) {
      console.log(`FeatureGate によるスキップ: ${gate.gatedTables.length} テーブル`);
    }
    if (statements.length === 0) {
      console.log("差分なし: 何も実行しません。");
      return 0;
    }

    console.log(`実行する SQL (${statements.length} 文):`);
    for (const s of statements) console.log(`  ${s}`);
    for (const w of result.warnings as string[]) console.log(w);

    if (result.hasDataLoss && !force) {
      console.log("");
      console.log("注意: データ消失を伴う文を含みます。");
      if (!(await confirm("実行しますか？"))) {
        console.log("中止しました。DB は変更していません。");
        return 1;
      }
    }

    await result.apply();
    console.log("完了しました。");
    return 0;
  } finally {
    await client.end();
  }
};

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("db:push 失敗:", err);
    process.exit(2);
  });
