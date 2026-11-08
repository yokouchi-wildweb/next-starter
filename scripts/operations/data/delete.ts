// scripts/operations/data/delete.ts — pnpm ops data delete <domain> (--ids <id>[,...] | --file <file>) [--dry-run]
// ドメインのサービスの bulkDeleteByIds で消す(ソフト削除のドメインはそのサービスの消し方)。1 回の呼び出し = 全部か無し。
// 許可は resolveDataCommand の delete(サービスが bulkDeleteByIds を公開しないドメイン = user などは止まる)。
// 条件で選んで消す形・全件削除は無い(README.md)。書き込みは task_runs に記録し、同じ並びを二度当てない(lib.run.ts)

import { readFileSync } from "node:fs";

import { guardEntry } from "../../runner/guard";
import { checkIds, DATA_USAGE, DataUsageError, domainArg, idsOfDeleteInput, MAX_DATA_ROWS } from "./lib.args";
import { resolveDataTarget } from "./lib.domain";
import { failUsage, runRecordedWrite } from "./lib.run";

guardEntry({ write: true, db: true, what: "pnpm ops data delete" });

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  let ids: string[];
  let target: Awaited<ReturnType<typeof resolveDataTarget>>;
  try {
    const domainName = domainArg(args, DATA_USAGE.delete);
    ids = idsOfDeleteInput(args, (file) => readFileSync(file, "utf8"));
    target = await resolveDataTarget(domainName, "delete");
  } catch (error) {
    return failUsage(error);
  }
  return runRecordedWrite({
    command: "delete",
    domain: target.domain,
    args,
    // 鍵の中身 = 並べ替えた id(同じ行の集まりを二度消さない)
    content: [...ids].sort().join("\n"),
    work: async () => {
      if (ids.length === 0) throw new DataUsageError("消す id がありません");
      if (ids.length > MAX_DATA_ROWS) throw new DataUsageError(`1 回に消せるのは ${MAX_DATA_ROWS} 件までです(${ids.length} 件。分ける)`);
      const problems = checkIds(ids);
      if (problems.length > 0) throw new DataUsageError(`id に誤りがあるので消しません:\n${problems.join("\n")}`);
      if (args.includes("--dry-run")) return { dryRun: true, ids: ids.length };
      await target.service[target.method](ids);
      return { dryRun: false, deleted: ids.length };
    },
  });
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error("✗ pnpm ops data delete:", error);
    process.exit(1);
  },
);
