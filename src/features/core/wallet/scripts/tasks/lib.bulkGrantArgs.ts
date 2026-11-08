// src/features/core/wallet/scripts/tasks/lib.bulkGrantArgs.ts
// wallet:bulk-grant の引数の読み方と止める鍵(タスクの間で共有する部品。DB を読まない。--file はローカルのファイルを読む)

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { TaskNotStartedError } from "@/lib/task";

export const BULK_GRANT_USAGE =
  'pnpm task wallet:bulk-grant -- --wallet-type <通貨> --kind grant|compensation (--users <id>[,<id>...] --amount <n> | --file <1 行 "id" か "id,額"> [--amount <既定の額>]) --reason "<理由>" [--notify] [--dry-run]';

export type BulkGrantArgs = {
  walletType: string;
  kind: "grant" | "compensation";
  grants: Array<{ userId: string; amount: number }>;
  reason: string;
  notify: boolean;
  dryRun: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const valueOf = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  if (at >= 0) return args[at + 1];
  return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
};

const amountOf = (text: string | undefined): number | null => (text !== undefined && /^\d+$/.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

/** ファイルの行(1 行 "id" か "id,額"。空行と # の行は飛ばす) */
export function linesOfGrantFile(text: string): Array<{ userId: string; amount: string | undefined; line: number }> {
  const out: Array<{ userId: string; amount: string | undefined; line: number }> = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const [userId, amount] = line.split(",").map((part) => part.trim());
    out.push({ userId, amount: amount === "" ? undefined : amount, line: index + 1 });
  });
  return out;
}

/** 引数を読む。誤りは TaskNotStartedError(書く前に止まった) */
export function readBulkGrantArgs(args: readonly string[], readFile: (path: string) => string = (path) => readFileSync(path, "utf8")): BulkGrantArgs {
  const fail = (why: string): never => {
    throw new TaskNotStartedError(`wallet:bulk-grant: ${why}\n使い方: ${BULK_GRANT_USAGE}`);
  };
  const walletType = valueOf(args, "--wallet-type");
  if (!walletType || walletType.startsWith("--")) fail("--wallet-type <通貨> は必須です");
  const kind = valueOf(args, "--kind");
  if (kind !== "grant" && kind !== "compensation") fail(`--kind は grant か compensation です: ${kind ?? "(なし)"}`);
  const reason = valueOf(args, "--reason")?.trim();
  if (!reason || reason.startsWith("--")) fail('--reason "<理由>" は必須です(履歴と監査に残る)');
  const defaultAmountText = valueOf(args, "--amount");
  const defaultAmount = amountOf(defaultAmountText);
  if (defaultAmountText !== undefined && defaultAmount === null) fail(`--amount は正の整数です: ${defaultAmountText}`);
  const users = valueOf(args, "--users");
  const file = valueOf(args, "--file");
  if ((users === undefined) === (file === undefined)) fail("--users か --file のどちらか一方を指定してください");

  const grants: BulkGrantArgs["grants"] = [];
  const problems: string[] = [];
  if (users !== undefined) {
    if (defaultAmount === null) fail("--users には --amount <n> が要ります");
    for (const userId of users.split(",").map((id) => id.trim()).filter(Boolean)) grants.push({ userId, amount: defaultAmount as number });
  } else {
    let text = "";
    try {
      text = readFile(file as string);
    } catch (error) {
      fail(`--file ${file} を読めません(${error instanceof Error ? error.message : String(error)})`);
    }
    for (const row of linesOfGrantFile(text)) {
      const amount = row.amount === undefined ? defaultAmount : amountOf(row.amount);
      if (amount === null) problems.push(`${row.line} 行目: 額が無いか正の整数でない(${row.amount ?? "額なし、--amount も無い"})`);
      else grants.push({ userId: row.userId, amount });
    }
  }
  const badIds = grants.filter((g) => !UUID.test(g.userId)).map((g) => g.userId);
  if (badIds.length > 0) problems.push(`ユーザーの id は uuid です: ${badIds.slice(0, 5).join(", ")}${badIds.length > 5 ? ` ほか ${badIds.length - 5} 件` : ""}`);
  if (problems.length > 0) fail(problems.join("\n"));
  if (grants.length === 0) fail("付けるユーザーがいません");
  const ids = grants.map((g) => g.userId);
  if (new Set(ids).size !== ids.length) fail("同じユーザーが 2 回並んでいます");
  return { walletType: walletType as string, kind: kind as BulkGrantArgs["kind"], grants, reason: reason as string, notify: args.includes("--notify"), dryRun: args.includes("--dry-run") };
}

/** 止める鍵: 中身(通貨・種類・理由・ユーザーと額の組)から 1 つ。同じ付与を二度打たない(並び順は問わない) */
export function bulkGrantStopKey(parsed: Pick<BulkGrantArgs, "walletType" | "kind" | "reason" | "grants">): string {
  const pairs = parsed.grants.map((g) => `${g.userId.toLowerCase()}:${g.amount}`).sort();
  const hash = createHash("sha256").update([parsed.walletType, parsed.kind, parsed.reason, ...pairs].join("\n")).digest("hex");
  return `wallet-grant:${hash.slice(0, 32)}`;
}
