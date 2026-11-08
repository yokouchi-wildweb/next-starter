// scripts/operations/data/export.ts — pnpm ops data export <domain> --out <file.jsonl> [--with-deleted] [--limit <n>]
// ドメインの行を JSON Lines に書き出す(読むだけ。記録しない)。許可は resolveDataCommand の export(README.md)。
// 行はサービスの search(--with-deleted なら searchWithDeleted)でページごとに読む。秘匿の列はサービスが null にする

import { writeFileSync } from "node:fs";

import { guardEntry } from "../../runner/guard";
import { DATA_USAGE, DataUsageError, domainArg, valueOf } from "./lib.args";
import { resolveDataTarget } from "./lib.domain";
import { toJsonLine } from "./lib.jsonl";
import { failUsage } from "./lib.run";

guardEntry({ write: false, what: "pnpm ops data export" });

const PAGE = 500;

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  try {
    const domainName = domainArg(args, DATA_USAGE.export);
    const out = valueOf(args, "--out");
    if (!out || out.startsWith("--")) throw new DataUsageError(`--out <file.jsonl> は必須です\n使い方: ${DATA_USAGE.export}`);
    const limitText = valueOf(args, "--limit");
    const limit = limitText === undefined ? Number.POSITIVE_INFINITY : Number(limitText);
    if (!Number.isInteger(limit) && limit !== Number.POSITIVE_INFINITY) throw new DataUsageError(`--limit は正の整数です: ${limitText}`);
    if (limit <= 0) throw new DataUsageError(`--limit は正の整数です: ${limitText}`);
    const target = await resolveDataTarget(domainName, "export");
    const withDeleted = args.includes("--with-deleted");
    const read = withDeleted ? target.service.searchWithDeleted : target.service.search;
    if (typeof read !== "function") throw new DataUsageError(`${target.domain}: サービスに ${withDeleted ? "searchWithDeleted" : "search"} がありません`);

    const lines: string[] = [];
    let total = 0;
    for (let page = 1; lines.length < limit; page += 1) {
      const size = Math.min(PAGE, limit - lines.length);
      const result = (await read.call(target.service, { page, limit: size, orderBy: [["id", "ASC"]] })) as { results: Record<string, unknown>[]; total: number };
      total = result.total;
      for (const row of result.results) lines.push(toJsonLine(row));
      if (result.results.length < size) break;
    }
    writeFileSync(out, lines.length > 0 ? `${lines.join("\n")}\n` : "");
    console.log(JSON.stringify({ level: "info", scope: "ops-data", run: `data:export:${target.domain}`, ok: true, out, written: lines.length, total, withDeleted }));
    return 0;
  } catch (error) {
    return failUsage(error);
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error("✗ pnpm ops data export:", error);
    process.exit(1);
  },
);
