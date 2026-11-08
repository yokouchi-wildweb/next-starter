// scripts/operations/data/lib.args.ts
// pnpm ops data <export|import|update|delete> <domain> の引数の読み方と、ファイルの中身の確かめ(DB を読まない)

import type { JsonRecord } from "./lib.jsonl";

/** 1 ファイルの上限(1 回のサービスの呼び出しで書く = 全部か無しか。Postgres の 1 文の値の数の上限にも収める。超えるならファイルを分ける) */
export const MAX_DATA_ROWS = 1000;

export const DATA_USAGE = {
  export: "pnpm ops data export <domain> --out <file.jsonl> [--with-deleted] [--limit <n>]",
  import: "pnpm ops data import <domain> --file <file.jsonl> [--dry-run]",
  update: "pnpm ops data update <domain> --file <file.jsonl(1 行 { id, ...変える列 })> [--dry-run]",
  delete: "pnpm ops data delete <domain> (--ids <id>[,<id>...] | --file <file(1 行 1 id か { id })>) [--dry-run]",
} as const;

export class DataUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataUsageError";
  }
}

export const valueOf = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  if (at >= 0) return args[at + 1];
  return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
};

/** 最初の旗でない引数 = ドメイン */
export function domainArg(args: readonly string[], usage: string): string {
  const flagsWithValue = new Set(["--out", "--file", "--ids", "--limit", "--env"]);
  for (let i = 0; i < args.length; i += 1) {
    if (flagsWithValue.has(args[i])) {
      i += 1;
      continue;
    }
    if (!args[i].startsWith("--")) return args[i];
  }
  throw new DataUsageError(`ドメインを指定してください\n使い方: ${usage}`);
}

/** 行の id を確かめる(空・重なり。形の誤り(uuid でない等)は DB が 1 回の呼び出しごと拒むので、何も書かれない) */
export function checkIds(ids: readonly unknown[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (typeof id !== "string" || id.trim() === "") problems.push(`${index + 1} 件目: id がありません`);
    else if (seen.has(id)) problems.push(`${index + 1} 件目: id ${id} が重なっています`);
    else seen.add(id);
  });
  return problems;
}

/** import / update のファイルの確かめ(件数・update は id と変える列が必須・id の重なり) */
export function checkRecords(command: "import" | "update", records: JsonRecord[]): string[] {
  if (records.length === 0) return ["ファイルに 1 件もありません"];
  if (records.length > MAX_DATA_ROWS) return [`1 ファイルは ${MAX_DATA_ROWS} 件までです(${records.length} 件。ファイルを分ける)`];
  const problems: string[] = [];
  if (command === "update") {
    problems.push(...checkIds(records.map((r) => r.id)));
    records.forEach((record, index) => {
      if (Object.keys(record).filter((key) => key !== "id").length === 0) problems.push(`${index + 1} 件目: 変える列がありません`);
    });
  } else {
    const withId = records.map((r) => r.id).filter((id) => id !== undefined && id !== null);
    problems.push(...checkIds(withId).filter((p) => !p.includes("id がありません")));
  }
  return problems;
}

/** delete の id: --ids か、ファイル(1 行 1 id か JSON Lines の { id }) */
export function idsOfDeleteInput(args: readonly string[], readFile: (path: string) => string): string[] {
  const ids = valueOf(args, "--ids");
  const file = valueOf(args, "--file");
  if ((ids === undefined) === (file === undefined)) throw new DataUsageError(`--ids か --file のどちらか一方を指定してください\n使い方: ${DATA_USAGE.delete}`);
  if (ids !== undefined) return ids.split(",").map((id) => id.trim()).filter(Boolean);
  return readFile(file as string)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => (line.startsWith("{") ? String((JSON.parse(line) as { id?: unknown }).id ?? "") : line));
}

/** メディアの列を外す(ファイルは storage の binding を通す。値があった列の名前を返す) */
export function withoutMedia(records: JsonRecord[], mediaFields: readonly string[]): { records: JsonRecord[]; skipped: string[] } {
  if (mediaFields.length === 0) return { records, skipped: [] };
  const skipped = new Set<string>();
  const out = records.map((record) => {
    const copy = { ...record };
    for (const field of mediaFields) {
      if (field in copy) {
        if (copy[field] !== null && copy[field] !== undefined) skipped.add(field);
        delete copy[field];
      }
    }
    return copy;
  });
  return { records: out, skipped: [...skipped] };
}
