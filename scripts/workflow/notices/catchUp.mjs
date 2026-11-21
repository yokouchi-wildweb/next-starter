// scripts/workflow/notices/catchUp.mjs
// 持ち主 1 人の線の載せ直し(D395 (2)): /ship する自分の枝を、進んだ push 先(origin/main)の上へ同じ順で載せ直す。
// 作業のまとまりの合流(ギルドの作業票の merge・cargo が残した作業の merge)は merge のまま残し、main を線へ取り込んだ合流は
// 落とす(main の first-parent は 1 本、main を取り込んだ合流は main に入れない)。素の git rebase は合流を平らにし、
// git rebase --rebase-merges だけでは main を取り込んだ合流(`merge -C <元> onto`)と線の元の根元(`reset <元の根元>`)が残る。
// - 持ち主 1 人の線(/ship する自分の枝)だけ。何人もが土台にする線(ギルドの合流地点)には使わない(道具の merge で追いつく)
// - 並びの順は変えない(D383 の並べ直しではない): commit の順の入れ替え・区切りの前への移しはしない
// /ship の手順 7(push が拒まれた時)と WORKTREE ROUTE(origin/main が HEAD の祖先でない時)が呼ぶ。
//
// 実行: pnpm workflow notices catchUp [--onto=<ref>]
//   onto = --onto、無ければ origin/main、無ければ @{u}
//   onto が HEAD の祖先 → 何もしない(`catchUp: 載せ直し不要`)
//   そうでなければ git rebase -i --rebase-merges <onto> を、todo をこのファイル(--edit-todo)で書き換えて回す:
//     - merge の行で、取り込む側が onto(label onto)か onto の祖先の commit → 消す(main を取り込んだ合流)
//     - reset の行で、先が onto の祖先の commit → reset onto(線の根元を onto へ)
//     - それ以外(取り込む側が線の中の label = 作業の merge)はそのまま
//   ぶつかりは rebase の途中で止まる(git rerere が覚えていれば解いて進む): 解いて git add → git rebase --continue
//   exit 0 = 済み / 要らない | 1 = ぶつかりで止まった(rebase の途中) | 2 = 回せない(理由)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);

function git(repo, args) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

const tryGit = (repo, args) => {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
};

const isAncestor = (repo, a, b) =>
  spawnSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: repo, stdio: "ignore" }).status === 0;

/** 既定の onto: origin/main、無ければ @{u}。どちらも無ければ null */
export function defaultOnto(repo) {
  for (const ref of ["origin/main", "@{u}"]) if (tryGit(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`])) return ref;
  return null;
}

/**
 * rebase -i --rebase-merges の todo を書き換える(純粋な部分: 祖先の判定は upstream(sha) で受ける)。
 * 返す: { text, dropped: [{ orig, subject }], kept: [{ orig, subject }] }
 */
export function editTodo(text, upstream) {
  const dropped = [];
  const kept = [];
  const out = [];
  for (const line of text.split("\n")) {
    const body = line.replace(/\s+#.*$/, "");
    const subject = (line.match(/#\s?(.*)$/) ?? [])[1] ?? "";
    const merge = body.match(/^(?:m|merge)\s+(?:-[cC]\s+(\S+)\s+)?(.+)$/);
    if (merge) {
      const orig = merge[1] ?? "-";
      const sources = merge[2].trim().split(/\s+/);
      if (sources.every((s) => s === "onto" || upstream(s))) {
        dropped.push({ orig, subject });
        continue;
      }
      kept.push({ orig, subject });
      out.push(line);
      continue;
    }
    const reset = body.match(/^(?:t|reset)\s+(\S+)$/);
    if (reset && reset[1] !== "onto" && upstream(reset[1])) {
      out.push(`reset onto${subject ? ` # ${subject}` : ""}`);
      continue;
    }
    out.push(line);
  }
  return { text: out.join("\n"), dropped, kept };
}

/** GIT_SEQUENCE_EDITOR として呼ばれた時: todo を書き換え、落とした・残した合流を報告のファイルへ */
function runEditTodo(todoPath) {
  const repo = process.cwd();
  const onto = process.env.CATCHUP_ONTO;
  const report = process.env.CATCHUP_REPORT;
  if (!onto || !report) return 2;
  // label の名前(線の中の枝)は upstream ではない。sha の形の物だけを onto の祖先かで見る
  const upstream = (ref) => /^[0-9a-f]{7,40}$/.test(ref) && isAncestor(repo, ref, onto);
  const r = editTodo(readFileSync(todoPath, "utf8"), upstream);
  writeFileSync(todoPath, r.text);
  writeFileSync(
    report,
    [...r.dropped.map((m) => `drop\t${m.orig}\t${m.subject}`), ...r.kept.map((m) => `keep\t${m.orig}\t${m.subject}`)].join("\n"),
  );
  return 0;
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const onto = argv.find((a) => a.startsWith("--onto="))?.slice(7) ?? defaultOnto(repo);
  if (!onto) {
    log("catchUp: 載せる先が分からない(origin/main も @{u} も無い。--onto=<ref>)");
    return 2;
  }
  const ontoSha = tryGit(repo, ["rev-parse", "--verify", "-q", `${onto}^{commit}`]);
  if (!ontoSha) {
    log(`catchUp: ${onto} が無い`);
    return 2;
  }
  const gitDir = git(repo, ["rev-parse", "--absolute-git-dir"]);
  if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) {
    log("catchUp: rebase の途中(解いて git rebase --continue、やめるなら git rebase --abort)");
    return 2;
  }
  if (isAncestor(repo, ontoSha, "HEAD")) {
    log(`catchUp: 載せ直し不要(${onto} は HEAD の祖先)`);
    return 0;
  }
  if (tryGit(repo, ["status", "--porcelain", "--untracked-files=no"])) {
    log("catchUp: 作業ツリーに commit していない変更がある(先に commit するか片付ける)");
    return 2;
  }
  const report = join(gitDir, "catchup.report");
  rmSync(report, { force: true });
  const before = git(repo, ["rev-parse", "--short", "HEAD"]);
  const r = spawnSync("git", ["rebase", "-i", "--rebase-merges", ontoSha], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${SELF}" --edit-todo`,
      GIT_EDITOR: "true",
      CATCHUP_ONTO: ontoSha,
      CATCHUP_REPORT: report,
    },
  });
  const rows = existsSync(report) ? readFileSync(report, "utf8").split("\n").filter(Boolean) : [];
  rmSync(report, { force: true });
  for (const row of rows) {
    const [kind, orig, subject] = row.split("\t");
    log(`catchUp: ${kind === "drop" ? "落とした合流(main を取り込んだ)" : "残した合流(作業)"} ${orig.slice(0, 9)} ${subject}`);
  }
  if (r.status === 0) {
    log(`catchUp: ${before} → ${git(repo, ["rev-parse", "--short", "HEAD"])}(${onto} の上へ、同じ順)`);
    return 0;
  }
  if (existsSync(join(gitDir, "rebase-merge"))) {
    const files = tryGit(repo, ["diff", "--name-only", "--diff-filter=U"]) ?? "";
    log(`catchUp: ぶつかりで止まった(rebase の途中): ${files.split("\n").filter(Boolean).join(", ") || "-"}`);
    log("catchUp: 解いて git add → git rebase --continue(rerere が覚えた解き方は当たっている)");
    return 1;
  }
  log(`catchUp: 回せない — ${(r.stderr || r.stdout || "").trim().split("\n").at(-1) ?? "git rebase"}`);
  return 2;
}

function main(argv) {
  if (argv[0] === "--edit-todo") return runEditTodo(argv[1]);
  return run(join(dirname(SELF), "../../.."), argv);
}

if (process.argv[1] && SELF === process.argv[1]) process.exitCode = main(process.argv.slice(2));
