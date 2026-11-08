// scripts/operations/data/update.ts — pnpm ops data update <domain> --file <file.jsonl> [--dry-run]
// JSON Lines の 1 行 { id, ...変える列 } をドメインのサービスの bulkUpdate([{ id, data }]) で書く。1 ファイル = 1 回の呼び出し = 全部か無し。
// サービスの守り(例 userService.bulkUpdate の列の制限)はそのまま効く。メディア(ファイル)の列は書かない(storage の binding を通す物)。条件で選んで一括で書き換える形は無い(README.md)。
// 許可は resolveDataCommand の update。書き込みは task_runs に記録し、同じ中身を二度当てない(lib.run.ts)

import { readFileSync } from "node:fs";

import { guardEntry } from "../../runner/guard";
import { checkRecords, DATA_USAGE, DataUsageError, domainArg, valueOf, withoutMedia } from "./lib.args";
import { resolveDataTarget } from "./lib.domain";
import { parseJsonLines } from "./lib.jsonl";
import { failUsage, runRecordedWrite } from "./lib.run";

guardEntry({ write: true, db: true, what: "pnpm ops data update" });

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  let content: string;
  let target: Awaited<ReturnType<typeof resolveDataTarget>>;
  try {
    const domainName = domainArg(args, DATA_USAGE.update);
    const file = valueOf(args, "--file");
    if (!file || file.startsWith("--")) throw new DataUsageError(`--file <file.jsonl> は必須です\n使い方: ${DATA_USAGE.update}`);
    content = readFileSync(file, "utf8");
    target = await resolveDataTarget(domainName, "update");
  } catch (error) {
    return failUsage(error);
  }
  return runRecordedWrite({
    command: "update",
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
      const problems = checkRecords("update", records);
      if (problems.length > 0) throw new DataUsageError(`ファイルに誤りがあるので書きません:\n${problems.join("\n")}`);
      if (args.includes("--dry-run")) return { dryRun: true, records: records.length, mediaSkipped: media.skipped };
      const payload = records.map(({ id, ...data }) => ({ id: String(id), data }));
      const result = (await target.service[target.method](payload)) as { count: number; notFoundIds?: string[] };
      if (result.notFoundIds && result.notFoundIds.length > 0) {
        return { dryRun: false, records: records.length, updated: result.count, notFoundIds: result.notFoundIds };
      }
      return { dryRun: false, records: records.length, updated: result.count };
    },
  });
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error("✗ pnpm ops data update:", error);
    process.exit(1);
  },
);
