// scripts/notices/shippedIndex.mjs
// 出荷した notice の消えない索引 .notices/shipped/<fork_id>.md(1 notice = 1 行、追記だけ)を、notice 本文から機械で作る。
// 行は手で書かない。書くのは索引の持ち主のリポだけ(台帳 .notices/applied/<fork_id>.md と同じ理由: 多段の merge で追記が重ならない)。
// 仕様: .notices/README.md
//
// 実行: node scripts/notices/shippedIndex.mjs <add <notice>... | backfill | verify>
//   add <notice>...  自分の索引の末尾に、その notice の行を 1 本ずつ足す(/ship が notice を出荷する commit の前に)
//   backfill         .notices/ 直下と done/ の全 notice の行を、最初に足した commit の履歴順(同じ commit は id 順)に起こす(索引の導入時に 1 回)
//   verify           自分の索引の行と今ある本文の一致・id の過不足を見る(本文の無い行は飛ばす: 本文は区間が閉じれば消してよい)
//   exit 0 = 済み / 一致 | 1 = 食い違い(一覧) | 2 = できない(理由)
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readForkIdentity } from "../../src/lib/forkOwnership/forkIds.mjs";

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
  return `# SHIPPED ${forkId}\n> .notices/shipped/<fork_id>.md: notices this repo shipped, 1 line each, append only, written by scripts/notices/shippedIndex.mjs (never by hand). spec: .notices/README.md\n\n`;
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

/** 今ある全 notice の行を履歴順に起こす(索引が既にあれば止まる) */
export function backfill(repo) {
  const forkId = ownForkId(repo);
  const path = indexPath(repo, forkId);
  if (existsSync(path)) throw new Error(`${SHIPPED_DIR}/${forkId}.md が既にある(起こすのは導入時の 1 回だけ。足すのは add)`);
  const files = noticeFiles(repo);
  const order = historyOrder(repo, new Set(files.keys()));
  const rows = order.map((id) => formatRow(rowFieldsFromNotice(readFileSync(join(repo, files.get(id)), "utf8"))));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, header(forkId) + rows.map((r) => `${r}\n`).join(""));
  return rows;
}

/** 索引と本文の食い違い: [理由]。本文の無い行は飛ばす(区間が閉じた本文は消してよい) */
export function verify(repo) {
  const forkId = ownForkId(repo);
  const path = indexPath(repo, forkId);
  if (!existsSync(path)) return [`${SHIPPED_DIR}/${forkId}.md が無い`];
  const rows = parseIndex(readFileSync(path, "utf8"));
  const problems = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.id)) problems.push(`${r.id}: 行が 2 本ある`);
    seen.add(r.id);
  }
  const files = noticeFiles(repo);
  for (const [id, p] of files) {
    if (!seen.has(id)) {
      problems.push(`${id}: 本文 ${p} があるのに索引に行が無い`);
      continue;
    }
    const want = rowFieldsFromNotice(readFileSync(join(repo, p), "utf8")).fields;
    const got = rows.find((r) => r.id === id).fields;
    // pick: は出荷の後に pick-check が行に書く(本文には書かない)ので、本文に無ければ比べない
    const keys = new Set([...Object.keys(want), ...Object.keys(got)]);
    for (const k of keys) {
      if (k === "pick" && !(k in want)) continue;
      if (want[k] !== got[k]) problems.push(`${id}: ${k}: 本文 ${want[k] ?? "(無い)"} / 行 ${got[k] ?? "(無い)"}`);
    }
  }
  return problems;
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const [cmd, ...rest] = argv;
  try {
    if (cmd === "add" && rest.length) {
      for (const r of add(repo, rest)) log(`shipped-index: 足した ${r.length > 120 ? `${r.slice(0, 117)}...` : r}`);
      return 0;
    }
    if (cmd === "backfill") {
      log(`shipped-index: ${backfill(repo).length} 行を起こした`);
      return 0;
    }
    if (cmd === "verify") {
      const problems = verify(repo);
      for (const p of problems) log(`shipped-index: ${p}`);
      if (!problems.length) log(`shipped-index: 一致(${parseIndex(readFileSync(indexPath(repo, ownForkId(repo)), "utf8")).length} 行)`);
      return problems.length ? 1 : 0;
    }
  } catch (e) {
    log(`shipped-index: できない — ${e.message}`);
    return 2;
  }
  log("usage: node scripts/notices/shippedIndex.mjs <add <notice>... | backfill | verify>");
  return 2;
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
