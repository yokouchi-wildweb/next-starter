// pnpm workflow ownership selfKeep の本体: /flux の区間の merge の後、型 5 self を取り込みの前の自分の版に戻す(D314、衝突しなかった変更も)。
// 計画は self.mjs の planSelfKeep(純)、ここは git から集めて書く。/flux は先端の版を .claude/skills/flux/tip.mjs で走らせる:
//   node <tmp tip.mjs> --upstream=<上流>/<枝> --entry=scripts/workflow/ownership/selfKeep.mjs -- --pre=<区間の前> --target=<区間の merge 先> --apply
// 見る self = 先端の SELF_FILES ∪ 作業ツリー(区間の木)の受け口の一覧の self の行。そのうち git diff <前>...<先> に入ったパスだけ。
// 必ず持つか = 先端の SELF_REQUIRED(区間の木の一覧に足された self は持たなくてよい物として扱う)
// 出す物: パスごとの扱いと、区間で 1 度見せる親の差分の命令(git diff <前>...<先> -- <パス>)。--apply で書く(既定は何も書かない)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { INTAKE_PATH } from "./check.mjs";
import { parseIntake } from "./intake.mjs";
import { SELF_FILES, SELF_REQUIRED, planSelfKeep } from "./self.mjs";

/** @param {string} repoRoot @param {string[]} args @returns {string | null} */
const tryGit = (repoRoot, args) => {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return null;
  }
};

/** @param {string} abs */
const readOrNull = (abs) => (existsSync(abs) ? readFileSync(abs, "utf8") : null);

/**
 * 計画を作る(--apply なら書く)
 * @param {string} repoRoot
 * @param {{ pre: string, target: string, apply?: boolean }} options
 * @returns {{ status: "ok", steps: (import("./self.mjs").SelfKeepStep & { diff: string })[] } | { status: "unverified", reason: string }}
 */
export function selfKeep(repoRoot, { pre, target, apply = false }) {
  const preSha = tryGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${pre}^{commit}`])?.trim();
  const targetSha = tryGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${target}^{commit}`])?.trim();
  if (!preSha || !targetSha) return { status: "unverified", reason: `${!preSha ? pre : target} を commit に解けない` };
  const diff = tryGit(repoRoot, ["diff", "--no-renames", "--name-only", `${preSha}...${targetSha}`]);
  if (diff === null) return { status: "unverified", reason: `${pre}...${target} の差分が読めない` };
  const intakeText = readOrNull(join(repoRoot, INTAKE_PATH));
  const treeSelf = intakeText === null ? [] : parseIntake(intakeText).rules.filter((rule) => rule.kind === "self").map((rule) => rule.glob);
  const selfPaths = [...new Set([...SELF_FILES, ...treeSelf])];
  const changed = new Set(diff.split("\n").filter(Boolean));
  const paths = selfPaths.filter((path) => changed.has(path));
  const preTexts = Object.fromEntries(paths.map((path) => [path, tryGit(repoRoot, ["show", `${preSha}:${path}`])]));
  const nowTexts = Object.fromEntries(paths.map((path) => [path, readOrNull(join(repoRoot, path))]));
  const steps = planSelfKeep({ paths, required: SELF_REQUIRED, pre: preTexts, now: nowTexts }).map((step) => ({
    ...step,
    diff: `git diff ${preSha.slice(0, 10)}...${targetSha.slice(0, 10)} -- ${step.path}`,
  }));
  if (apply) {
    for (const step of steps) {
      const abs = join(repoRoot, step.path);
      if (step.action === "restore") {
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, /** @type {string} */ (preTexts[step.path]));
      } else if (step.action === "remove") rmSync(abs, { force: true });
    }
  }
  return { status: "ok", steps };
}

/** pnpm workflow ownership selfKeep --pre=<rev> --target=<rev> [--apply] [--json](引数は process.argv、結果は process.exitCode) */
export function runSelfKeepCli() {
  const args = process.argv.slice(2);
  const value = (/** @type {string} */ key) => args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const pre = value("pre");
  const target = value("target");
  const unknown = args.filter((a) => !/^--(pre|target)=/.test(a) && a !== "--apply" && a !== "--json");
  if (!pre || !target || unknown.length) {
    console.error("使い方: pnpm workflow ownership selfKeep --pre=<区間の前> --target=<区間の merge 先> [--apply] [--json]");
    process.exitCode = 2;
    return;
  }
  const apply = args.includes("--apply");
  const result = selfKeep(process.cwd(), { pre, target, apply });
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else if (result.status === "unverified") console.error(`selfKeep: 未確認 — ${result.reason}`);
  else {
    const word = { restore: apply ? "自分の版に戻した" : "自分の版に戻す", remove: apply ? "消した(持たなくてよい self、自分の版 = 無い)" : "消す(持たなくてよい self、自分の版 = 無い)", "keep-new": "親の版を最初の自分の版にする(必ず持つ self)", same: "自分の版のまま" };
    for (const step of result.steps) console.log(`${step.path}: ${word[step.action]} | 親の差分: ${step.diff}`);
    if (!result.steps.length) console.log("selfKeep: 区間の差分に self のファイルなし");
    if (!apply && result.steps.some((s) => s.action === "restore" || s.action === "remove")) console.log("(dry-run。書くのは --apply)");
  }
  process.exitCode = result.status === "unverified" ? 2 : 0;
}
