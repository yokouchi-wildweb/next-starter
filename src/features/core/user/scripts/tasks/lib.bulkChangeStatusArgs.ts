// src/features/core/user/scripts/tasks/lib.bulkChangeStatusArgs.ts
// user:bulk-change-status の引数の読み方(タスクの間で共有する部品。DB を読まない。--file はローカルのファイルを読む)

import { readFileSync } from "node:fs";

import { USER_STATUSES } from "@/features/core/user/constants/status";
import type { UserStatus } from "@/features/core/user/types";
import { TaskNotStartedError } from "@/lib/task";

export const BULK_CHANGE_STATUS_USAGE =
  'pnpm task user:bulk-change-status -- --to <状態> (--users <id>[,<id>...] | --file <1 行 1 id のファイル>) --reason "<理由>" [--from <状態>] [--dry-run]';

export type BulkChangeStatusArgs = {
  userIds: string[];
  newStatus: UserStatus;
  reason: string;
  onlyFrom?: UserStatus;
  dryRun: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const valueOf = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  if (at >= 0) return args[at + 1];
  return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
};

/** ファイルの id(1 行 1 id、空行と # の行は飛ばす) */
export const idsOfFileText = (text: string): string[] =>
  text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));

/** 引数を読む。誤りは TaskNotStartedError(書く前に止まった) */
export function readBulkChangeStatusArgs(args: readonly string[], readFile: (path: string) => string = (path) => readFileSync(path, "utf8")): BulkChangeStatusArgs {
  const fail = (why: string): never => {
    throw new TaskNotStartedError(`user:bulk-change-status: ${why}\n使い方: ${BULK_CHANGE_STATUS_USAGE}`);
  };
  const status = (flag: string, value: string | undefined): UserStatus | undefined => {
    if (value === undefined) return undefined;
    if (!(USER_STATUSES as readonly string[]).includes(value)) fail(`${flag} ${value} は知らない状態です(${USER_STATUSES.join(" / ")})`);
    return value as UserStatus;
  };
  const newStatus = status("--to", valueOf(args, "--to"));
  if (!newStatus) fail("--to <状態> は必須です");
  const onlyFrom = status("--from", valueOf(args, "--from"));
  const reason = valueOf(args, "--reason")?.trim();
  if (!reason || reason.startsWith("--")) fail('--reason "<理由>" は必須です(監査に残る)');
  const users = valueOf(args, "--users");
  const file = valueOf(args, "--file");
  if ((users === undefined) === (file === undefined)) fail("--users か --file のどちらか一方を指定してください");
  let ids: string[] = [];
  if (users !== undefined) ids = users.split(",").map((id) => id.trim()).filter(Boolean);
  else {
    try {
      ids = idsOfFileText(readFile(file as string));
    } catch (error) {
      fail(`--file ${file} を読めません(${error instanceof Error ? error.message : String(error)})`);
    }
  }
  if (ids.length === 0) fail("ユーザーの id がありません");
  const bad = ids.filter((id) => !UUID.test(id));
  if (bad.length > 0) fail(`ユーザーの id は uuid です: ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? ` ほか ${bad.length - 5} 件` : ""}`);
  if (new Set(ids).size !== ids.length) fail("ユーザーの id が重なっています");
  return { userIds: ids, newStatus: newStatus as UserStatus, reason: reason as string, ...(onlyFrom ? { onlyFrom } : {}), dryRun: args.includes("--dry-run") };
}
