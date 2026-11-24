// scripts/workflow/notices/catchUp.mjs
// 持ち主 1 人の線の載せ直し(D395 (2)): /sluice する自分の枝を、進んだ push 先(origin/main)の上へ同じ順で載せ直す。
// 作業のまとまりの合流(ギルドの作業票の merge・cargo が残した作業の merge)は merge のまま残し、main を線へ取り込んだ合流は
// 落とす(main の first-parent は 1 本、main を取り込んだ合流は main に入れない)。素の git rebase は合流を平らにし、
// git rebase --rebase-merges だけでは main を取り込んだ合流(`merge -C <元> onto`)と線の元の根元(`reset <元の根元>`)が残る。
// - 持ち主 1 人の線(/sluice する自分の枝)だけ。何人もが土台にする線(ギルドの合流地点)には使わない(道具の merge で追いつく)
// - 並びの順は変えない(D383 の並べ直しではない): commit の順の入れ替え・区切りの前への移しはしない
// - 先頭の組み直し(D402): onto が HEAD の祖先でも、先頭が「onto そのものを線へ取り込んだ合流」(親 2 つ、第 1 親 = 線で
//   onto を含まない、第 2 親 = onto)なら、同じ木で第 1 親 = onto・第 2 親 = 線の作業の合流に作り直す(止めない)。そのまま
//   push すると main の first-parent が線の側へ移り、前の main の線が第 2 親側に落ちる(c63eb4306)。先頭より手前にある
//   同じ形の合流は組み直さない(この版の範囲の外)
// /sluice の push の前に毎回(手順 7・WORKTREE ROUTE・COMMITTED RANGE)と、push が拒まれた時に呼ぶ。
//
// 実行: pnpm workflow notices catchUp [--onto=<ref>]
//   onto = --onto、無ければ origin/main、無ければ @{u}
//   onto が HEAD の祖先 → 先頭が上の形なら組み直す(`catchUp: 組み直した …`)、違えば何もしない(`catchUp: 載せ直し不要`)
//   そうでなければ git rebase -i --rebase-merges <onto> を、todo をこのファイル(--edit-todo)で書き換えて回す:
//     - merge の行で、取り込む側が onto(label onto)か onto の祖先の commit → 消す(main を取り込んだ合流)
//     - reset の行で、先が onto の祖先の commit → reset onto(線の根元を onto へ)
//     - それ以外(取り込む側が線の中の label = 作業の merge)はそのまま。その次の行に exec(このファイルの --carry <元>)を足す
//   合流だけが足した変更の運び(S7): rebase は作業の合流を merge -C で作り直すので、合流 commit そのものが足した物(区切りの
//   notice など)は落ちる。--carry <元> は元の合流の第 1 親・第 2 親の両方に無くて元に在るファイル(合流が足した)を元の中身で、
//   両方に在って元に無いファイル(合流が消した)を消して、作り直した合流に amend する(作者・文は元のまま)。両方の親と中身が違う
//   書き換え(合流が直した中身・ぶつかりの解き方)は運ばず、作り直した合流の中身が元と違えば名前を報告する
//   ぶつかりは rebase の途中で止まる(git rerere が覚えていれば解いて進む): 解いて git add → git rebase --continue
//   exit 0 = 済み / 要らない | 1 = ぶつかりで止まった(rebase の途中) | 2 = 回せない(理由)
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
 * carry(orig) = 残す作業の合流(元の sha があるもの)の次に足す行(無し = 足さない)
 * 返す: { text, dropped: [{ orig, subject }], kept: [{ orig, subject }] }
 */
export function editTodo(text, upstream, carry = null) {
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
      if (carry && orig !== "-") out.push(carry(orig));
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

/**
 * 先頭を組み直すか(D402、純粋な部分): parents = HEAD の親(順のまま)、contains(a, b) = a が b の祖先か(a = b を含む)。
 * 親 2 つ・第 1 親が onto を含まない・第 2 親が onto そのもの → 組み直す
 */
export function reshapeTip(parents, ontoSha, contains) {
  return parents.length === 2 && parents[1] === ontoSha && !contains(ontoSha, parents[0]);
}

/** 先頭の合流を、同じ木・同じ作者で、第 1 親 = onto・第 2 親 = 線の作業の合流に作り直し HEAD を移す。新しい sha を返す */
function reshape(repo, ontoSha, onto, work) {
  const old = git(repo, ["rev-parse", "HEAD"]);
  const branch = tryGit(repo, ["symbolic-ref", "-q", "--short", "HEAD"]) ?? "作業の線";
  const target = onto.replace(/^origin\//, "");
  const [name, email, date, subject] = git(repo, ["log", "-1", "--format=%an%x00%ae%x00%aI%x00%s", old]).split("\0");
  const msg = `merge: ${branch} を ${target} へ\n\n${target} を線へ取り込んだ合流 ${old.slice(0, 9)}(${subject})を、第 1 親 = ${target} の作業の合流へ組み直した(木は同じ、D402)\n`;
  const tree = git(repo, ["rev-parse", "HEAD^{tree}"]);
  const nm = execFileSync("git", ["commit-tree", tree, "-p", ontoSha, "-p", work], {
    cwd: repo,
    input: msg,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date },
  }).trim();
  git(repo, ["reset", "-q", "--keep", nm]);
  return nm;
}

/**
 * 合流が足した・消した・書き換えたファイル(純粋な部分): p1 / p2 = 元の第 1 親・第 2 親から元への diff --name-status の
 * Map(path → 先頭の字 A/M/D)。両方 A = 足した / 両方 D = 消した / 両方に出る他の組 = 書き換えた
 */
export function mergeOwnChanges(p1, p2) {
  const added = [];
  const deleted = [];
  const changed = [];
  for (const [path, a] of p1) {
    const b = p2.get(path);
    if (!b) continue;
    if (a === "A" && b === "A") added.push(path);
    else if (a === "D" && b === "D") deleted.push(path);
    else changed.push(path);
  }
  return { added, deleted, changed };
}

/** rebase の exec として呼ばれた時: 元の合流だけが足した・消したファイルを、作り直した合流(HEAD)へ運んで amend する */
function runCarry(orig) {
  const repo = process.cwd();
  const report = process.env.CATCHUP_REPORT;
  const status = (from) =>
    new Map(
      git(repo, ["diff", "--no-renames", "--name-status", from, orig])
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          const [s, ...f] = l.split("\t");
          return [f.join("\t"), s[0]];
        }),
    );
  const own = mergeOwnChanges(status(`${orig}^1`), status(`${orig}^2`));
  const blob = (rev, path) => tryGit(repo, ["rev-parse", "-q", "--verify", `${rev}:${path}`]);
  const add = own.added.filter((f) => blob("HEAD", f) !== blob(orig, f));
  const del = own.deleted.filter((f) => blob("HEAD", f) !== null);
  if (add.length) git(repo, ["checkout", orig, "--", ...add]);
  if (del.length) git(repo, ["rm", "-q", "--", ...del]);
  if (add.length || del.length) git(repo, ["commit", "-q", "--amend", "--no-edit"]);
  const lost = own.changed.filter((f) => blob("HEAD", f) !== blob(orig, f));
  const short = orig.slice(0, 9);
  if (report) {
    const rows = [];
    if (add.length || del.length) rows.push(`carry\t${short}\t${[...add, ...del.map((f) => `-${f}`)].join(", ")}`);
    if (lost.length) rows.push(`lost\t${short}\t${lost.join(", ")}`);
    if (rows.length) appendFileSync(report, `\n${rows.join("\n")}`);
  }
  return 0;
}

/** GIT_SEQUENCE_EDITOR として呼ばれた時: todo を書き換え、落とした・残した合流を報告のファイルへ */
function runEditTodo(todoPath) {
  const repo = process.cwd();
  const onto = process.env.CATCHUP_ONTO;
  const report = process.env.CATCHUP_REPORT;
  if (!onto || !report) return 2;
  // label の名前(線の中の枝)は upstream ではない。sha の形の物だけを onto の祖先かで見る
  const upstream = (ref) => /^[0-9a-f]{7,40}$/.test(ref) && isAncestor(repo, ref, onto);
  const r = editTodo(readFileSync(todoPath, "utf8"), upstream, (orig) => `exec "${process.execPath}" "${SELF}" --carry ${orig}`);
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
    const parents = git(repo, ["rev-list", "--parents", "-n", "1", "HEAD"]).split(" ").slice(1);
    if (reshapeTip(parents, ontoSha, (a, b) => isAncestor(repo, a, b))) {
      const before = git(repo, ["rev-parse", "--short", "HEAD"]);
      const nm = reshape(repo, ontoSha, onto, parents[0]);
      log(`catchUp: 組み直した ${before} → ${nm.slice(0, 9)}(${onto} を線へ取り込んだ合流を、第 1 親 = ${onto} の作業の合流へ。木は同じ)`);
      return 0;
    }
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
    if (kind === "carry") log(`catchUp: 合流 ${orig} が足した変更を載せ直した: ${subject}`);
    else if (kind === "lost") log(`catchUp: 合流 ${orig} が書き換えた ${subject} は運べない(作り直した合流の中身を確かめる)`);
    else log(`catchUp: ${kind === "drop" ? "落とした合流(main を取り込んだ)" : "残した合流(作業)"} ${orig.slice(0, 9)} ${subject}`);
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
  if (argv[0] === "--carry") return runCarry(argv[1]);
  return run(join(dirname(SELF), "../../.."), argv);
}

if (process.argv[1] && SELF === process.argv[1]) process.exitCode = main(process.argv.slice(2));
