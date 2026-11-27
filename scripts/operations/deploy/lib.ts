// scripts/operations/deploy/lib.ts — デプロイの動作(all・app・room)が共有する段
//
// 段: checkCron(事前検査) → syncEnv(アプリを本番に出す時だけ) → deployRoom(Worker) → deployApp(Vercel)。
// どの段も失敗したら理由を出して exit 1 で止める(次の段に進まない)。
// 本番に出す前の確認は共通の守り(scripts/runner/guard の guardDeploy): 手で打つなら「production」と打たせ、
// 非対話(TTY なし・CI・エージェント)は方針 agent.deploy と人の 1 回分の許可 dep がある時だけ通す(--confirm=production だけでは通さない、
// D420)。プレビュー(--prod でない vercel)は確認なし。
// env ファイルは上げない(ホスティング側の env で動く)。本番に出す前に .env.production の鍵で Vercel の本番に無い名だけを
// その値で足す(syncEnv: 足すだけ・上書きしない・足した名を画面に。デプロイの守りの後なので evp は見ない、D462 (2))。アプリ(Vercel)に上げるのは HEAD の commit の中身だけ:
// git archive で一時の場所に書き出し、リンク(.vercel/project.json)だけを写してそこから vercel を呼ぶ(作業場所の .env*・
// 未追跡・無視されたファイル・手元の build は上がらない。上がる木 = セーフポイントの知らせが見た commit)。
// 本番に出す時は確認の後に今セーフポイントの上かを 1 行出す(reportSafePoint。止めない、D317。仕様 = .notices/README.md「区切り(checkpoint)と区間適用」のセーフポイント)。

import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { realtimeRoomConfig } from "@/lib/realtimeRoom";
import { syncProductionEnv } from "../vercel/lib.vercel.mjs";
import { deployPosition } from "../../workflow/notices/safePoint.mjs";
import { deployRoomWorker, roomDeployReady } from "../room/lib.deploy";

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

/** ルームサーバー(servers/room)。中身は pnpm ops room deploy(enabled=false なら skip = exit 0) */
export function deployRoom(): void {
  // 同じプロセスの中で出す(子の pnpm ops room deploy にしない: 確認と許可は呼び手の守りで済んでいる)
  if (roomDeployReady()) deployRoomWorker();
}

/**
 * デプロイの前の env の揃え(アプリを本番に出す時だけ呼ぶ): .env.production の空でない鍵のうち Vercel の本番に無い名を足す。
 * 足すのに失敗したら(名前が読めない時も)デプロイせず止める
 */
export function syncEnv(): void {
  const r = syncProductionEnv({ root: repoRoot, run: (argv: string[], opts: object = {}) => spawnSync("vercel", argv, { cwd: repoRoot, shell: false, encoding: "utf8", ...opts }) });
  if (!r.ok) {
    console.error("\n✗ Vercel の本番の env を揃えられなかったため、デプロイを中止します(scripts/operations/vercel/README.md)");
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
  const tree = exportCommitTree(repoRoot);
  let status: number | null = 1;
  try {
    console.log(`\n→ HEAD ${tree.commit} の中身(${tree.dir})から vercel ${args.join(" ")} を実行します...\n`);
    status = spawnSync("vercel", args, { cwd: tree.dir, stdio: "inherit", shell: false }).status;
  } finally {
    rmSync(tree.dir, { recursive: true, force: true });
  }
  if (status !== 0) {
    console.error("\n✗ アプリのデプロイに失敗しました");
    process.exit(status ?? 1);
  }
}

/** Vercel のリンク(vercel link が書く。commit には入らない)。書き出した木に写す物はこれだけ */
export const VERCEL_LINK_FILE = path.join(".vercel", "project.json");

/**
 * HEAD の commit の中身を一時の場所に書き出す(git archive)。リンク .vercel/project.json だけを写す。
 * 作業場所の .env*・未追跡・無視されたファイル・まだ commit していない変更は入らない。呼んだ側が dir を消す
 * @returns {{ dir: string, commit: string }}
 */
export function exportCommitTree(root: string, deps: { tmpRoot?: string } = {}): { dir: string; commit: string } {
  const git = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || r.stdout).trim()}`);
    return r.stdout.trim();
  };
  const commit = git(["rev-parse", "--short", "HEAD"]);
  const dir = mkdtempSync(path.join(deps.tmpRoot ?? tmpdir(), "deploy-tree-"));
  try {
    const archive = path.join(dir, ".archive.tar");
    git(["archive", "--format=tar", "-o", archive, "HEAD"]);
    const tar = spawnSync("tar", ["-xf", archive, "-C", dir], { encoding: "utf8", shell: false });
    if (tar.status !== 0) throw new Error(`tar: ${tar.stderr.trim()}`);
    rmSync(archive, { force: true });
    const link = path.join(root, VERCEL_LINK_FILE);
    if (existsSync(link)) {
      mkdirSync(path.join(dir, ".vercel"), { recursive: true });
      copyFileSync(link, path.join(dir, VERCEL_LINK_FILE));
    }
    return { dir, commit };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
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

/** ルームサーバーを実際にデプロイするか(realtimeRoom の設定 enabled=false なら skip。デプロイ = 本番の Worker) */
export const roomWillDeploy = (): boolean => realtimeRoomConfig.enabled;

/** pnpm live -- <引数> の先頭の "--" を落とす(pnpm が素通しする場合がある) */
export function argsOf(argv: string[]): string[] {
  return argv[0] === "--" ? argv.slice(1) : argv;
}

type SafePointPosition = { ok: boolean; line: string; message: string };

/**
 * 本番に出す時だけ、今セーフポイントの上かを 1 行出す(fork = 台帳の最後の upstream:<sha> が直接の親の safe tag ちょうど、
 * Tier1 = HEAD が自分の safe tag ちょうど)。上なら ✓、外なら ℹ と近いセーフポイント。止めない(D317: セーフポイントは印で縛りではない)。プレビューは見ない
 */
export function reportSafePoint(
  production: boolean,
  deps: { position?: () => SafePointPosition; log?: (s: string) => void } = {},
): void {
  if (!production) return;
  const position = deps.position ?? (() => deployPosition(repoRoot) as SafePointPosition);
  const log = deps.log ?? ((s: string) => console.log(s));
  const { ok, message } = position();
  log(`${ok ? "✓" : "ℹ"} ${message}`);
}
