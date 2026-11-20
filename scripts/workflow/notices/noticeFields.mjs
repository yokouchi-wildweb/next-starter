// scripts/workflow/notices/noticeFields.mjs
// notice の本文の欄どうしの検査(uses:・skip_checkpoint:・fixes: の前後)。pnpm check notices(notices.test.mjs)が回す。
// 出荷済みの一覧の正は履歴(索引は持たない、D350): 欄は本文の最後の版(作業ツリーに有ればその版、消えていれば消す前の版)で読む。
// 仕様: .notices/README.md
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;

function git(repo, args, input) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: repo, encoding: "utf8", input, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 512 * 1024 * 1024 });
}

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

/**
 * 本文の最後の版の欄: id → fields。作業ツリー(.notices/ 直下と done/、未 commit を含む)に有ればその版、
 * 無ければ履歴で最後に消す前の版
 */
export function lastNoticeFields(repo) {
  const out = new Map();
  for (const dir of [".notices", ".notices/done"]) {
    const abs = join(repo, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const id = NOTICE_FILE.exec(`${dir}/${f}`)?.[1];
      if (id) out.set(id, noticeHead(readFileSync(join(abs, f), "utf8")).fields);
    }
  }
  const specs = [];
  let cur = null;
  for (const line of git(repo, ["log", "--no-renames", "--diff-filter=D", "--name-only", "--format=@%H", "HEAD", "--", ".notices/"]).split("\n")) {
    if (line.startsWith("@")) cur = line.slice(1);
    else {
      const id = NOTICE_FILE.exec(line)?.[1];
      if (id && cur && !out.has(id) && !specs.some((s) => s.id === id)) specs.push({ id, spec: `${cur}^:${line}` }); // 新しい順 → 最初 = 最後に消した
    }
  }
  if (!specs.length) return out;
  const buf = execFileSync("git", ["cat-file", "--batch"], { cwd: repo, input: specs.map((s) => s.spec).join("\n") + "\n", maxBuffer: 512 * 1024 * 1024 });
  let at = 0;
  for (const { id } of specs) {
    const nl = buf.indexOf(10, at);
    const head = buf.subarray(at, nl).toString("utf8");
    if (head.endsWith(" missing")) {
      at = nl + 1;
      continue;
    }
    const size = Number(head.split(" ")[2]);
    out.set(id, noticeHead(buf.subarray(nl + 1, nl + 1 + size).toString("utf8")).fields);
    at = nl + 1 + size + 1;
  }
  return out;
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

const list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter((s) => s && s !== "-");

/** uses: のパスが実在し(exists(path))、.notices/ の下は .notices/<id>.<名前>.mjs、uses: を持つ notice は区切り。[理由] */
export function checkUses({ id, fields }, exists) {
  const paths = list(fields.uses);
  if (!paths.length) return [];
  const problems = [];
  if (fields.checkpoint === "-") problems.push(`${id}: uses: を持つ notice は区切り(checkpoint: - にしない。移行・codemod が消えた木に merge しうる)`);
  for (const p of paths) {
    if (p.startsWith(".notices/") && !(p.startsWith(`.notices/${id}.`) && p.endsWith(".mjs") && !p.slice(`.notices/${id}.`.length).includes("/"))) {
      problems.push(`${id}: uses: ${p}: .notices/ の codemod は .notices/${id}.<名前>.mjs`);
    }
    if (!exists(p)) problems.push(`${id}: uses: ${p} が notice を足した commit に無い(移行・codemod は notice と同じ commit で出す)`);
  }
  return problems;
}

/** skip_checkpoint: <id> の条件(修正元の区切りを外せるのは、先に取れない修正だけ)。byId = 本文の最後の版の欄。[理由] */
export function checkSkipCheckpoint({ id, fields }, byId) {
  const targets = list(fields.skip_checkpoint);
  if (!targets.length) return [];
  const problems = [];
  const fixes = list(fields.fixes);
  if (fields.checkpoint === "-") problems.push(`${id}: skip_checkpoint: を書く修正の notice 自身は区切り(checkpoint: - にしない)`);
  if (fields.pick === "clean") problems.push(`${id}: pick: clean の修正は先に取れるので skip_checkpoint: は要らない`);
  for (const t of targets) {
    if (!fixes.includes(t)) problems.push(`${id}: skip_checkpoint: ${t} が fixes: に無い(外せるのは自分が直す修正元の区切りだけ)`);
    const target = byId.get(t);
    if (!target) {
      problems.push(`${id}: skip_checkpoint: ${t} の本文が履歴に無い`);
      continue;
    }
    if (!("checkpoint" in target) || target.checkpoint === "-") problems.push(`${id}: skip_checkpoint: ${t} は checkpoint がラベルでない(外せるのはラベル → - だけ)`);
    if (list(target.uses).length) problems.push(`${id}: skip_checkpoint: ${t} は uses: を持つので区切りを外せない`);
  }
  return problems;
}

/** 本文の欄どうしの検査を全部(uses:・skip_checkpoint:)。pending = まだ commit していない notice の id。[理由] */
export function checkFields(repo, { pending = new Set() } = {}) {
  const byId = lastNoticeFields(repo);
  const problems = [];
  for (const [id, fields] of byId) {
    let commit;
    const exists = (p) => {
      if (commit === undefined) commit = pending.has(id) ? null : noticeAddCommits(repo, id).at(-1) ?? null; // 要る時だけ引く(uses: のある notice)
      if (!commit) return existsSync(join(repo, p));
      try {
        git(repo, ["cat-file", "-e", `${commit}:${p}`]);
        return true;
      } catch {
        return false;
      }
    };
    problems.push(...checkUses({ id, fields }, exists), ...checkSkipCheckpoint({ id, fields }, byId));
  }
  return problems;
}
