// scripts/workflow/notices/reorder.mjs
// push の前の並べ替え(D353): 区切りの点 = notice を足した commit。まだ push していない範囲で、notice を足した後に
// 後の commit がその本文を直していたら、足すのをその最後の commit に移す(まだ出していない commit を書き直す。commit は増えない)。
// /ship が手順 6 の commit の後・pickCheck の前に走らせる(COMMITTED RANGE も)。止める検査ではない: 動かせない物は 1 行で言うだけ。
//
// 実行: pnpm workflow notices reorder [--onto=<ref>] [--dry-run]
//   範囲 = <onto>..HEAD(既定 onto = @{u}、無ければ origin/HEAD。WORKTREE ROUTE の origin/main と同じ)
//   動かす: 範囲で足した notice X で、範囲の後の commit が本文を直した物 → 足した commit からその直前までの木から X の本文を抜く
//   動かさない(1 行で言う):
//     - hotfix: の notice(本体と同じ 1 commit の決まり)
//     - 範囲で X の本文を消す・改名する
//     - 次の区切りを越える直し: X を足した後に別の notice Y を足した commit があり、その commit か後の commit が X を直す
//       (区間の境を越えると X の区間に Y の区間の変更が入る。checkpoint_at: の縛り「次のお知らせの点より前」と同じ線)
//     - 範囲に merge がある(全部動かさない)
//   書き直し: commit-tree(著者・日時・メッセージはそのまま)。先端の木が元と同じことを確かめてから update-ref
//   (HEAD が動いていたら書かない)。作業ツリーと index は触らない
//   exit 0 = 済み / 何も無い | 2 = できない(理由)
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NOTICE_FILE = /^\.notices\/(\d{8}-\d{6}-[^/]+)\.md$/;

function git(repo, args, { env, input } = {}) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd: repo,
    encoding: "utf8",
    input,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  }).trim();
}

const tryGit = (repo, args) => {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
};

/** 既定の onto: @{u}、無ければ origin/HEAD。どちらも無ければ null */
export function defaultOnto(repo) {
  for (const ref of ["@{u}", "origin/HEAD"]) if (tryGit(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`])) return ref;
  return null;
}

/** commit が変えた .notices/<id>.md: [{ status, path, to? }](--no-renames 以外で改名も見る) */
function noticeChanges(repo, sha) {
  const out = git(repo, ["diff-tree", "--no-commit-id", "-r", "-M", "--name-status", sha, "--", ".notices/"]);
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, path, to] = line.split("\t");
      return { status: status[0], path, to };
    });
}

/**
 * 並べ替えの計画: { commits: [sha 古い順], moves: [{ id, path, from: i, to: j }], skipped: [行], merge: bool }
 * from / to = commits の中の位置(足した commit / 最後に直した commit)
 */
export function planReorder(repo, onto) {
  const commits = git(repo, ["rev-list", "--reverse", "--topo-order", `${onto}..HEAD`]).split("\n").filter(Boolean);
  if (!commits.length) return { commits, moves: [], skipped: [], merge: false };
  if (commits.some((c) => git(repo, ["rev-list", "--parents", "-n", "1", c]).split(" ").length > 2)) {
    return { commits, moves: [], skipped: ["範囲に merge があるので並べ替えない"], merge: true };
  }
  const changes = commits.map((c) => noticeChanges(repo, c));
  const adds = new Map(); // id → { i, path }
  const addAt = []; // 位置 → その commit で足した id の並び
  changes.forEach((list, i) => {
    addAt[i] = [];
    for (const ch of list) {
      const id = ch.status === "A" ? NOTICE_FILE.exec(ch.path)?.[1] : null;
      if (id && !adds.has(id)) {
        adds.set(id, { i, path: ch.path });
        addAt[i].push(id);
      }
    }
  });
  const moves = [];
  const skipped = [];
  for (const [id, { i, path }] of adds) {
    const later = [];
    let gone = false;
    for (let k = i + 1; k < commits.length; k++) {
      for (const ch of changes[k]) {
        if (ch.path !== path) continue;
        if (ch.status === "M") later.push(k);
        else gone = true; // D・R(改名)・型の変更
      }
    }
    if (!later.length) continue;
    const short = (k) => commits[k].slice(0, 9);
    if (gone) {
      skipped.push(`${id}: 範囲で本文を消す・改名するので動かさない`);
      continue;
    }
    const text = git(repo, ["show", `${commits[i]}:${path}`]);
    if (/^hotfix:/m.test(text)) {
      skipped.push(`${id}: hotfix: の notice は本体と同じ commit のまま(後の直し ${later.map(short).join(", ")})`);
      continue;
    }
    const next = addAt.findIndex((ids, k) => k > i && ids.length > 0); // 次の notice を足した commit(区切りの境)
    if (next !== -1 && later.some((k) => k >= next)) {
      skipped.push(`${id} は次の区切りの後で直されています(取り込み済みの fork に作業が要るなら新しいお知らせ fixes:、D351)`);
      continue;
    }
    moves.push({ id, path, from: i, to: later.at(-1) });
  }
  return { commits, moves, skipped, merge: false };
}

/** 計画どおりに書き直す。新しい先端の sha を返す(先端の木が元と違えば投げる) */
export function rewrite(repo, { commits, moves }) {
  let parent = git(repo, ["rev-parse", `${commits[0]}^`]); // 範囲の根の元の親に積む(履歴の形は変えない)
  const indexFile = join(git(repo, ["rev-parse", "--absolute-git-dir"]), "reorder.index");
  const env = { GIT_INDEX_FILE: indexFile };
  for (let k = 0; k < commits.length; k++) {
    const c = commits[k];
    const drop = moves.filter((m) => k >= m.from && k < m.to).map((m) => m.path);
    let tree = git(repo, ["rev-parse", `${c}^{tree}`]);
    if (drop.length) {
      git(repo, ["read-tree", c], { env });
      git(repo, ["update-index", "--force-remove", "--", ...drop], { env });
      tree = git(repo, ["write-tree"], { env });
    }
    const [an, ae, ad, cn, ce, cd] = git(repo, ["show", "-s", "--format=%an%x00%ae%x00%ad%x00%cn%x00%ce%x00%cd", "--date=raw", c]).split("\0");
    const msg = git(repo, ["show", "-s", "--format=%B", c]);
    parent = git(repo, ["commit-tree", tree, "-p", parent, "-F", "-"], {
      input: `${msg}\n`,
      env: { GIT_AUTHOR_NAME: an, GIT_AUTHOR_EMAIL: ae, GIT_AUTHOR_DATE: ad, GIT_COMMITTER_NAME: cn, GIT_COMMITTER_EMAIL: ce, GIT_COMMITTER_DATE: cd },
    });
  }
  rmSync(indexFile, { force: true });
  const oldTree = git(repo, ["rev-parse", `${commits.at(-1)}^{tree}`]);
  const newTree = git(repo, ["rev-parse", `${parent}^{tree}`]);
  if (oldTree !== newTree) throw new Error(`書き直した先端の木が元と違う(${oldTree.slice(0, 9)} → ${newTree.slice(0, 9)})`);
  return parent;
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const dryRun = argv.includes("--dry-run");
  const onto = argv.find((a) => a.startsWith("--onto="))?.slice(7) ?? defaultOnto(repo);
  if (!onto) {
    log("reorder: push 先が分からない(@{u} も origin/HEAD も無い。--onto=<ref>)");
    return 2;
  }
  let plan;
  try {
    plan = planReorder(repo, onto);
  } catch (e) {
    log(`reorder: できない — ${e.message}`);
    return 2;
  }
  for (const s of plan.skipped) log(`reorder: ${s}`);
  if (!plan.moves.length) {
    log(`reorder: 動かす notice なし(${onto}..HEAD ${plan.commits.length} commit)`);
    return 0;
  }
  const short = (k) => plan.commits[k].slice(0, 9);
  for (const m of plan.moves) log(`reorder: ${m.id}: 足す commit ${short(m.from)} → ${short(m.to)}${dryRun ? "(--dry-run)" : ""}`);
  if (dryRun) return 0;
  const head = plan.commits.at(-1);
  try {
    const next = rewrite(repo, plan);
    git(repo, ["update-ref", "-m", "notices reorder", "HEAD", next, head]); // HEAD が動いていれば git が拒む
    log(`reorder: HEAD ${head.slice(0, 9)} → ${next.slice(0, 9)}(先端の木は同じ)`);
    return 0;
  } catch (e) {
    log(`reorder: できない — ${e.message}`);
    return 2;
  }
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
