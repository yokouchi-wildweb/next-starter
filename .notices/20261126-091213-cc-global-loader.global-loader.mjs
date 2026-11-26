#!/usr/bin/env node
// .notices/20261126-091213-cc-global-loader.global-loader.mjs
// 区切り cc-global-loader の移し替えの道具(D111・D114): useGlobalLoader の呼び手を「showLoader の戻り値(終わりの関数)を finally で
// 呼ぶ」形へ移す。引数なしの hideLoader() は消えた(型で落ちる)。リポのルートで走らせる。何度走らせても同じ結果になる。
//
//   node .notices/20261126-091213-cc-global-loader.global-loader.mjs            # dry-run(既定、書かない)
//   node .notices/20261126-091213-cc-global-loader.global-loader.mjs --apply    # 書く
//   --root=<dir>(既定 .)
//
// 書き換える形(TypeScript の構文木で読み、字面を差し替える。src の .ts/.tsx、src/lib/globalLoader は除く):
//   const { showLoader, hideLoader } = useGlobalLoader();   →  const { showLoader } = useGlobalLoader();
//   (a) 同じ関数で showLoader(…) の文が 1 つ、hideLoader() が全部その後ろの同じ塊の try の finally の中:
//       showLoader(x); try { … } finally { hideLoader(); }  →  const endLoader = showLoader(x); try { … } finally { endLoader(); }
//   (b) 同じ関数で showLoader(…) の文が 1 つ、hideLoader() の文が 1 つで同じ塊の後ろ:
//       showLoader(x); A; B; hideLoader();                  →  const endLoader = showLoader(x); try { A; B; } finally { endLoader(); }
//       (間に return・throw・break・continue がある時は書かない: 前は hide を飛ばしていた道の挙動が変わる)
// 止まる一覧(書き換えず、ファイル:行と直し方 1 行): showLoader が 2 つ以上・hideLoader だけの関数・別の関数の hideLoader・
// 値として渡す hideLoader(useEffect の戻り値・props)・try の中の showLoader と finally の hideLoader・名前 endLoader が既にある・
// useGlobalLoader の戻り値をオブジェクトで受ける形。直し方: `const end = showLoader(o); try { … } finally { end(); }`
// (src/lib/globalLoader/README.md Usage)、useEffect なら `useEffect(() => showLoader(o), [showLoader])`
//
// fork の手順: 上流を取り込む → dry-run → --apply → 止まる一覧を手で → pnpm typecheck → git grep -n hideLoader -- src が 0
// exit 0(止まる物があっても)/ 2 = 引数の誤り

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const NOTICE_ID = "20261126-091213-cc-global-loader";
const END = "endLoader";
const FIX = "手で `const end = showLoader(o); try { … } finally { end(); }` に(src/lib/globalLoader/README.md Usage)";

function listSources(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (rel === "src/lib/globalLoader") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
    }
  };
  const src = path.join(root, "src");
  if (existsSync(src)) walk(src);
  return out.sort();
}

const isFunctionLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/** n を含む一番内側の関数 */
function enclosingFunction(n) {
  for (let p = n.parent; p; p = p.parent) if (isFunctionLike(p)) return p;
  return null;
}

/** `name(…)` の式の文か */
const isCallStatement = (stmt, name) =>
  ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression) && ts.isIdentifier(stmt.expression.expression) && stmt.expression.expression.text === name;

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/**
 * 1 ファイルを書き換える
 * @returns {{ status: "changed", text: string } | { status: "none" } | { status: "stop", reasons: string[] }}
 */
export function transformSource(source, fileName = "x.tsx") {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [];
  const reasons = [];

  // useGlobalLoader() の受け方
  const bindings = [];
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !n.initializer || !ts.isCallExpression(n.initializer)) return;
    const callee = n.initializer.expression;
    if (!ts.isIdentifier(callee) || callee.text !== "useGlobalLoader") return;
    if (!ts.isObjectBindingPattern(n.name)) {
      reasons.push(`${line(n)}: useGlobalLoader() の戻り値をオブジェクトで受けている → \`const { showLoader } = useGlobalLoader()\` にして ${FIX}`);
      return;
    }
    const el = (key) => n.name.elements.find((e) => (e.propertyName ?? e.name).getText(sf) === key);
    const show = el("showLoader");
    const hide = el("hideLoader");
    if (hide) bindings.push({ decl: n, show: show ? show.name.getText(sf) : null, hide: hide.name.getText(sf), hideEl: hide });
  });
  if (bindings.length === 0 && reasons.length === 0) return { status: "none" };

  for (const b of bindings) {
    const refs = [];
    walk(sf, (n) => {
      if (ts.isIdentifier(n) && n.text === b.hide && n !== b.hideEl.name && !(ts.isBindingElement(n.parent) && n.parent === b.hideEl)) refs.push(n);
    });
    const local = [];
    let ok = true;
    for (const ref of refs) {
      const call = ref.parent;
      if (!ts.isCallExpression(call) || call.expression !== ref || !ts.isExpressionStatement(call.parent)) {
        reasons.push(`${line(ref)}: ${b.hide} を値として渡している(useEffect の戻り値・props 等)→ ${FIX}。useEffect なら \`useEffect(() => showLoader(o), [showLoader])\``);
        ok = false;
        continue;
      }
      local.push(call.parent);
    }
    // 関数ごとに組む
    const byFn = new Map();
    for (const stmt of local) {
      const fn = enclosingFunction(stmt);
      if (!byFn.has(fn)) byFn.set(fn, []);
      byFn.get(fn).push(stmt);
    }
    for (const [fn, hides] of byFn) {
      if (!ok) break;
      const shows = [];
      if (b.show) {
        walk(fn, (n) => {
          if (isCallStatement(n, b.show) && enclosingFunction(n) === fn) shows.push(n);
        });
      }
      if (shows.length !== 1) {
        reasons.push(`${line(hides[0])}: この関数の ${b.show ?? "showLoader"}(…) の文が ${shows.length} 個(1 つの時だけ機械で移す)→ ${FIX}`);
        ok = false;
        continue;
      }
      const show = shows[0];
      if (new RegExp(`\\b${END}\\b`).test(fn.getText(sf))) {
        reasons.push(`${line(show)}: 名前 ${END} が既にある → ${FIX}`);
        ok = false;
        continue;
      }
      const block = show.parent;
      if (!ts.isBlock(block) && !ts.isSourceFile(block)) {
        reasons.push(`${line(show)}: ${b.show}(…) が塊の文でない → ${FIX}`);
        ok = false;
        continue;
      }
      const siblings = block.statements;
      const at = siblings.indexOf(show);
      // (a) 全部の hide が後ろの try の finally の中
      const inLaterFinally = (stmt) => {
        for (let p = stmt.parent; p && p !== block; p = p.parent) {
          if (ts.isTryStatement(p.parent) && p.parent.finallyBlock === p) {
            const tryStmt = p.parent;
            return tryStmt.parent === block && siblings.indexOf(tryStmt) > at;
          }
        }
        return false;
      };
      const showText = show.expression.getText(sf);
      if (hides.every(inLaterFinally)) {
        edits.push({ start: show.getStart(sf), end: show.getEnd(), text: `const ${END} = ${showText};` });
        for (const h of hides) edits.push({ start: h.getStart(sf), end: h.getEnd(), text: `${END}();` });
        continue;
      }
      // (b) hide の文が 1 つで同じ塊の後ろ
      const hideAt = hides.length === 1 ? siblings.indexOf(hides[0]) : -1;
      if (hideAt > at) {
        const between = siblings.slice(at + 1, hideAt);
        let jumps = false;
        for (const s of between) {
          walk(s, (n) => {
            if (jumps) return;
            if (isFunctionLike(n)) return;
            if (ts.isReturnStatement(n) || ts.isThrowStatement(n) || ts.isBreakStatement(n) || ts.isContinueStatement(n)) {
              if (enclosingFunction(n) === fn) jumps = true;
            }
          });
        }
        if (jumps) {
          reasons.push(`${line(show)}: ${b.show}(…) と ${b.hide}() の間に return・throw・break・continue がある(前はその道で消さなかった)→ ${FIX}`);
          ok = false;
          continue;
        }
        const indent = /^[ \t]*/.exec(source.slice(source.lastIndexOf("\n", show.getStart(sf)) + 1))[0];
        const body = between.length === 0 ? "" : source.slice(between[0].getFullStart(), between[between.length - 1].getEnd()).replace(/^\s*\n/, "").split("\n").map((l) => (l === "" ? l : `  ${l}`)).join("\n");
        const tryText = `const ${END} = ${showText};\n${indent}try {\n${body}${body ? "\n" : ""}${indent}} finally {\n${indent}  ${END}();\n${indent}}`;
        const lastEnd = hides[0].getEnd();
        edits.push({ start: show.getStart(sf), end: lastEnd, text: tryText });
        continue;
      }
      reasons.push(`${line(hides[0])}: ${b.hide}() が ${b.show}(…) の後ろの同じ塊の文でも finally の中でもない(別の分岐・try の中の show 等)→ ${FIX}`);
      ok = false;
    }
    if (ok) {
      // 分割代入から hideLoader を外す
      const els = b.decl.name.elements.filter((e) => e !== b.hideEl).map((e) => e.getText(sf));
      edits.push({ start: b.decl.name.getStart(sf), end: b.decl.name.getEnd(), text: `{ ${els.join(", ")} }` });
    }
  }
  if (reasons.length > 0) return { status: "stop", reasons };
  let text = source;
  for (const e of edits.sort((x, y) => y.start - x.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return { status: "changed", text };
}

export function plan(root) {
  const writes = [];
  const stops = [];
  for (const file of listSources(root)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("useGlobalLoader")) continue;
    const r = transformSource(source, file);
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (r.status === "changed") writes.push({ file: rel, text: r.text });
    else if (r.status === "stop") for (const reason of r.reasons) stops.push({ file: rel, reason });
  }
  return { writes, stops };
}

function main(argv) {
  const args = { apply: false, root: "." };
  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    else if (a.startsWith("--root=")) args.root = a.slice(7);
    else {
      console.error(`不明な引数: ${a}`);
      return 2;
    }
  }
  const root = path.resolve(args.root);
  const { writes, stops } = plan(root);
  console.log(`${args.apply ? "書いた" : "書き換える(dry-run)"}: ${writes.length} ファイル / 止まる ${stops.length}`);
  for (const w of writes) console.log(`  ${w.file}`);
  if (stops.length > 0) {
    console.log("止まる一覧(書き換えていない。手で直す):");
    for (const s of stops) console.log(`  - ${s.file}:${s.reason}`);
  }
  if (args.apply) for (const w of writes) writeFileSync(path.join(root, w.file), w.text);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
