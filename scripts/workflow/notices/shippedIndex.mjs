// scripts/workflow/notices/shippedIndex.mjs
// 出荷した notice の消えない索引 .notices/shipped/<fork_id>.md(1 notice = 1 行、追記だけ)を、notice 本文から機械で作る。
// 行は手で書かない。書くのは索引の持ち主のリポだけ(台帳 .notices/applied/<fork_id>.md と同じ理由: 多段の merge で追記が重ならない)。
// 仕様: .notices/README.md
//
// 実行: node scripts/workflow/notices/shippedIndex.mjs <add <notice>... | refresh <notice>... | backfill | repair | verify>
//   add <notice>...  自分の索引の末尾に、その notice の行を 1 本ずつ足す(/ship が notice を出荷する commit の前に)
//   refresh <notice>... push 前の自分の行を本文から作り直す(skip_checkpoint: を pick-check の後に足したとき。pick: は行の値を保つ。
//                    push 済みの行・push した版が分からないときは拒否)
//   backfill         .notices/ 直下と done/ の notice のうち自分の物の行を、最初に足した commit の履歴順(同じ commit は id 順)に起こす(索引の導入時に 1 回)。
//                    除く = 他のリポの物(他のリポの索引に載る・本文の from: が自分の origin でない・台帳に picked: = 親から先に取った修正)
//   repair           自分の索引から他のリポの物の行(上の「除く」に当たる行)を消す(何度走らせても同じ)。
//                    古い backfill が先に pick した親の notice を書いてしまった fork が 1 回走らせる(消した行は追記だけの検査が受け入れる)
//   verify           全索引(.notices/shipped/*.md)について、追記だけ(前に push した版 = @{u} か origin/HEAD の行が先頭に同じ順で並ぶ)・
//                    行と本文の一致(本文 1 本に行 1 本、未 commit の notice は自分の索引に。本文の無い行は通る: 本文は区間が閉じれば消してよい)・
//                    uses: の実在と区切り・skip_checkpoint: の条件を見る(pnpm check notices も同じ検査を回す)
//   exit 0 = 済み / 一致 | 1 = 食い違い(一覧) | 2 = できない(理由)
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

export const SHIPPED_DIR = ".notices/shipped";
/** 行に写す本文の欄(この順)。本文に無い欄は行にも書かない(欄なしの checkpoint = 区切り、の既定を保つ) */
export const ROW_KEYS = ["severity", "checkpoint", "covers", "moved", "fixes", "resolves", "hotfix", "uses", "pick", "skip_checkpoint"];
const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;

/** notice 本文の見出しの id と、行頭の `key:` の値(最初に出たもの、1 行目だけ) */
export function noticeHead(text) {
  const lines = text.split("\n");
  const head = lines[0].match(/^# DOWNSTREAM NOTICE id:(\S+)\s*$/);
  const fields = {};
  for (const line of lines.slice(1)) {
    const m = line.match(/^([a-z_]+):\s?(.*)$/);
    if (m && !(m[1] in fields)) fields[m[1]] = m[2].trim();
  }
  return { id: head ? head[1] : null, fields };
}

/** 本文 → 行の欄 { id, fields }。hotfix: は理由の文なので yes だけを写す */
export function rowFieldsFromNotice(text) {
  const { id, fields } = noticeHead(text);
  if (!id) throw new Error("見出し `# DOWNSTREAM NOTICE id:<id>` が無い");
  const out = {};
  for (const k of ROW_KEYS) {
    if (!(k in fields)) continue;
    out[k] = k === "hotfix" ? "yes" : fields[k];
  }
  return { id, fields: out };
}

/** { id, fields } → 1 行。値に ` | ` があれば作らない(行の区切りと見分けがつかない) */
export function formatRow({ id, fields }) {
  const parts = [`- id:${id}`];
  for (const k of ROW_KEYS) {
    if (!(k in fields)) continue;
    const v = fields[k];
    if (/\s\|\s|\n/.test(v) || v.endsWith(" |")) throw new Error(`${id}: ${k}: の値に " | " か改行がある(行にできない)`);
    parts.push(`${k}:${v}`);
  }
  return parts.join(" | ");
}

export function rowFromNotice(text) {
  return formatRow(rowFieldsFromNotice(text));
}

/** 1 行 → { id, fields }。行でなければ null */
export function parseRow(line) {
  if (!line.startsWith("- id:")) return null;
  const [head, ...rest] = line.slice(2).split(" | ");
  const fields = {};
  for (const part of rest) {
    const i = part.indexOf(":");
    if (i > 0) fields[part.slice(0, i)] = part.slice(i + 1);
  }
  return { id: head.slice("id:".length), fields };
}

/** 索引の本文 → 行の一覧(順のまま) */
export function parseIndex(text) {
  return text.split("\n").map(parseRow).filter(Boolean);
}

/** 索引の行の pick: を value にする(他の欄は触らない)。行が無ければ null */
export function writeRowPick(indexText, id, value) {
  const lines = indexText.split("\n");
  const at = lines.findIndex((l) => parseRow(l)?.id === id);
  if (at < 0) return null;
  const row = parseRow(lines[at]);
  row.fields.pick = value;
  lines[at] = formatRow(row);
  return lines.join("\n");
}

export function indexPath(repo, forkId) {
  return join(repo, SHIPPED_DIR, `${forkId}.md`);
}

function header(forkId) {
  return `# SHIPPED ${forkId}\n> .notices/shipped/<fork_id>.md: notices this repo shipped, 1 line each, append only, written by scripts/workflow/notices/shippedIndex.mjs (never by hand). spec: .notices/README.md\n\n`;
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

/** 自分の fork_id(project.md)。読めなければ throw */
export function ownForkId(repo) {
  const { own, errors } = readForkIdentity(repo);
  if (!own) throw new Error(`fork_id が読めない: ${errors.join("; ") || "宣言が無い"}`);
  return own;
}

/** 今ある notice(.notices/ 直下と done/)の { id → path } */
export function noticeFiles(repo) {
  const out = new Map();
  for (const dir of [".notices", ".notices/done"]) {
    const abs = join(repo, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const m = `${dir}/${f}`.match(NOTICE_FILE);
      if (m) out.set(m[1], `${dir}/${f}`);
    }
  }
  return out;
}

/** 各 notice を最初に足した commit の履歴順の id 一覧(done/ への移動は --no-renames で A に出るので最も古い追加を取る) */
export function historyOrder(repo, ids) {
  if (git(repo, ["rev-parse", "--is-shallow-repository"]).trim() === "true") throw new Error("浅い clone: 最初に足した commit が引けない(git fetch --unshallow の後にもう一度)");
  const log = git(repo, ["-c", "core.quotePath=false", "log", "--topo-order", "--reverse", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", "HEAD", "--", ".notices/"]);
  const seen = new Set();
  const order = [];
  let batch = [];
  const flush = () => {
    order.push(...batch.sort());
    batch = [];
  };
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) flush();
    else {
      const m = line.match(NOTICE_FILE);
      if (m && ids.has(m[1]) && !seen.has(m[1])) {
        seen.add(m[1]);
        batch.push(m[1]);
      }
    }
  }
  flush();
  const missing = [...ids].filter((id) => !seen.has(id)).sort();
  if (missing.length) throw new Error(`足した commit が履歴に無い(未 commit か履歴の書き換え): ${missing.join(", ")}`);
  return order;
}

/** 自分の索引の末尾に notice の行を足す。足した行を返す */
export function add(repo, noticePaths) {
  const forkId = ownForkId(repo);
  const path = indexPath(repo, forkId);
  const have = new Set(existsSync(path) ? parseIndex(readFileSync(path, "utf8")).map((r) => r.id) : []);
  const rows = noticePaths.map((p) => {
    const text = readFileSync(join(repo, p), "utf8");
    const row = rowFieldsFromNotice(text);
    if (have.has(row.id)) throw new Error(`${row.id}: 索引に既にある(行は追記だけ、出荷済みの行は書き換えない)`);
    have.add(row.id);
    return formatRow(row);
  });
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, header(forkId));
  }
  appendFileSync(path, rows.map((r) => `${r}\n`).join(""));
  return rows;
}

/** 作業ツリーの全索引 .notices/shipped/*.md: [{ owner, file, text, rows }](owner = ファイル名の fork_id) */
export function readIndexes(repo) {
  const dir = join(repo, SHIPPED_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      return { owner: f.slice(0, -3), file: `${SHIPPED_DIR}/${f}`, text, rows: parseIndex(text) };
    });
}

/** push 前の自分の行を本文から作り直す(pick: は本文に無ければ行の値を保つ)。push 済みの行は拒否。作り直した行を返す */
export function refresh(repo, noticePaths, ref = pushedRef(repo)) {
  const forkId = ownForkId(repo);
  const path = indexPath(repo, forkId);
  const file = `${SHIPPED_DIR}/${forkId}.md`;
  if (!existsSync(path)) throw new Error(`${file} が無い(先に add)`);
  if (!ref) throw new Error("前に push した版が分からない(@{u} も origin/HEAD も無い)ので、push 前の行か確かめられない");
  let pushed = "";
  try {
    pushed = git(repo, ["show", `${ref}:${file}`]);
  } catch {
    pushed = "";
  }
  const pushedIds = new Set(parseIndex(pushed).map((r) => r.id));
  const lines = readFileSync(path, "utf8").split("\n");
  const out = [];
  for (const p of noticePaths) {
    const row = rowFieldsFromNotice(readFileSync(join(repo, p), "utf8"));
    if (pushedIds.has(row.id)) throw new Error(`${row.id}: push 済みの行は作り直せない(行は書き換えない。直すなら新しい notice)`);
    const at = lines.findIndex((l) => parseRow(l)?.id === row.id);
    if (at < 0) throw new Error(`${row.id}: 自分の索引に行が無い(先に add)`);
    const old = parseRow(lines[at]);
    if (!("pick" in row.fields) && "pick" in old.fields) row.fields.pick = old.fields.pick;
    lines[at] = formatRow(row);
    out.push(lines[at]);
  }
  writeFileSync(path, lines.join("\n"));
  return out;
}

/** 今ある全 notice の行を履歴順に起こす(索引が既にあれば止まる)。他のリポの索引に載る notice(fork の親の物)は飛ばす */
export function backfill(repo) {
  const forkId = ownForkId(repo);
  const path = indexPath(repo, forkId);
  if (existsSync(path)) throw new Error(`${SHIPPED_DIR}/${forkId}.md が既にある(起こすのは導入時の 1 回だけ。足すのは add)`);
  const foreign = foreignNoticeIds(repo, forkId);
  const files = new Map([...noticeFiles(repo)].filter(([id]) => !foreign.has(id)));
  const order = historyOrder(repo, new Set(files.keys()));
  const rows = order.map((id) => formatRow(rowFieldsFromNotice(readFileSync(join(repo, files.get(id)), "utf8"))));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, header(forkId) + rows.map((r) => `${r}\n`).join(""));
  return rows;
}

/** origin の URL を比べられる形に(git@host:path / https://host/path / 末尾の .git を揃える)。無ければ null */
export function normalizeRepoUrl(url) {
  if (!url) return null;
  const m = url.trim().match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^:/]+)[:/](.+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : url.trim().toLowerCase();
}

/** 自分の origin(比べられる形)。無ければ null */
export function ownOrigin(repo) {
  try {
    return normalizeRepoUrl(git(repo, ["remote", "get-url", "origin"]).trim());
  } catch {
    return null;
  }
}

/** 台帳 .notices/applied/<fork_id>.md の行のうち picked: のある id(親から先に取った修正) */
export function pickedNoticeIds(repo, forkId) {
  const path = join(repo, ".notices/applied", `${forkId}.md`);
  if (!existsSync(path)) return new Set();
  return new Set([...readFileSync(path, "utf8").matchAll(/^- id:(\S+?)\s*\|.*\|\s*picked:[0-9a-f]{7,40}\b/gm)].map((m) => m[1]));
}

/**
 * 他のリポの物の notice の id: 他のリポの索引に載る・本文の from: が自分の origin でない(origin が分かるときだけ比べる)・台帳に picked:。
 * backfill はこれを書かず、repair はこれを自分の索引から消し、追記だけの検査は消えたこれの行を受け入れる
 */
export function foreignNoticeIds(repo, forkId) {
  const out = new Set(readIndexes(repo).filter((ix) => ix.owner !== forkId).flatMap((ix) => ix.rows.map((r) => r.id)));
  for (const id of pickedNoticeIds(repo, forkId)) out.add(id);
  const origin = ownOrigin(repo);
  if (origin) {
    for (const [id, p] of noticeFiles(repo)) {
      const from = readFileSync(join(repo, p), "utf8").match(/^from:\s*(\S+)/m)?.[1];
      if (from && from.includes("/") && normalizeRepoUrl(from) !== origin) out.add(id);
    }
  }
  return out;
}

/** 自分の索引から他のリポの物の行を消す。消した id を返す(無ければ空、ファイルも書かない) */
export function repair(repo) {
  const forkId = ownForkId(repo);
  const path = indexPath(repo, forkId);
  if (!existsSync(path)) return [];
  const foreign = foreignNoticeIds(repo, forkId);
  const text = readFileSync(path, "utf8");
  const removed = [];
  const kept = text.split("\n").filter((l) => {
    if (!l.startsWith("- id:")) return true;
    const id = parseRow(l).id;
    if (!foreign.has(id)) return true;
    removed.push(id);
    return false;
  });
  if (removed.length) writeFileSync(path, kept.join("\n"));
  return removed;
}

/** notice を足した commit を全部(--full-history: 親から先に pick した fork では上流の元の add と fork の cherry-pick の両方)。新しい順 */
export function noticeAddCommits(repo, id) {
  const out = git(repo, ["log", "--full-history", "--diff-filter=A", "--format=%H", "HEAD", "--", `.notices/${id}.md`, `.notices/done/${id}.md`]).trim();
  return out ? out.split("\n") : [];
}

const isAncestorIn = (repo, a, b) => {
  try {
    git(repo, ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    return false;
  }
};

/**
 * fixes: の参照先 ref が、修正の notice own より履歴で前に出荷されたか。ref の add のどれかが own の add のどれかの祖先なら前
 * (pick した fork でも上流の元の add が祖先になる)。own が未 commit なら ref が commit 済みであればよい。ref が未 commit なら前ではない
 */
export function fixesPointsBack(repo, refId, ownId) {
  const refs = noticeAddCommits(repo, refId);
  if (!refs.length) return false;
  const owns = noticeAddCommits(repo, ownId);
  if (!owns.length) return true;
  return refs.some((r) => owns.some((o) => r !== o && isAncestorIn(repo, r, o)));
}

/**
 * 追記だけ: 前に push した版の行が、今の版の先頭に同じ順・同じ文字で並ぶこと(行でない頭書きは見ない)。[理由]
 * removable = 消してよい id(自分の索引に紛れた他のリポの物、repair が消す)。消えたその行だけは比べない
 */
export function checkAppendOnly(prevText, curText, file = "", removable = new Set()) {
  const curAll = curText.split("\n").filter((l) => l.startsWith("- id:"));
  const curIds = new Set(curAll.map((l) => parseRow(l).id));
  const prev = prevText.split("\n").filter((l) => l.startsWith("- id:") && !(removable.has(parseRow(l).id) && !curIds.has(parseRow(l).id)));
  const cur = curAll;
  const problems = [];
  for (let i = 0; i < prev.length; i++) {
    if (cur[i] === prev[i]) continue;
    const id = parseRow(prev[i]).id;
    const now = cur.findIndex((l) => l === prev[i]);
    problems.push(
      now >= 0
        ? `${file}: ${id}: push 済みの行の位置が変わった(${i + 1} → ${now + 1} 行目。行は末尾に足すだけ)`
        : `${file}: ${id}: push 済みの行が変わった・消えた(行は書き換えない。区切りを外すのは修正の notice の skip_checkpoint:)`,
    );
    break;
  }
  return problems;
}

/** 前に push した版を比べる ref(今のブランチの @{u}、無ければ origin/HEAD)。無ければ null */
export function pushedRef(repo) {
  for (const ref of ["@{u}", "origin/HEAD"]) {
    try {
      return git(repo, ["rev-parse", "--verify", "-q", ref]).trim();
    } catch {
      /* 次へ */
    }
  }
  return null;
}

/**
 * 追記だけの検査で比べる版: HEAD と前に push した版 ref の分かれ目(merge-base)。
 * 手元が ref と同じか先 → ref そのもの(今までと同じ)| 手元が古いだけ → HEAD(後から出荷された行は手元の履歴に無いので求めない)|
 * 枝分かれ → 分かれ目(その時点にあった行の書き換え・削除は落ちる)| 分かれ目が求まらない(履歴がつながらない)→ ref(強い側)
 */
export function appendOnlyBase(repo, ref) {
  try {
    return git(repo, ["merge-base", "HEAD", ref]).trim() || ref;
  } catch {
    return ref;
  }
}

/** 全索引の追記だけの検査(HEAD と ref の分かれ目の版と比べる: appendOnlyBase)。ref が無ければ { unverified } */
export function appendOnlyProblems(repo, ref = pushedRef(repo)) {
  if (!ref) return { unverified: "前に push した版が分からない(@{u} も origin/HEAD も無い)", problems: [] };
  const base = appendOnlyBase(repo, ref);
  const problems = [];
  let own = null;
  try {
    own = ownForkId(repo);
  } catch {
    own = null;
  }
  const foreign = own ? foreignNoticeIds(repo, own) : new Set();
  for (const ix of readIndexes(repo)) {
    let prev = "";
    try {
      prev = git(repo, ["show", `${base}:${ix.file}`]);
    } catch {
      prev = ""; // まだ push していない(分かれ目の版に無い)ファイル
    }
    problems.push(...checkAppendOnly(prev, ix.text, ix.file, ix.owner === own ? foreign : new Set()));
  }
  return { problems };
}

/** 各 notice を最初に足した commit(done/ への移動は最も古い追加)。id → sha */
export function addCommits(repo) {
  const out = new Map();
  const log = git(repo, ["-c", "core.quotePath=false", "log", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", "HEAD", "--", ".notices/"]);
  let cur = null;
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) cur = line.slice(1);
    else {
      const m = line.match(NOTICE_FILE);
      if (m && cur) out.set(m[1], cur); // 新しい順に出るので最後 = 最も古い
    }
  }
  return out;
}

/** 行と本文: 本文 1 本に全索引でちょうど 1 行・欄が一致(pick: は行だけでよい)、まだ commit していない notice は自分の索引に。[理由] */
export function checkRows({ indexes, notices, own, pending = new Set() }) {
  const problems = [];
  const where = new Map();
  for (const ix of indexes) {
    for (const r of ix.rows) {
      if (where.has(r.id)) problems.push(`${r.id}: 行が 2 本ある(${where.get(r.id).file} と ${ix.file})`);
      else where.set(r.id, { file: ix.file, owner: ix.owner, row: r });
    }
  }
  for (const [id, text] of notices) {
    const at = where.get(id);
    if (!at) {
      problems.push(`${id}: 本文があるのに索引に行が無い(出荷する notice は node scripts/workflow/notices/shippedIndex.mjs add <notice>)`);
      continue;
    }
    if (pending.has(id) && at.owner !== own) problems.push(`${id}: まだ commit していない notice の行が自分の索引(${SHIPPED_DIR}/${own}.md)に無い(${at.file})`);
    const want = rowFieldsFromNotice(text).fields;
    const got = at.row.fields;
    for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) {
      if (k === "pick" && !(k in want)) continue;
      if (want[k] !== got[k]) problems.push(`${id}: ${k}: 本文 ${want[k] ?? "(無い)"} / 行 ${got[k] ?? "(無い)"}`);
    }
  }
  return problems;
}

const list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter((s) => s && s !== "-");

/** uses: のパスが実在し(exists(path))、.notices/ の下は .notices/<id>.<名前>.mjs、uses: を持つ notice は区切り。[理由] */
export function checkUses(row, exists) {
  const paths = list(row.fields.uses);
  if (!paths.length) return [];
  const problems = [];
  if (row.fields.checkpoint === "-") problems.push(`${row.id}: uses: を持つ notice は区切り(checkpoint: - にしない。移行・codemod が消えた木に merge しうる)`);
  for (const p of paths) {
    if (p.startsWith(".notices/") && !(p.startsWith(`.notices/${row.id}.`) && p.endsWith(".mjs") && !p.slice(`.notices/${row.id}.`.length).includes("/"))) {
      problems.push(`${row.id}: uses: ${p}: .notices/ の codemod は .notices/${row.id}.<名前>.mjs`);
    }
    if (!exists(p)) problems.push(`${row.id}: uses: ${p} が notice を足した commit に無い(移行・codemod は notice と同じ commit で出す)`);
  }
  return problems;
}

/** skip_checkpoint: <id> の条件(修正元の区切りを外せるのは、先に取れない修正だけ)。[理由] */
export function checkSkipCheckpoint(row, rowsById) {
  const targets = list(row.fields.skip_checkpoint);
  if (!targets.length) return [];
  const problems = [];
  const fixes = list(row.fields.fixes);
  if (row.fields.checkpoint === "-") problems.push(`${row.id}: skip_checkpoint: を書く修正の notice 自身は区切り(checkpoint: - にしない)`);
  if (row.fields.pick === "clean") problems.push(`${row.id}: pick: clean の修正は先に取れるので skip_checkpoint: は要らない`);
  for (const t of targets) {
    if (!fixes.includes(t)) problems.push(`${row.id}: skip_checkpoint: ${t} が fixes: に無い(外せるのは自分が直す修正元の区切りだけ)`);
    const target = rowsById.get(t);
    if (!target) {
      problems.push(`${row.id}: skip_checkpoint: ${t} の行が索引に無い`);
      continue;
    }
    if (!("checkpoint" in target.fields) || target.fields.checkpoint === "-") problems.push(`${row.id}: skip_checkpoint: ${t} は checkpoint がラベルでない(外せるのはラベル → - だけ)`);
    if (list(target.fields.uses).length) problems.push(`${row.id}: skip_checkpoint: ${t} は uses: を持つので区切りを外せない`);
  }
  return problems;
}

/** 今ある notice(未 commit を含む)の id → 本文 */
function noticeTexts(repo) {
  return new Map([...noticeFiles(repo)].map(([id, p]) => [id, readFileSync(join(repo, p), "utf8")]));
}

/** まだ commit していない notice の id(git status) */
export function pendingNoticeIds(repo) {
  const out = git(repo, ["-c", "core.quotePath=false", "status", "--porcelain", "--untracked-files=all", "--", ".notices/"]);
  return new Set(out.split("\n").map((l) => l.slice(3).trim().match(NOTICE_FILE)?.[1]).filter(Boolean));
}

/** 索引の検査を全部(追記だけ・行と本文・uses:・skip_checkpoint:)。{ problems, unverified } */
export function checkAll(repo, { ref } = {}) {
  const own = ownForkId(repo);
  const indexes = readIndexes(repo);
  const pending = pendingNoticeIds(repo);
  const problems = checkRows({ indexes, notices: noticeTexts(repo), own, pending });
  const rows = indexes.flatMap((ix) => ix.rows);
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const adds = addCommits(repo);
  for (const r of rows) {
    const commit = adds.get(r.id);
    const exists = (p) => {
      if (!commit || pending.has(r.id)) return existsSync(join(repo, p));
      try {
        git(repo, ["cat-file", "-e", `${commit}:${p}`]);
        return true;
      } catch {
        return false;
      }
    };
    problems.push(...checkUses(r, exists), ...checkSkipCheckpoint(r, rowsById));
  }
  const ao = appendOnlyProblems(repo, ref === undefined ? pushedRef(repo) : ref);
  problems.push(...ao.problems);
  return { problems, unverified: ao.unverified ?? null };
}

/** verify(CLI): checkAll と、自分の索引があること */
export function verify(repo) {
  const forkId = ownForkId(repo);
  if (!existsSync(indexPath(repo, forkId)) && pendingNoticeIds(repo).size === 0 && readIndexes(repo).length === 0) return [`${SHIPPED_DIR}/${forkId}.md が無い`];
  return checkAll(repo).problems;
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const [cmd, ...rest] = argv;
  try {
    if (cmd === "add" && rest.length) {
      for (const r of add(repo, rest)) log(`shipped-index: 足した ${r.length > 120 ? `${r.slice(0, 117)}...` : r}`);
      return 0;
    }
    if (cmd === "refresh" && rest.length) {
      for (const r of refresh(repo, rest)) log(`shipped-index: 作り直した ${r.length > 120 ? `${r.slice(0, 117)}...` : r}`);
      return 0;
    }
    if (cmd === "repair") {
      const removed = repair(repo);
      log(removed.length ? `shipped-index: 他のリポの物の行を消した: ${removed.join(", ")}` : "shipped-index: 消す行は無い");
      return 0;
    }
    if (cmd === "backfill") {
      log(`shipped-index: ${backfill(repo).length} 行を起こした`);
      return 0;
    }
    if (cmd === "verify") {
      const problems = verify(repo);
      for (const p of problems) log(`shipped-index: ${p}`);
      if (!problems.length) log(`shipped-index: 一致(${readIndexes(repo).reduce((n, ix) => n + ix.rows.length, 0)} 行)`);
      return problems.length ? 1 : 0;
    }
  } catch (e) {
    log(`shipped-index: できない — ${e.message}`);
    return 2;
  }
  log("usage: node scripts/workflow/notices/shippedIndex.mjs <add <notice>... | refresh <notice>... | backfill | repair | verify>");
  return 2;
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
