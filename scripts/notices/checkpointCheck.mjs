// scripts/notices/checkpointCheck.mjs
// 出荷する範囲の途中の区切り(checkpoint)を、fork が区間ごとに merge して実際に持つ木で 1 つずつ検査する(/ship が push の前に使う)。
// /ship のふだんの検査は先端の木だけを見るので、途中の区切りが壊れていても気づかない。fork は区切りごとに止まって merge・検査・push
// するため、壊れた区切りで止まる(脇のブランチを main に載せ直して出した範囲で、途中の区切りが型検査に落ちていた件)。
//
// fork の木: 区切りの notice を /flux(.claude/skills/flux/incoming.mjs)と同じ順 = 先端の `rev-list --topo-order` の位置で並べ、
//   範囲の起点から各区切りの commit を順に merge した木。直線の履歴ではその commit の木そのもの、脇のブランチを merge した範囲では
//   先に並ぶ main 側の区切りを merge 済みの木(main 先行の fork の木。上流のどの commit とも違う)になる。
//   merge の衝突は壊れたと数える(出荷索引 .notices/shipped/ だけの衝突は区切りの側を採って続ける。検査に関係しない上流の帳簿のため)。
//   区切り = checkpoint がラベルか欄なし。先端のどれかの notice の skip_checkpoint: に名指された物は区切りにしない。
//   先取り: 各区切りを merge した後、fork が区切りの直後に取る pick:clean の修正(出荷の先端 --at、既定 HEAD の索引から。土台 = pick-check と
//   同じ壊れた地点がこの区切りかそれより前、まだ木に無い物)を履歴順に cherry-pick してから検査する。取った修正の区切り(脇の commit)は fork の
//   台帳に載り区間にならないので merge しない。--no-picks = 修正を取らずに区切りだけで見る(壊れた区切りを探す時)。
//
// 実行: node scripts/notices/checkpointCheck.mjs <from>..<to> [--all] [--at=<ref>] [--no-picks] [--check=<cmd> ...]
//   既定の検査 = pnpm typecheck・pnpm test:config-module-load・pnpm test:core-rules・pnpm registry:check(その木の package.json に
//   無い script は未実行と書いて飛ばす)。--check = 差し替え(繰り返し可)。依存は pick-check と同じ(lock が同じなら借り、違えば入れる)。
//   最初に壊れた区切りで止める(後の区切りはその上に載るため)。--all = 続けて全部見る。
//   exit 0 = 全部通る(区切りが無いも含む)| 1 = 壊れた区切りがある | 2 = 判定できない(範囲が読めない・依存を入れられない)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { field, noticeIndex, parseFixes, provideDeps, runChecks, sourcesBase } from "./pickCheck.mjs";
import { pickDroppingIndex, SHIPPED_PREFIX } from "./pickDroppingIndex.mjs";

export const DEFAULT_CHECKS = ["pnpm typecheck", "pnpm test:config-module-load", "pnpm test:core-rules", "pnpm registry:check"];
const ID = { name: "checkpoint-check", email: "checkpoint-check@local" };

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, "-c", "core.quotePath=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function isAncestor(repo, a, b) {
  try {
    git(repo, ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    return false;
  }
}

const lines = (s) => s.split("\n").filter(Boolean);

/** 範囲 from..to の区切り: [{ id, commit, label }](fork が merge する順) */
export function checkpointsIn(repo, from, to) {
  const index = noticeIndex(repo, to);
  const skipped = new Set();
  for (const n of index.values()) for (const s of (field(n.text, "skip_checkpoint") ?? "").split(",")) if (s.trim() && s.trim() !== "-") skipped.add(s.trim());
  const pos = new Map(lines(git(repo, ["rev-list", "--reverse", "--topo-order", to, `^${from}`])).map((c, i) => [c, i]));
  const out = [];
  for (const [id, n] of index) {
    if (!n.add || !pos.has(n.add) || n.checkpoint === "-" || skipped.has(id)) continue;
    out.push({ id, commit: n.add, label: n.checkpoint ?? id });
  }
  return out.sort((a, b) => pos.get(a.commit) - pos.get(b.commit) || (a.id < b.id ? -1 : 1));
}

/**
 * fork が区切りの直後に取る pick:clean の修正: 先端 tip の索引から [{ id, add, base, picks }](履歴順)。
 * base = pick-check と同じ土台(sourcesBase)。picks = その修正の前に取ってある要る修正(修正の修正の連鎖)
 */
export function cleanFixes(repo, tip) {
  const index = noticeIndex(repo, tip);
  const cps = new Set([...index.values()].filter((n) => n.add && n.checkpoint !== "-").map((n) => n.add));
  const pos = new Map(lines(git(repo, ["rev-list", "--reverse", "--topo-order", tip])).map((c, i) => [c, i]));
  const out = [];
  for (const [id, n] of index) {
    if (!n.add || n.fixes === undefined || n.pick !== "clean" || !pos.has(n.add)) continue;
    const b = sourcesBase(repo, parseFixes(n.fixes), n.add, index, cps);
    if (b.base) out.push({ id, add: n.add, base: b.base, picks: b.picks });
  }
  return out.sort((a, b) => pos.get(a.add) - pos.get(b.add));
}

/** 一時の木(HEAD = 前の区切りまでの fork の木)に commit を merge する。衝突したパス(索引以外)を返す */
function mergeInto(dir, commit) {
  try {
    git(dir, ["-c", `user.name=${ID.name}`, "-c", `user.email=${ID.email}`, "merge", "-q", "--no-edit", commit]);
    return [];
  } catch {
    const unmerged = [...new Set(lines(git(dir, ["diff", "--name-only", "--diff-filter=U"])))];
    const conflicts = unmerged.filter((f) => !f.startsWith(SHIPPED_PREFIX));
    if (!unmerged.length || conflicts.length) {
      git(dir, ["merge", "--abort"]);
      return conflicts.length ? conflicts : ["(merge が衝突以外の理由で失敗)"];
    }
    for (const f of unmerged) {
      try {
        git(dir, ["checkout", "--theirs", "--", f]);
        git(dir, ["add", "--", f]);
      } catch {
        git(dir, ["rm", "-q", "--", f]);
      }
    }
    git(dir, ["-c", `user.name=${ID.name}`, "-c", `user.email=${ID.email}`, "commit", "-q", "--no-verify", "--no-edit"]);
    return [];
  }
}

/** 各区切りの結果: [{ id, label, commit, status: "ok" | "broken", reasons, skipped }] か { unknown } */
export function check(repo, from, to, { checks = DEFAULT_CHECKS, all = false, at = "HEAD", stack = true } = {}) {
  const cps = checkpointsIn(repo, from, to);
  const fixes = stack && cps.length ? cleanFixes(repo, git(repo, ["rev-parse", "--verify", "-q", `${at}^{commit}`]).trim()) : [];
  const picked = new Set();
  const results = [];
  if (!cps.length) return { results };
  const dir = mkdtempSync(join(tmpdir(), "checkpoint-check-"));
  try {
    execFileSync("git", ["clone", "-q", "--shared", "--no-checkout", repo, dir], { stdio: "ignore" });
    git(dir, ["switch", "-q", "--detach", from]);
    let lock = null;
    for (const cp of cps) {
      // 先に取った修正の区切り(脇の commit)は fork の台帳に載り区間にならない
      if (picked.has(cp.commit)) {
        results.push({ ...cp, status: "picked", reasons: [], skipped: [], took: [] });
        continue;
      }
      const conflicts = mergeInto(dir, cp.commit);
      if (conflicts.length) {
        results.push({ ...cp, status: "broken", reasons: [`merge が衝突する: ${conflicts.slice(0, 5).join(", ")}`], skipped: [], took: [] });
        if (!all) break;
        continue;
      }
      // fork が区切りの直後に取る clean な修正: 土台がこの区切りかそれより前で、まだ木に無く、連鎖の前の修正を取ってある物
      const took = [];
      let pickFail = null;
      for (const f of fixes) {
        if (picked.has(f.add) || !isAncestor(repo, f.base, cp.commit) || isAncestor(repo, f.add, cp.commit)) continue;
        if (!f.picks.every((p) => picked.has(p) || isAncestor(repo, p, cp.commit))) continue;
        let bad;
        try {
          bad = pickDroppingIndex(dir, f.add).conflicts;
        } catch {
          bad = ["?"];
        }
        if (bad.length) {
          git(dir, ["reset", "-q", "--hard", "HEAD"]);
          pickFail = `先に取る修正 ${f.id}(${f.add.slice(0, 8)})が載らない: ${bad.slice(0, 3).join(", ")}`;
          break;
        }
        git(dir, ["-c", `user.name=${ID.name}`, "-c", `user.email=${ID.email}`, "commit", "-q", "--no-verify", "--allow-empty", "-m", `pick ${f.add}`]);
        picked.add(f.add);
        took.push(f.id);
      }
      if (pickFail) {
        results.push({ ...cp, status: "broken", reasons: [pickFail], skipped: [], took });
        if (!all) break;
        continue;
      }
      const lockPath = join(dir, "pnpm-lock.yaml");
      const now = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
      if (now !== lock) {
        rmSync(join(dir, "node_modules"), { recursive: true, force: true });
        const err = provideDeps(repo, dir);
        if (err) return { results, unknown: `${cp.id}: ${err}` };
        lock = now;
      }
      const pj = existsSync(join(dir, "package.json")) ? JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) : null;
      const r = runChecks(dir, checks, pj?.scripts ?? null);
      results.push({ ...cp, status: r.failed.length ? "broken" : "ok", reasons: r.failed, skipped: r.skipped, took });
      if (r.failed.length && !all) break;
    }
    return { results };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const range = argv.find((a) => !a.startsWith("--"));
  const all = argv.includes("--all");
  const checks = argv.filter((a) => a.startsWith("--check=")).map((a) => a.slice(8));
  const at = argv.find((a) => a.startsWith("--at="))?.slice(5) ?? "HEAD";
  const stack = !argv.includes("--no-picks");
  const m = range?.match(/^(.+?)\.\.(.+)$/);
  if (!m) {
    console.error("usage: node scripts/notices/checkpointCheck.mjs <from>..<to> [--all] [--at=<ref>] [--no-picks] [--check=<cmd> ...]");
    return 2;
  }
  const resolve = (ref) => {
    try {
      return git(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]).trim();
    } catch {
      return null;
    }
  };
  const from = resolve(m[1]);
  const to = resolve(m[2]);
  if (!from || !to) {
    log(`checkpoint-check: ${from ? m[2] : m[1]} がない`);
    return 2;
  }
  if (!isAncestor(repo, from, to)) {
    log(`checkpoint-check: ${m[1]} が ${m[2]} の祖先でない`);
    return 2;
  }
  const started = Date.now();
  if (!resolve(at)) {
    log(`checkpoint-check: ${at} がない`);
    return 2;
  }
  const { results, unknown } = check(repo, from, to, { ...(checks.length ? { checks } : {}), all, at, stack });
  if (!results.length && !unknown) log(`checkpoint-check: ${range} に区切りが無い`);
  for (const r of results) {
    const label = { ok: "通る", broken: "壊れた", picked: "先に取った修正(区間にならない)" }[r.status];
    log(`checkpoint-check: ${r.id} (${r.commit.slice(0, 8)}): ${label}${r.took?.length ? `(+ 修正 ${r.took.join(", ")} を取った木)` : ""}`);
    for (const x of r.reasons) log(`  - ${x}`);
    for (const s of r.skipped) log(`  - 未実行: ${s}`);
  }
  const broken = results.find((r) => r.status === "broken");
  if (broken) log(`checkpoint-check: 最初に壊れた区切り = ${broken.id}(push 前の自分の commit なら直して通し直す。push 済みなら fixes: ${broken.id} の修正を pick: clean で出す)`);
  if (unknown) log(`checkpoint-check: 未確認 — ${unknown}`);
  log(`checkpoint-check: ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
  return broken ? 1 : unknown ? 2 : 0;
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
