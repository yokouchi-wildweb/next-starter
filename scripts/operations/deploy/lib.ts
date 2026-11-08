// scripts/operations/deploy/lib.ts — デプロイの動作(all・app・room)が共有する段
//
// 段: checkCron(事前検査) → deployRoom(Worker) → deployApp(Vercel)。
// どの段も失敗したら理由を出して exit 1 で止める(次の段に進まない)。
// 本番に出す前の確認は共通の守り(scripts/runner/guard の guardDeploy): 手で打つなら「production」と打たせ、
// 非対話(TTY なし・CI・エージェント)は --confirm=production が無ければ何もデプロイせず拒否。プレビュー(--prod でない vercel)は確認なし。
// env ファイルは読まない(ホスティング側の env で動く)。

import { execSync, spawnSync } from "node:child_process";
import path from "node:path";

import { REALTIME_ROOM_CONFIG } from "../../../src/config/app/realtime-room.config";

export const repoRoot = path.resolve(import.meta.dirname, "../../..");

/**
 * 事前検査: cron の配線(vercel.json の crons が src/app/api/cron/*\/task.ts と一致するか)。
 * 配線漏れのまま本番に出すと prune 系が動かずテーブルが無制限に増えるため、どのデプロイの前にも止める
 */
export function checkCron(): void {
  try {
    execSync("pnpm check cron", { cwd: repoRoot, stdio: "inherit" });
  } catch {
    console.error("\n✗ cron の配線に問題があるため、デプロイを中止します（src/lib/cron/README.md 参照）");
    process.exit(1);
  }
}

/**
 * ルームサーバー(servers/room)。中身は pnpm ops room deploy(enabled=false なら skip = exit 0)。
 * args はそのまま渡す(例: --allow-default-name)
 */
export function deployRoom(args: string[] = []): void {
  try {
    execSync(["pnpm ops room deploy", ...args].join(" "), { cwd: repoRoot, stdio: "inherit" });
  } catch {
    console.error("\n✗ ルームサーバーのデプロイに失敗しました");
    process.exit(1);
  }
}

/** アプリ(Vercel)。引数はそのまま vercel CLI へ渡す。無指定なら --prod */
export function deployApp(vercelArgs: string[]): void {
  const versionCheck = spawnSync("vercel", ["--version"], { shell: false });
  if (versionCheck.error || versionCheck.status !== 0) {
    console.error(`
✗ vercel CLI が見つかりません。インストールしてください:
    npm i -g vercel
  初回はプロジェクトのリンクが必要です:
    vercel link
`);
    process.exit(1);
  }

  const args = vercelArgs.length > 0 ? vercelArgs : ["--prod"];
  console.log(`\n→ vercel ${args.join(" ")} を実行します...\n`);
  const result = spawnSync("vercel", args, { cwd: repoRoot, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error("\n✗ アプリのデプロイに失敗しました");
    process.exit(result.status ?? 1);
  }
}

/** vercel の引数が本番に出すか(引数なし = --prod の既定・--prod・--target=production)。それ以外はプレビュー */
export function isProductionVercel(vercelArgs: readonly string[]): boolean {
  if (vercelArgs.length === 0) return true;
  if (vercelArgs.includes("--prod")) return true;
  const i = vercelArgs.indexOf("--target");
  const target = vercelArgs.find((a) => a.startsWith("--target="))?.slice("--target=".length) ?? (i >= 0 ? vercelArgs[i + 1] : undefined);
  return target === "production";
}

/** ルームサーバーを実際にデプロイするか(realtime-room.config enabled=false なら skip。デプロイ = 本番の Worker) */
export const roomWillDeploy = (): boolean => REALTIME_ROOM_CONFIG.enabled;

/** pnpm live -- <引数> の先頭の "--" を落とす(pnpm が素通しする場合がある) */
export function argsOf(argv: string[]): string[] {
  return argv[0] === "--" ? argv.slice(1) : argv;
}
