// scripts/tasks/_shared/walletLotsSelection.ts

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
    if (!value || value.startsWith("--")) throw new Error(`--wallet-type の値がありません。${usage}`);
    walletTypes.push(...value.split(",").map((type) => type.trim()).filter((type) => type !== ""));
  });
  const all = args.includes("--all");

  if (all && walletTypes.length > 0) throw new Error(`--wallet-type と --all は同時に指定できません。${usage}`);
  if (all) return "all";
  if (walletTypes.length === 0) throw new Error(usage);
  return walletTypes;
}
