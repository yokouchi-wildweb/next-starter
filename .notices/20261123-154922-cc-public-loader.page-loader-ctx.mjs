#!/usr/bin/env node
// .notices/20261123-154922-cc-public-loader.page-loader-ctx.mjs
// ページの loader の load の文脈を { user, allows } から { getUser, allows }(どちらも非同期)へ直す移行。fork のリポのルートで走らせる。
// 使い方: node .notices/20261123-154922-cc-public-loader.page-loader-ctx.mjs [--apply]
//   既定は dry-run(直すファイルと止めた所の一覧を出すだけ)。--apply で書く。何度走らせても同じ結果(2 回目は変更 0)
//
// 触る物(git が追う src/**/*.{ts,tsx,mts}):
//   (a) `load: async ({ user }, …) => …` の分割の user → `{ getUser }` にし、本体の頭に `const user = await getUser();`
//       (式の体は `{ const user = await getUser(); return <式>; }` に)
//   (b) 分割の allows → 本体の `allows(…)` の呼び出しを `await allows(…)` に(前が ! か後ろにメンバーの参照が続けば括弧で包む。既に await の物・値として渡す allows はそのまま)
//   (c) 直したファイルのコメントの `ctx.user` → `getUser()`、`ctx.allows` → `allows()`
//   (d) test の偽の ctx: `.load({ user: <式> }` → `.load({ getUser: async () => <式> }`、コメントの `load({ user }` → `load({ getUser }`
//   (e) 空の load の行(`load: async (): Promise<void> => {},` / `load: async () => {},`)を消す(load の無い loader = データの無いページ。公開の鎖では殻に入る)。
//       test のファイルは触らない。load が DB・保管庫・request を読まない時の `shell: true` は意味の判断なので足さない(notice の手順で見る)
// 止める物(書かずに一覧に出す): 分割に user・allows 以外の名・改名・既定値・残余がある、ctx を名前で受けて ctx.user / ctx.allows を読む、
//   本体で user を代入し直す
// 触らない物: 文脈を読まない load(`async () =>`・`async (_ctx, …) =>`)、API の Factory と proxy の ctx.user(別の物)
// fork の手順:
// 1. この notice の区間を /flux で取り込む
// 2. dry-run で一覧を見る(止めた物は意味を読んで手で直す: `const user = await getUser()`・`await allows(rule)`)
// 3. --apply → pnpm typecheck(残りは型で落ちる)→ git diff で確かめてコミット
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** 対象のファイル */
export const TARGET = /^src\/.+\.(?:ts|tsx|mts)$/;
const TEST_FILE = /\.test\.(?:ts|tsx|mts)$/;
const OPEN = { "(": ")", "{": "}", "[": "]" };
/** 空の load の行(load の無い loader に直す) */
const EMPTY_LOAD = /^[ \t]*load\s*:\s*async\s*\(\s*\)\s*(?::\s*Promise<void>\s*)?=>\s*\{\s*\}\s*,?[ \t]*$/m;

/** 文字列・テンプレート・コメントを飛ばした次の位置(飛ばす物でなければ i) */
const skipLiteral = (text, i) => {
  const c = text[i];
  if (c === "/" && text[i + 1] === "/") {
    const end = text.indexOf("\n", i);
    return end === -1 ? text.length : end;
  }
  if (c === "/" && text[i + 1] === "*") {
    const end = text.indexOf("*/", i + 2);
    return end === -1 ? text.length : end + 2;
  }
  if (c === '"' || c === "'" || c === "`") {
    let j = i + 1;
    while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  return i;
};

/** text[open] の括弧に対応する閉じ括弧の位置(見つからなければ -1) */
export const matchClose = (text, open) => {
  const stack = [OPEN[text[open]]];
  let i = open + 1;
  while (i < text.length) {
    const skipped = skipLiteral(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const c = text[i];
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
    i++;
  }
  return -1;
};

/** from から深さ 0 で stops のどれかが現れる位置(括弧・<>・文字列を飛ばす) */
const scanTo = (text, from, stops) => {
  let depth = 0;
  let i = from;
  while (i < text.length) {
    const skipped = skipLiteral(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    if (depth === 0) for (const s of stops) if (text.startsWith(s, i)) return i;
    const c = text[i];
    if (c === "(" || c === "{" || c === "[" || c === "<") depth++;
    else if ((c === ")" || c === "}" || c === "]" || (c === ">" && text[i - 1] !== "=")) && depth > 0) depth--;
    else if ((c === ")" || c === "}" || c === "]") && depth === 0) return i;
    i++;
  }
  return -1;
};

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const indentAt = (text, index) => /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", index - 1) + 1))[0];

/** 本体の allows(…) の呼び出しを await allows(…) に(既に await の物・.allows(・値の allows はそのまま) */
const awaitAllows = (body) => {
  let out = "";
  let i = 0;
  while (i < body.length) {
    const skipped = skipLiteral(body, i);
    if (skipped !== i) {
      out += body.slice(i, skipped);
      i = skipped;
      continue;
    }
    if (body.startsWith("allows(", i) && !/[\w$.]$/.test(body.slice(0, i)) && !/await\s+$/.test(out)) {
      const open = i + "allows".length;
      const close = matchClose(body, open);
      if (close !== -1) {
        const call = `await allows(${awaitAllows(body.slice(open + 1, close))})`;
        // 前が ! か、後ろにメンバーの参照が続く時は括弧で包む(読みやすさと優先順位。if (await x) はそのまま)
        out += /!\s*$/.test(out) || /^\s*(?:\.|\?\.|\[)/.test(body.slice(close + 1)) ? `(${call})` : call;
        i = close + 1;
        continue;
      }
    }
    out += body[i];
    i++;
  }
  return out;
};

/** 1 つの load を直す。直せなければ { stop: 理由 }、触らなければ null */
const rewriteLoad = (text, at) => {
  const paramsOpen = text.indexOf("(", at);
  const paramsClose = matchClose(text, paramsOpen);
  if (paramsClose === -1) return { stop: "引数の括弧が閉じない" };
  const params = text.slice(paramsOpen + 1, paramsClose).trim();
  const arrow = scanTo(text, paramsClose + 1, ["=>"]);
  if (arrow === -1) return { stop: "矢印関数でない" };
  let bodyStart = arrow + 2;
  while (/\s/.test(text[bodyStart])) bodyStart++;
  const block = text[bodyStart] === "{";
  const bodyEnd = block ? matchClose(text, bodyStart) + 1 : scanTo(text, bodyStart, [","]);
  if (bodyEnd <= 0) return { stop: "本体の終わりが分からない" };
  const body = text.slice(bodyStart, bodyEnd);

  if (!params.startsWith("{")) {
    const name = /^([A-Za-z_$][\w$]*)/.exec(params)?.[1];
    if (name && new RegExp(`\\b${name}\\s*\\.\\s*(?:user|allows)\\b`).test(body)) return { stop: `文脈を名前 ${name} で受けて ${name}.user / ${name}.allows を読む` };
    return null;
  }
  const destructClose = matchClose(params, 0);
  const names = params.slice(1, destructClose).split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return null;
  if (names.some((n) => n !== "user" && n !== "allows" && n !== "getUser") || (names.includes("user") && names.includes("getUser"))) {
    return { stop: `分割に user・allows 以外の形がある: { ${names.join(", ")} }` };
  }
  const hasUser = names.includes("user");
  if (hasUser && /(?:^|[^\w$.])user\s*(?:[-+*/]?=(?!=)|\+\+|--)/.test(body)) return { stop: "本体で user を代入し直している" };

  let newBody = names.includes("allows") ? awaitAllows(body) : body;
  if (hasUser) {
    if (block) {
      const inner = indentAt(text, bodyStart) + "  ";
      newBody = `{\n${inner}const user = await getUser();${newBody.slice(1).startsWith("\n") ? "" : "\n" + inner}${newBody.slice(1)}`;
    } else {
      const base = indentAt(text, at);
      let expr = newBody.trim();
      if (expr.startsWith("(") && matchClose(expr, 0) === expr.length - 1) expr = expr.slice(1, -1).trim();
      newBody = `{\n${base}  const user = await getUser();\n${base}  return ${expr};\n${base}}`;
    }
  }
  const newNames = names.map((n) => (n === "user" ? "getUser" : n));
  const newParams = `{ ${newNames.join(", ")} }${params.slice(destructClose + 1)}`;
  const replaced =
    text.slice(0, paramsOpen + 1) + newParams + text.slice(paramsClose, bodyStart) + newBody + text.slice(bodyEnd);
  return replaced === text ? null : { text: replaced };
};

/** コメントの行の ctx.user / ctx.allows を新しい名に */
const rewriteComments = (text) =>
  text
    .split("\n")
    .map((line) => (/^\s*(?:\/\/|\*|\/\*)/.test(line) ? line.replace(/\bctx\.user\b(?!\(\))/g, "getUser()").replace(/\bctx\.allows\b/g, "allows()") : line))
    .join("\n");

/**
 * 1 つのファイルの文を直す
 * @returns {{ text: string, changed: number[], stopped: { line: number, reason: string }[] }} 行番号は 1 始まり(元の文の)
 */
export const rewrite = (text, { test = false } = {}) => {
  let out = text;
  const changed = [];
  const stopped = [];
  // load: async ( の位置を後ろから直す(前の位置がずれない)
  const sites = [...text.matchAll(/\bload\s*:\s*async\s*\(/g)].map((m) => m.index);
  for (const at of sites.reverse()) {
    const r = rewriteLoad(out, at);
    if (!r) continue;
    if (r.stop) stopped.push({ line: lineOf(text, at), reason: r.stop });
    else {
      out = r.text;
      changed.push(lineOf(text, at));
    }
  }
  if (!test) {
    // (e) 空の load の行を消す(行番号は元の文の物)
    const lines = out.split("\n");
    const kept = lines.filter((line) => !EMPTY_LOAD.test(line));
    if (kept.length !== lines.length) {
      for (const m of text.matchAll(new RegExp(EMPTY_LOAD.source, "gm"))) changed.push(lineOf(text, m.index));
      out = kept.join("\n");
    }
  }
  if (test) {
    const before = out;
    out = out.replace(/\.load\(\{\s*user:\s*([^{}]+?)\s*\}/g, (_m, value) => `.load({ getUser: async () => ${value} }`);
    out = out.replace(/load\(\{ user \}/g, "load({ getUser }");
    if (out !== before) for (const m of text.matchAll(/\.load\(\{\s*user:|load\(\{ user \}/g)) changed.push(lineOf(text, m.index));
  }
  if (changed.length) out = rewriteComments(out);
  return { text: out, changed: [...new Set(changed)].sort((a, b) => a - b), stopped: stopped.reverse() };
};

/** 計画: ファイルごとの直す所と止めた所 */
export const plan = (root) => {
  const tracked = execFileSync("git", ["ls-files", "-z", "--", "src"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((f) => TARGET.test(f));
  const files = [];
  for (const path of tracked) {
    let text;
    try {
      text = readFileSync(join(root, path), "utf8");
    } catch {
      continue; // 消えた追跡中のファイル(作業中の削除)
    }
    if (!/\bload\s*:\s*async\s*\(|\.load\(\{/.test(text)) continue;
    const r = rewrite(text, { test: TEST_FILE.test(path) });
    if (r.changed.length || r.stopped.length) files.push({ path, ...r });
  }
  return { files };
};

/** 書く(直す所のあるファイルだけ) */
export const apply = (root, planned) => {
  for (const f of planned.files) if (f.changed.length) writeFileSync(join(root, f.path), f.text);
};

const main = () => {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--apply");
  if (unknown.length) {
    console.error(`知らない引数: ${unknown.join(" ")}`);
    process.exit(2);
  }
  const root = process.cwd();
  const planned = plan(root);
  let count = 0;
  for (const f of planned.files) {
    for (const line of f.changed) {
      count++;
      console.log(`${f.path}:${line}  load を新しい形に(文脈 { getUser, allows }・空の load を外す)`);
    }
    for (const s of f.stopped) console.log(`止めた ${f.path}:${s.line}(手で直す: const user = await getUser() / await allows(rule)): ${s.reason}`);
  }
  const stoppedCount = planned.files.reduce((n, f) => n + f.stopped.length, 0);
  console.log(`変更 ${count} か所 / 止めた ${stoppedCount} か所${args.includes("--apply") ? "" : "(dry-run: --apply で書く)"}`);
  if (args.includes("--apply")) apply(root, planned);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
