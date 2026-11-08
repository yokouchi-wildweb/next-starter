// src/features/core/wallet/scripts/tasks/lib.walletLotsSelection.ts
// wallet:lots-init と wallet:lots-init-from-history が共有する部品(対象通貨の読み取りと止める鍵)。

import { TaskNotStartedError } from "@/lib/task";

/**
 * ウォレットロット初期化の対象通貨を CLI 引数から読む。
 * --wallet-type <通貨>（繰り返し・カンマ区切り可）か --all のどちらか一方を必須にする
 * （初期化は失効カウントを作り直す取り消せない操作のため、指定の忘れで全通貨を作り直させない）。
 * 通貨名の検証（存在しない・無効な通貨）はサービス側が書き込みの前に行う。
 */
export function readWalletLotsInitSelection(taskName: string, args: string[]): string[] | "all" {
  const usage = `使い方: pnpm task ${taskName} -- --wallet-type <通貨>[,<通貨>...] | --all（どちらか一方が必須）`;
  const walletTypes: string[] = [];
  args.forEach((arg, index) => {
    if (arg !== "--wallet-type") return;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new TaskNotStartedError(`--wallet-type の値がありません。${usage}`);
    walletTypes.push(...value.split(",").map((type) => type.trim()).filter((type) => type !== ""));
  });
  const all = args.includes("--all");

  if (all && walletTypes.length > 0) throw new TaskNotStartedError(`--wallet-type と --all は同時に指定できません。${usage}`);
  if (all) return "all";
  if (walletTypes.length === 0) throw new TaskNotStartedError(usage);
  return walletTypes;
}

/**
 * 止める鍵: 対象通貨ごとに wallet-lots:<通貨>(lots-init と lots-init-from-history は代わりになる 2 本なので同じ鍵)。
 * 通貨の検証(存在しない・無効)はサービスと同じ resolveWalletLotsInitTypes で行い、誤りは書き込み前の失敗にする
 */
export async function walletLotsStopKeys(taskName: string, args: string[]): Promise<string[]> {
  const selection = readWalletLotsInitSelection(taskName, args.filter((arg) => arg !== "--"));
  const { resolveWalletLotsInitTypes } = await import("@/features/core/wallet/utils/expiration");
  let types: string[];
  try {
    types = resolveWalletLotsInitTypes(selection);
  } catch (error) {
    throw new TaskNotStartedError(error instanceof Error ? error.message : String(error));
  }
  return types.map((type) => `wallet-lots:${type}`);
}
