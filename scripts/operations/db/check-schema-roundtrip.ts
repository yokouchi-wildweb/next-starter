// scripts/operations/db/check-schema-roundtrip.ts
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
//   pnpm db:push:check                         # 開発(.env.development)
//   pnpm db:push:check -- --env production     # 本番を読むだけ(確認なし。向き先と印は共通の守り scripts/runner/guard で確かめる)
//   pnpm db:push:check -- --allow-defaults     # SET/DROP DEFAULT 行だけを無視 (fork 固有の default 事情向け退避口)
//
// 改名の問い: drizzle-kit が「作成か改名か」を端末で問うと、TTY のない実行(エージェント・CI・< /dev/null)では終わらない。
// stdin が TTY でないときは問いの出力を見つけた時点で、対象の名前と改名元の候補(と名指す notice の行)を出して exit 1。
// 答えは選ばない(読むだけ)。TTY があれば今まで通り問いに答えられる(答えても差分の計算だけで DB には書かない)。
//
// 前提: drizzle-kit/api の pushSchema はバインドパラメータを捨てるバグがあるため、
// patches/drizzle-kit@*.patch で修正済み (pnpm install で自動適用)。詳細: scripts/structure/registry/README.md
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { guardEntry } from "../../runner/guard";
import { findNoticeAnswers, formatPendingPrompt, parsePendingPrompt } from "./lib.pendingPrompt";

// 共通の守り(読むだけ): 向き先(既定は開発)と段階の印
const { envFile } = guardEntry({ write: false, what: "pnpm db:push:check" });

const allowDefaults = process.argv.includes("--allow-defaults");
const DEFAULT_STATEMENT = /^ALTER TABLE .* ALTER COLUMN .* (SET|DROP) DEFAULT/;

/** 本リポジトリの .notices/*.md(改名の答えを名指す行を探す) */
const readNotices = (): { id: string; text: string }[] => {
  const dir = join(process.cwd(), ".notices");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => ({ id: f.replace(/\.md$/, ""), text: readFileSync(join(dir, f), "utf8") }));
  } catch {
    return [];
  }
};

/**
 * stdin が TTY でないとき、drizzle-kit の問いの出力を見張り、出た時点で説明して exit 1 にする。
 * 問いは答えを待つだけで終わらないため、ここで止める(答えは選ばない)。
 */
const stopOnPromptWithoutTty = () => {
  if (process.stdin.isTTY) return;
  const write = process.stdout.write.bind(process.stdout);
  let buffer = "";
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    const prompt = parsePendingPrompt(buffer);
    if (!prompt) {
      buffer = buffer.slice(-4096);
      return (write as (...args: unknown[]) => boolean)(chunk, ...rest);
    }
    process.stdout.write = write;
    console.log(formatPendingPrompt(prompt, findNoticeAnswers(prompt, readNotices())));
    process.exit(1);
  }) as typeof process.stdout.write;
};

const main = async () => {
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    console.error(`DATABASE_URL が未設定です (${envFile})。`);
    process.exit(2);
  }

  // env ロード後に読み込む (schemaRegistry 側の import が env に依存しないよう動的 import)
  const [{ default: postgres }, { drizzle }, { pushSchema }, schema, { rules, gatedSchema }] =
    await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
      import("drizzle-kit/api"),
      import("@/registry/schemaRegistry"),
      import("@/featureGate/node"),
    ]);

  // db:push と同じスキーマゲートを掛ける (無効な機能のテーブルは比較対象外)
  const gate = gatedSchema(schema, rules);

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);

  stopOnPromptWithoutTty();
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
        " scripts/structure/registry/README.md の記述ルールを参照してください。",
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
