// .claude/skills/flux/tip.mjs — 上流の先端の版の道具を、遅れた fork の中で走らせる(/flux の作り直し S2、D313)
// /flux は手順書と道具を上流の先端の版で読む。読み手(pnpm workflow ownership who など)は先端の木から取り出して fork の中で走らせる:
//   git show <upstream>/<branch>:.claude/skills/flux/tip.mjs > <一時ファイル> && node <一時ファイル> --upstream=<upstream>/<branch> \
//     --entry=scripts/workflow/ownership/who.mjs -- --json --base=<区間の merge 先> <path...>
// 自己完結(このファイルの外を import しない。incoming.mjs と同じ): fork の作業ツリーに先端の道具がまだ無くても動く。
//
// 実行: node .claude/skills/flux/tip.mjs --upstream=<ref> --entry=<リポ直下からのパス> [-- <entry へ渡す引数>]
//   1. <ref> を commit に解く(解けない → exit 2)
//   2. entry から相対 import をたどる(先端の木を git cat-file で読む、コメントは外して数える): 静的な `import … from "x"` / `import "x"` /
//      `export … from "x"` と、文字列 1 つの `import("x")`。./ と ../ = たどる | 素の名前・node: = たどらない(fork の node_modules で解く。
//      取り出し先がリポの中なので解ける)| `@/`・`~/`・`#`・`/` で始まる物 = リポの中を名指す import → 止める(exit 2、そのファイルを名指す)
//      先端の木に無いファイル → 止める(exit 2)
//   3. 取り出す: <repo>/.flux/tip/<先端の sha>/<同じパス>(.flux/ は git の外、.gitignore)。もう有れば作り直さずに使う
//      (一時の場所に書き終えてから名前を変えるので、半端な取り出しは使われない)
//   4. node <取り出した entry> <引数> を cwd = fork のリポで走らせ、終了コードをそのまま返す
//   注意: 自分の場所から読むコード(import.meta.url で探すファイル)は取り出し先を読む。そういう entry には読む物を引数で渡す
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

/** 止まる理由(exit 2) */
export class Stop extends Error {}

/** 引数 → { upstream, entry, args }。足りない・知らない引数は Stop */
export function parseArgs(argv) {
  const split = argv.indexOf("--");
  const own = split === -1 ? argv : argv.slice(0, split);
  const args = split === -1 ? [] : argv.slice(split + 1);
  const options = { upstream: undefined, entry: undefined, args };
  for (const arg of own) {
    if (arg.startsWith("--upstream=")) options.upstream = arg.slice("--upstream=".length);
    else if (arg.startsWith("--entry=")) options.entry = arg.slice("--entry=".length);
    else throw new Stop(`知らない引数 ${arg}(entry へ渡す引数は -- の後)`);
  }
  if (!options.upstream || !options.entry) throw new Stop("使い方: node tip.mjs --upstream=<ref> --entry=<path> [-- <args>]");
  return options;
}

/** コメントを外す(文字列・テンプレート・正規表現の中は残す)。改行は残す */
export function stripComments(text) {
  let out = "";
  let i = 0;
  let last = ""; // 直前の空白でない字(/ が割り算か正規表現かの見分け)
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      const end = text.indexOf("*/", i + 2);
      const body = text.slice(i, end === -1 ? text.length : end + 2);
      out += body.replace(/[^\n]/g, "");
      i += body.length;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
      last = c;
      continue;
    }
    if (c === "/" && (last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last) || /(?:^|[^\w$])(?:return|typeof|case|in|of)$/.test(out.trimEnd()))) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== "\n") {
        if (text[j] === "\\") j += 2;
        else {
          if (text[j] === "[") inClass = true;
          else if (text[j] === "]") inClass = false;
          else if (text[j] === "/" && !inClass) break;
          j++;
        }
      }
      out += text.slice(i, j + 1);
      i = j + 1;
      last = "/";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}

const STATIC_IMPORT = /(?:^|[;}\n])\s*(?:import|export)\s+(?:[^'"`;()=]*?\s*from\s*)?(["'])([^"'\n]+)\1/g;
const DYNAMIC_IMPORT = /\bimport\(\s*(["'])([^"'\n]+)\1\s*\)/g;

/** ファイルの中身 → import の名指し(出てきた順、重ねない) */
export function importsOf(text) {
  const code = stripComments(text);
  const found = [];
  for (const re of [STATIC_IMPORT, DYNAMIC_IMPORT]) {
    for (const m of code.matchAll(re)) if (!found.includes(m[2])) found.push(m[2]);
  }
  return found;
}

/** 名指しの種類: relative = たどる | package = たどらない | project = 止める */
export function specifierKind(spec) {
  if (spec.startsWith("./") || spec.startsWith("../")) return "relative";
  if (spec.startsWith("@/") || spec.startsWith("~/") || spec.startsWith("#") || spec.startsWith("/")) return "project";
  return "package";
}

function gitOf(repo) {
  return (args, input) =>
    execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
}

/** <ref> → commit の sha。解けなければ Stop */
export function resolveTip(repo, ref) {
  try {
    return gitOf(repo)(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).trim();
  } catch {
    throw new Stop(`${ref} を commit に解けない(git fetch 済みか)`);
  }
}

/** 先端の木で entry からたどったファイル → Map<path, text>。止める物は Stop */
export function walk(repo, sha, entry) {
  const git = gitOf(repo);
  const files = new Map();
  const queue = [{ path: posix.normalize(entry), from: null }];
  while (queue.length > 0) {
    const { path, from } = queue.shift();
    if (files.has(path)) continue;
    let text;
    try {
      text = git(["cat-file", "blob", `${sha}:${path}`]);
    } catch {
      throw new Stop(`${path} が先端 ${sha.slice(0, 10)} の木に無い${from ? `(${from} が import)` : ""}`);
    }
    files.set(path, text);
    for (const spec of importsOf(text)) {
      const kind = specifierKind(spec);
      if (kind === "project") throw new Stop(`${path} がリポの中を名指す import "${spec}" を持つ(相対 import だけたどれる)`);
      if (kind === "relative") queue.push({ path: posix.normalize(posix.join(posix.dirname(path), spec)), from: path });
    }
  }
  return files;
}

/** 取り出す → { dir, reused, files }。<repo>/.flux/tip/<sha>/ に entry が有ればそのまま使う */
export function extract(repo, sha, entry) {
  const dir = join(repo, ".flux", "tip", sha);
  if (existsSync(join(dir, entry))) return { dir, reused: true, files: null };
  const files = walk(repo, sha, entry);
  // 同じ sha で別の entry を取り出した後(who → selfKeep → phases/run.mjs): その closure の足りないファイルだけを足す。
  // 同じ sha の木なので、有るファイルは同じ中身(上書きしない)。捨てると 2 つ目の entry が MODULE_NOT_FOUND(Polaris線 F1)
  if (existsSync(dir)) {
    const added = [];
    for (const [path, text] of files) {
      const to = join(dir, path);
      if (existsSync(to)) continue;
      mkdirSync(dirname(to), { recursive: true });
      const tmp = `${to}.partial-${process.pid}`;
      writeFileSync(tmp, text);
      renameSync(tmp, to);
      added.push(path);
    }
    return { dir, reused: false, files: added };
  }
  const partial = `${dir}.partial-${process.pid}`;
  rmSync(partial, { recursive: true, force: true });
  for (const [path, text] of files) {
    mkdirSync(dirname(join(partial, path)), { recursive: true });
    writeFileSync(join(partial, path), text);
  }
  if (existsSync(dir)) rmSync(partial, { recursive: true, force: true });
  else renameSync(partial, dir);
  return { dir, reused: false, files: [...files.keys()] };
}

/** 走らせる → 終了コード */
export function run(cwd, argv) {
  try {
    const options = parseArgs(argv);
    let repo;
    try {
      repo = gitOf(cwd)(["rev-parse", "--show-toplevel"]).trim();
    } catch {
      throw new Stop(`${cwd} は git のリポでない`);
    }
    const sha = resolveTip(repo, options.upstream);
    const { dir } = extract(repo, sha, options.entry);
    const child = spawnSync(process.execPath, [join(dir, options.entry), ...options.args], { cwd: repo, stdio: "inherit" });
    if (child.error) throw new Stop(`node を起こせない: ${child.error.message}`);
    return child.status ?? 1;
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    console.error(`tip: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.cwd(), process.argv.slice(2));
