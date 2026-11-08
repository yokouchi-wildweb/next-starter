// scripts/operations/data/import.ts — pnpm ops data import <domain> --file <file.jsonl> [--dry-run]
// JSON Lines の行をドメインのサービスの bulkUpsert で入れる(id が同じなら上書き)。1 ファイル = 1 回の呼び出し = 全部か無し。
// メディア(ファイル)の列は書かない(storage の binding を通す物。値のあった列は結果の mediaSkipped に出す)。
// 許可は resolveDataCommand の import(README.md)。書き込みは task_runs に記録し、同じ中身を二度当てない(lib.run.ts)

import { readFileSync } from "node:fs";

import { guardEntry } from "../../runner/guard";
import { checkRecords, DATA_USAGE, DataUsageError, domainArg, valueOf, withoutMedia } from "./lib.args";
import { resolveDataTarget } from "./lib.domain";
import { parseJsonLines } from "./lib.jsonl";
import { failUsage, runRecordedWrite } from "./lib.run";

guardEntry({ write: true, db: true, what: "pnpm ops data import" });

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  let content: string;
  let target: Awaited<ReturnType<typeof resolveDataTarget>>;
  try {
    const domainName = domainArg(args, DATA_USAGE.import);
    const file = valueOf(args, "--file");
    if (!file || file.startsWith("--")) throw new DataUsageError(`--file <file.jsonl> は必須です\n使い方: ${DATA_USAGE.import}`);
    content = readFileSync(file, "utf8");
    target = await resolveDataTarget(domainName, "import");
  } catch (error) {
    return failUsage(error);
  }
  return runRecordedWrite({
    command: "import",
    domain: target.domain,
    args,
    content,
    work: async () => {
      let records: ReturnType<typeof parseJsonLines>;
      try {
        records = parseJsonLines(content);
      } catch (error) {
        throw new DataUsageError(error instanceof Error ? error.message : String(error));
      }
      // メディアの列は書かない(値のあった列は結果に出す)
      const media = withoutMedia(records, target.mediaFields);
      records = media.records;
      const problems = checkRecords("import", records);
      if (problems.length > 0) throw new DataUsageError(`ファイルに誤りがあるので書きません:\n${problems.join("\n")}`);
      if (args.includes("--dry-run")) return { dryRun: true, records: records.length, mediaSkipped: media.skipped };
      const result = (await target.service[target.method](records)) as { count: number };
      return { dryRun: false, records: records.length, upserted: result.count, mediaSkipped: media.skipped };
    },
  });
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error("✗ pnpm ops data import:", error);
    process.exit(1);
  },
);
