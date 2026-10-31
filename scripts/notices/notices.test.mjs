// scripts/notices/notices.test.mjs
// DOWNSTREAM NOTICE(.notices/*.md)の契約テスト。実行: pnpm test:notices (node:test)
// /ship が notice を出荷する前に通し、/flux が読む書式(見出し行・checkpoint・fixes・covers・moved・resolves)と食い違わないことを確かめる。
// 仕様: .notices/README.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const NOTICES = ".notices";
const DONE = ".notices/done";

// この id 以降の notice は checkpoint: と manual_steps: も必須(それより前は欄の無い旧 schema が残っている)
export const STRICT_FROM = "20261029-121450";
const REQUIRED = ["from", "date", "severity", "change", "why", "required_actions", "verify", "refs", "notes"];
const REQUIRED_STRICT = ["checkpoint", "manual_steps"];
const SEVERITIES = ["breaking", "action-required", "info"];

/** notice 本文を { id, fields } にする。fields は行頭の `key:` の値(複数行の欄は 1 行目だけ) */
export function parseNotice(text) {
  const lines = text.split("\n");
  const head = lines[0].match(/^# DOWNSTREAM NOTICE id:(\S+)\s*$/);
  const fields = {};
  for (const line of lines.slice(1)) {
    const m = line.match(/^([a-z_]+):\s?(.*)$/);
    if (m && !(m[1] in fields)) fields[m[1]] = m[2].trim();
  }
  return { id: head ? head[1] : null, fields };
}

/** `fixes:` の値を { ids, commits } にする。区切りは `,` */
export function parseFixes(value) {
  const ids = [];
  const commits = [];
  for (const raw of value.split(",")) {
    const token = raw.trim();
    if (!token) continue;
    const c = token.match(/^commit:([0-9a-f]{7,40})$/);
    if (c) commits.push(c[1]);
    else ids.push(token);
  }
  return { ids, commits };
}

/** `moved:` の値を [[old, new], ...] にする。区切りは `;` */
export function parseMoved(value) {
  return value
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => pair.split(/\s+->\s+/).map((p) => p.trim()));
}

function listNotices(dir) {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => /^\d{8}-\d{6}-.+\.md$/.test(f))
    .map((file) => ({ file, path: `${dir}/${file}`, ...parseNotice(readFileSync(join(abs, file), "utf8")) }));
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** notice を追加した commit(done/ へ移したものは元のパスで追加した commit)。未コミットなら null */
function addCommit(id) {
  const out = git(["log", "--diff-filter=A", "--format=%H", "--", `${NOTICES}/${id}.md`, `${DONE}/${id}.md`]).trim();
  return out ? out.split("\n").at(-1) : null;
}

function isAncestor(a, b) {
  try {
    git(["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    return false;
  }
}

function commitExists(sha) {
  try {
    git(["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

const active = listNotices(NOTICES);
const done = listNotices(DONE);
const allIds = new Set([...active, ...done].map((n) => n.id));
// まだコミットされていない notice(= いま出荷しようとしているもの)
const pending = new Set(
  git(["status", "--porcelain", "--untracked-files=all", "--", NOTICES])
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter((p) => p && !p.startsWith(`${DONE}/`) && !p.startsWith(`${NOTICES}/applied/`)),
);

test("見出しの id とファイル名が一致する", () => {
  const problems = [...active, ...done]
    .filter((n) => `${n.id}.md` !== n.file)
    .map((n) => `${n.path}: 1 行目が \`# DOWNSTREAM NOTICE id:${n.file.replace(/\.md$/, "")}\` ではありません`);
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("現役の notice に必須の欄がある", () => {
  const problems = [];
  for (const n of active) {
    const required = n.id >= STRICT_FROM ? [...REQUIRED, ...REQUIRED_STRICT] : REQUIRED;
    const missing = required.filter((k) => !(k in n.fields));
    if (missing.length) problems.push(`${n.path}: ${missing.join(", ")} がありません`);
    if (n.fields.severity !== undefined && !SEVERITIES.includes(n.fields.severity)) {
      problems.push(`${n.path}: severity は ${SEVERITIES.join(" | ")} のどれか`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("checkpoint はラベル(英語ケバブ)か `-` で、ラベルは重ならない", () => {
  const problems = [];
  const seen = new Map();
  for (const n of [...active, ...done]) {
    const cp = n.fields.checkpoint;
    if (cp === undefined || cp === "-") continue;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(cp)) problems.push(`${n.path}: checkpoint "${cp}" が英語ケバブではありません`);
    if (seen.has(cp)) problems.push(`${n.path}: checkpoint "${cp}" が ${seen.get(cp)} と重なっています`);
    else seen.set(cp, n.path);
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

// 前後は id の文字列ではなく履歴で決める(手で付けた id は追加した順と食い違うことがある)
test("fixes: の参照先が実在し、履歴上で自分より前のもの", () => {
  const problems = [];
  for (const n of active) {
    if (n.fields.fixes === undefined) continue;
    const { ids, commits } = parseFixes(n.fields.fixes);
    if (!ids.length && !commits.length) problems.push(`${n.path}: fixes: が空です`);
    // 未コミットの新しい notice は追加 commit が無い(参照先がコミット済みであることだけを見る)
    const own = addCommit(n.id);
    for (const id of ids) {
      if (!allIds.has(id)) {
        problems.push(`${n.path}: fixes: ${id} が .notices/ にも done/ にもありません`);
        continue;
      }
      const ref = addCommit(id);
      if (id === n.id || !ref || (own && (ref === own || !isAncestor(ref, own)))) {
        problems.push(`${n.path}: fixes: ${id} は履歴上で自分より前に出荷された notice ではありません`);
      }
    }
    for (const sha of commits) {
      if (!commitExists(sha)) problems.push(`${n.path}: fixes: commit:${sha} が履歴にありません`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("resolves: は受信箱の指令 id の並び(形・重複)", () => {
  const ORDER_ID = /^\d{8}-\d{6}-[a-z0-9][a-z0-9-]*$/;
  const problems = [];
  for (const n of active) {
    if (n.fields.resolves === undefined) continue;
    const ids = n.fields.resolves.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) problems.push(`${n.path}: resolves: が空です`);
    for (const id of ids) if (!ORDER_ID.test(id)) problems.push(`${n.path}: resolves: ${id} は <YYYYMMDD-HHMMSS>-<slug> の形ではありません`);
    if (new Set(ids).size !== ids.length) problems.push(`${n.path}: resolves: に同じ id が 2 回あります`);
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

// /flux が cherry-pick する commit の条件(.notices/README.md「緊急修正(hotfix)」)
const HOTFIX_FORBIDDEN = new Set(["pnpm-lock.yaml", "src/app/route-map.jsonl"]);

test("hotfix: の notice は本体と同じ 1 commit で、生成物を含まない", () => {
  const problems = [];
  for (const n of active) {
    if (n.fields.hotfix === undefined) continue;
    if (!n.fields.hotfix) problems.push(`${n.path}: hotfix: が空です`);
    const own = addCommit(n.id);
    if (!own) continue; // 未コミット(出荷の前)。commit の中身はまだ無い
    const files = git(["diff-tree", "--no-commit-id", "--name-only", "-r", own]).split("\n").filter(Boolean);
    if (!files.some((file) => !file.startsWith(`${NOTICES}/`))) problems.push(`${n.path}: hotfix: の notice の commit に本体がありません`);
    for (const file of files) {
      if (HOTFIX_FORBIDDEN.has(file)) problems.push(`${n.path}: hotfix: の commit に fork ごとに中身が違う ${file} が入っています`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("covers: の参照先が実在する", () => {
  const problems = [];
  for (const n of active) {
    if (n.fields.covers === undefined) continue;
    for (const id of n.fields.covers.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!allIds.has(id)) problems.push(`${n.path}: covers: ${id} が .notices/ にも done/ にもありません`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("出荷前の notice の moved: が作業ツリーと合う(移動先がある・移動元が無い)", () => {
  const problems = [];
  for (const n of active) {
    if (!pending.has(n.path) || n.fields.moved === undefined) continue;
    for (const pair of parseMoved(n.fields.moved)) {
      if (pair.length !== 2) {
        problems.push(`${n.path}: moved: "${pair.join(" -> ")}" は \`<old> -> <new>\` の形ではありません`);
        continue;
      }
      const [from, to] = pair;
      if (!existsSync(join(repoRoot, to))) problems.push(`${n.path}: moved: 移動先 ${to} がありません`);
      if (existsSync(join(repoRoot, from))) problems.push(`${n.path}: moved: 移動元 ${from} がまだあります`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

// ---- 解析関数の単体テスト ----

test("parseFixes: id と commit を分ける", () => {
  assert.deepEqual(parseFixes("20261028-152652-frame-marks-dims, commit:07924f6c"), {
    ids: ["20261028-152652-frame-marks-dims"],
    commits: ["07924f6c"],
  });
});

test("parseMoved: 組を `;` で分ける", () => {
  assert.deepEqual(parseMoved("a/b.ts -> c/b.ts; d -> e"), [
    ["a/b.ts", "c/b.ts"],
    ["d", "e"],
  ]);
});

test("parseNotice: 見出しと欄を読む", () => {
  const { id, fields } = parseNotice("# DOWNSTREAM NOTICE id:20261029-000000-x\nfrom: a\ncheckpoint: x\nrequired_actions:\n1. do\n");
  assert.equal(id, "20261029-000000-x");
  assert.equal(fields.checkpoint, "x");
  assert.equal(fields.required_actions, "");
});
