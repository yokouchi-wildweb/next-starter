// scripts/registry/check-schema-roundtrip.ts
//
// pnpm db:push の「読み取り専用ドライラン」。
// schemaRegistry (TypeScript 側、スキーマゲート適用後) と DATABASE_URL の実 DB を drizzle-kit の push モードで比較し、
// 提案される SQL を表示する。1 文でもあれば exit 1。DB には一切書き込まない。
//
// 用途:
//   - push 直後に実行して差分ゼロを確認する (= index / default の書き方が round-trip することの検証)。
//     差分が残る index は、本番でも push のたびに DROP + CREATE (= 大規模テーブルでは書き込みロック) される。
//   - 本番 DB に対して「これから何が実行されるか」を安全に事前確認する。
//
// 実行:
//   pnpm db:push:check                         # .env.development (APP_ENV 未指定時の既定)
//   APP_ENV=.env.production pnpm db:push:check # 任意の env ファイル (drizzle.config.ts と同じ規約)
//   pnpm db:push:check -- --allow-defaults     # SET/DROP DEFAULT 行だけを無視 (fork 固有の default 事情向け退避口)
//
// 前提: drizzle-kit/api の pushSchema はバインドパラメータを捨てるバグがあるため、
// patches/drizzle-kit@*.patch で修正済み (pnpm install で自動適用)。詳細: scripts/registry/README.md
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = process.env.APP_ENV ?? ".env.development";
const envFilePath = resolve(process.cwd(), envFile);
if (!existsSync(envFilePath)) {
  console.error(`APP_ENV="${envFile}" で指定された環境変数ファイルが見つかりません。`);
  process.exit(2);
}
loadEnv({ path: envFilePath });

const allowDefaults = process.argv.includes("--allow-defaults");
const DEFAULT_STATEMENT = /^ALTER TABLE .* ALTER COLUMN .* (SET|DROP) DEFAULT/;

const main = async () => {
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    console.error(`DATABASE_URL が未設定です (${envFile})。`);
    process.exit(2);
  }

  // env ロード後に読み込む (schemaRegistry 側の import が env に依存しないよう動的 import)
  const [{ default: postgres }, { drizzle }, { pushSchema }, schema, { featureGateRules }, { applySchemaGate }] =
    await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
      import("drizzle-kit/api"),
      import("@/registry/schemaRegistry"),
      import("@/proxies/extensions/featureGateRules"),
      import("./schemaGate"),
    ]);

  // db:push と同じスキーマゲートを掛ける (無効な機能のテーブルは比較対象外)
  const gate = applySchemaGate(schema, featureGateRules);

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    // pushSchema は差分計算のみ。返される apply() は呼ばない (読み取り専用)
    const result = await pushSchema(gate.imports, db, undefined, gate.tablesFilter);
    const statements: string[] = result.statementsToExecute;
    const ignored = allowDefaults ? statements.filter((s) => DEFAULT_STATEMENT.test(s)) : [];
    const remaining = statements.filter((s) => !ignored.includes(s));

    console.log("");
    console.log(`対象: ${envFile}`);
    if (gate.gatedTables.length > 0) {
      console.log(`FeatureGate によるスキップ: ${gate.gatedTables.length} テーブル`);
    }
    for (const w of result.warnings as string[]) {
      console.log(`warning: ${w}`);
    }
    if (ignored.length > 0) {
      console.log(`無視 (--allow-defaults): ${ignored.length} 文`);
      for (const s of ignored) console.log(`  ${s}`);
    }
    if (remaining.length === 0) {
      console.log("差分なし: スキーマと DB は一致しています (push しても何も実行されません)。");
      return 0;
    }
    console.log(`差分あり: push を実行すると以下の ${remaining.length} 文が実行されます。`);
    for (const s of remaining) console.log(`  ${s}`);
    if (result.hasDataLoss) {
      console.log("注意: データ消失の可能性がある文を含みます。");
    }
    console.log("");
    console.log(
      "push 直後にこの差分が残る場合は、index / default の書き方が drizzle-kit と round-trip していません。" +
        " scripts/registry/README.md の記述ルールを参照してください。",
    );
    return 1;
  } finally {
    await client.end();
  }
};

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("check-schema-roundtrip 失敗:", err);
    process.exit(2);
  });
