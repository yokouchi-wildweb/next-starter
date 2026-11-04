// scripts/extensions/frames.mjs
// 枠の宣言の生成器: src/app の frame.ts / frame.override.ts を字面で読み(declarations.literalOf、D2)、ルートの親の鎖と override を
// 部位と端末ごとに解決した表を枠の根ごとに書く(<枠の根>/_layout/extensions/frameTable.ts。pnpm extensions:generate が書き、extensions:check が照らす)。
// git は使わない(fork の frame.ts が上流の page/layout の隣にあるかは ownership:check の frame-beside-parent)。
// 孤立した frame.override.ts と上流の override は overrides.mjs。仕組みと表の形: src/app/_layout/frame/README.md

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { FRAME_ROOTS } from "../../src/app/_layout/frame/parts.mjs";
import { checkFrameValue, emptyFrame, frameRowValue, hidesWholeFrame, matchFrame, overlayFrame, sameFrameValue } from "../../src/app/_layout/frame/resolve.mjs";
import { literalOf } from "../../src/lib/forkOwnership/declarations.mjs";
import { isBlankSource } from "./overrides.mjs";
import { LAYOUT_FILE_RE, PAGE_FILE_RE, discoverRoutes, listAppFiles } from "../../src/lib/screens/routeTree.mjs";

export const FRAME_FILE = "frame.ts";
export const FRAME_OVERRIDE_FILE = "frame.override.ts";
const FRAME_LIKE = /^frame(?:\.override)?\.(?:tsx|js|jsx|mjs)$/;
/** 照合の試しに使う動的な段の値(実際の URL に出ない文字) */
const PROBE = "\u0000";

/** 枠の表の置き場 */
export const frameTablePath = (root) => `${FRAME_ROOTS[root].dir}/_layout/extensions/frameTable.ts`;

/** `export const <name> = <リテラル>` を字面で読む。{ value } か { problem } */
export function readExportedLiteral(path, text, name) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) return literalOf(declaration.initializer);
    }
  }
  return { problem: `export const ${name} = { … } が無い` };
}

const isDynamic = (seg) => seg.startsWith("[");
const isOptional = (seg) => seg.startsWith("[[...");
/** 宣言を置けない段: private(_x)・@slot・intercepting((.)x など) */
const unsupported = (seg) => seg.startsWith("_") || seg.startsWith("@") || /^\(\.{1,3}\)/.test(seg);

/** ページの照合の試しの segments(動的な段は PROBE。末尾の [[...x]] は有りと無しの 2 通り) */
function probesOf(pattern) {
  const filled = pattern.map((seg) => (isDynamic(seg) ? PROBE : seg));
  return pattern.length > 0 && isOptional(pattern[pattern.length - 1]) ? [filled, filled.slice(0, -1)] : [filled];
}

/**
 * 全部の枠の根の表を作る
 * @param {string} repoRoot
 * @param {(source: string) => string} headerFor 生成物のヘッダ(extensions.mjs の headerFor)
 * @returns {{ outputs: Record<string, string>, tables: Record<string, object[]>, problems: string[], warnings: string[], declarations: number }}
 */
export function planFrames(repoRoot, headerFor) {
  const outputs = {};
  const tables = {};
  const problems = [];
  const warnings = [];
  if (!existsSync(join(repoRoot, "src/app"))) return { outputs, tables, problems, warnings, declarations: 0 };
  const files = listAppFiles(repoRoot);
  const fileSet = new Set(files);
  const dirOf = (path) => path.slice(0, path.lastIndexOf("/"));
  const rootOf = (dir) => Object.keys(FRAME_ROOTS).find((r) => dir === FRAME_ROOTS[r].dir || dir.startsWith(`${FRAME_ROOTS[r].dir}/`)) ?? null;
  const has = (dir, re) => files.some((f) => dirOf(f) === dir && re.test(f.slice(dir.length + 1)));

  // 宣言を集める: 根 → (segments の文字列 → { segments, scope, frame, override })
  const nodesByRoot = Object.fromEntries(Object.keys(FRAME_ROOTS).map((r) => [r, new Map()]));
  let declarations = 0;
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (FRAME_LIKE.test(name)) {
      problems.push(`${path}: 枠の宣言は ${FRAME_FILE}(fork が上流の page/layout の隣に置くなら ${FRAME_OVERRIDE_FILE})`);
      continue;
    }
    if (name !== FRAME_FILE && name !== FRAME_OVERRIDE_FILE) continue;
    const dir = dirOf(path);
    const root = rootOf(dir);
    if (root === null) {
      problems.push(`${path}: 枠の宣言は枠の layout の下だけ(${Object.values(FRAME_ROOTS).map((r) => r.dir).join(" / ")})`);
      continue;
    }
    const segments = dir === FRAME_ROOTS[root].dir ? [] : dir.slice(FRAME_ROOTS[root].dir.length + 1).split("/");
    if (segments.some(unsupported)) {
      problems.push(`${path}: private フォルダ(_x)・@slot・intercepting の下には宣言を置けない`);
      continue;
    }
    const scope = has(dir, LAYOUT_FILE_RE) ? "layout" : has(dir, PAGE_FILE_RE) ? "page" : null;
    if (scope === null) {
      // 隣に frame.ts も無い frame.override.ts は overrides.mjs が孤立で止める
      if (name === FRAME_FILE || fileSet.has(`${dir}/${FRAME_FILE}`)) problems.push(`${path}: 隣に page.tsx か layout.tsx が要る(宣言はその page か layout の下全部に効く)`);
      continue;
    }
    const text = readFileSync(join(repoRoot, path), "utf8");
    const isOverride = name === FRAME_OVERRIDE_FILE;
    if (isOverride && isBlankSource(text)) continue;
    const read = readExportedLiteral(path, text, isOverride ? "override" : "frame");
    const found = read.problem ? [read.problem] : checkFrameValue(read.value, root);
    if (found.length > 0) {
      problems.push(...found.map((p) => `${path}: ${p}`));
      continue;
    }
    declarations += 1;
    const key = segments.join("/");
    const node = nodesByRoot[root].get(key) ?? { segments, scope, path: null };
    if (isOverride) node.override = read.value;
    else {
      node.frame = read.value;
      node.path = path;
    }
    node.path ??= path;
    nodesByRoot[root].set(key, node);
  }

  const { routes } = discoverRoutes(files);
  for (const root of Object.keys(FRAME_ROOTS)) {
    const nodes = nodesByRoot[root];
    // 親の鎖: 浅い → 深い(layout の宣言は自分と下全部、page の宣言は自分のページだけ)、各段で frame.ts → frame.override.ts
    const resolve = (segments, isPage) => {
      let value = emptyFrame();
      for (let i = 0; i <= segments.length; i += 1) {
        const node = nodes.get(segments.slice(0, i).join("/"));
        if (!node || (node.scope === "page" && !(isPage && i === segments.length))) continue;
        value = overlayFrame(overlayFrame(value, node.frame, root), node.override, root);
      }
      return value;
    };
    const rows = [];
    for (const node of [...nodes.values()].sort((a, b) => (a.segments.join("/") < b.segments.join("/") ? -1 : 1))) {
      const value = resolve(node.segments, node.scope === "page");
      rows.push({ pattern: node.segments, scope: node.scope, ...frameRowValue(value, root) });
      if (hidesWholeFrame(value, root)) {
        warnings.push(`${node.path}: 枠の部位を全部隠している(枠が全部要らないページはルートグループに分けて枠の layout の外に置く。書くことは止めない)`);
      }
    }
    // 宣言のある動的な段が静的な兄弟に誤って効かないよう、照合がずれるページに解決済みの行を足す(試作の結論、止まるまで繰り返す)
    const pages = routes
      .filter((r) => r.dir === FRAME_ROOTS[root].dir || r.dir.startsWith(`${FRAME_ROOTS[root].dir}/`))
      .map((r) => (r.dir === FRAME_ROOTS[root].dir ? [] : r.dir.slice(FRAME_ROOTS[root].dir.length + 1).split("/")))
      .filter((segments) => !segments.some(unsupported));
    if (rows.length > 0) {
      for (let changed = true; changed; ) {
        changed = false;
        for (const segments of pages) {
          const expected = frameRowValue(resolve(segments, true), root);
          if (probesOf(segments).every((probe) => sameFrameValue(matchFrame(probe, rows), expected))) continue;
          if (rows.some((r) => r.scope === "page" && r.pattern.join("/") === segments.join("/"))) {
            problems.push(`${FRAME_ROOTS[root].dir}/${segments.join("/")}: 枠の表の照合が解決済みの値に合わない(生成器の不具合)`);
            continue;
          }
          rows.push({ pattern: segments, scope: "page", ...expected });
          changed = true;
        }
      }
    }
    rows.sort((a, b) => (a.pattern.join("/") + a.scope < b.pattern.join("/") + b.scope ? -1 : 1));
    if (!existsSync(join(repoRoot, FRAME_ROOTS[root].dir))) continue;
    tables[root] = rows;
    outputs[frameTablePath(root)] = renderTable(root, rows, headerFor);
  }
  return { outputs, tables, problems, warnings, declarations };
}

function renderTable(root, rows, headerFor) {
  const typeName = "FrameTable";
  const lines = [
    headerFor(`${FRAME_ROOTS[root].dir} の ${FRAME_FILE} / ${FRAME_OVERRIDE_FILE}`),
    "// 枠の表: 行 = 解決済みの最終の値(親の鎖と override を重ねた物)。照合は matchFrame(静的が先・長い方が先、当たる 1 行)。仕組み: src/app/_layout/frame/README.md",
    "",
    `import type { ${typeName} } from "@/app/_layout/frame";`,
    "",
  ];
  if (rows.length === 0) lines.push(`export const frameTable = [] as const satisfies ${typeName};`);
  else {
    lines.push("export const frameTable = [");
    for (const row of rows) {
      lines.push(`  { pattern: ${JSON.stringify(row.pattern)}, scope: ${JSON.stringify(row.scope)}, hide: ${JSON.stringify(row.hide)}, fill: ${row.fill} },`);
    }
    lines.push(`] as const satisfies ${typeName};`);
  }
  lines.push("");
  return lines.join("\n");
}
