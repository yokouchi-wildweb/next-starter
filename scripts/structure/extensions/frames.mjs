// scripts/structure/extensions/frames.mjs
// 枠の宣言の生成器: src/app の frame.ts(ルートを作ったリポの宣言)と frame.override.ts(その下のリポの宣言。相手 = そのルート)を字面で読み
// (declarations.literalOf、D2)、ルートの親の鎖を部位と端末ごとに解決した表を枠の根ごとに書く
// (<枠の根>/_layout/extensions/frameTable.ts。pnpm generate extensions が書き、pnpm check extensions が照らす)。
// 範囲はキーで名指す(layout = 隣の layout.tsx の下全部、page = 隣の page.tsx だけ)。隣に何があるかで意味を変えない。
// 重ねる順: 浅い段から layout(frame → frame.override)、葉の段で最後に page(同じ順)。frame.default.ts はどの Tier でも失敗(frame.ts へ改名、pnpm check extensions -- frames-move)。
// git は使わない(親のルートの隣に下のリポが置いた印なしの frame.ts は pnpm workflow ownership check の frame-plain)。仕組みと表の形: src/app/_layout/frame/README.md

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { FRAME_ROOTS } from "../../../src/app/_layout/frame/parts.mjs";
import { checkFrameDeclaration, emptyFrame, frameRowValue, hidesWholeFrame, matchFrame, overlayFrame, sameFrameValue } from "../../../src/app/_layout/frame/resolve.mjs";
import { literalOf } from "../../../src/lib/districtMap/declarations.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { isBlankSource } from "./overrides.mjs";
import { LAYOUT_FILE_RE, PAGE_FILE_RE, discoverRoutes, listAppFiles } from "../../../src/lib/screens/routeTree.mjs";

// 名前(frame.ts / frame.override.ts / frame.default.ts と .default の名乗り)の元は src/lib/districtMap/extensionNames.mjs
export { CLAIMED_DEFAULTS, FRAME_DEFAULT_FILE, FRAME_FILE, FRAME_OVERRIDE_FILE } from "../../../src/lib/districtMap/extensionNames.mjs";
import { FRAME_DEFAULT_FILE, FRAME_FILE, FRAME_OVERRIDE_FILE } from "../../../src/lib/districtMap/extensionNames.mjs";
/** 宣言の名前と export の名前(並び = 重ねる順): ルートを作ったリポの frame.ts → その下のリポの frame.override.ts */
const SOURCES = [
  { file: FRAME_FILE, exportName: "frame", slot: "frame" },
  { file: FRAME_OVERRIDE_FILE, exportName: "override", slot: "override" },
];
/** frame.ts・frame.override.ts 以外の frame.<何か> / frame.tsx など(frame.default.ts は別の言葉で止める) */
const FRAME_LIKE = /^frame(?:\.[^/]+)?\.(?:ts|tsx|js|jsx|mjs)$/;
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
 * @param {{ isTier1?: boolean }} [identity] 省略 = readForkIdentity(上流(Tier1)は frame.override.ts を持たない)
 * @returns {{ outputs: Record<string, string>, tables: Record<string, object[]>, problems: string[], warnings: string[], declarations: number }}
 */
export function planFrames(repoRoot, headerFor, { isTier1 = readForkIdentity(repoRoot).isTier1 } = {}) {
  const outputs = {};
  const tables = {};
  const problems = [];
  const warnings = [];
  if (!existsSync(join(repoRoot, "src/app"))) return { outputs, tables, problems, warnings, declarations: 0 };
  const files = listAppFiles(repoRoot);
  const dirOf = (path) => path.slice(0, path.lastIndexOf("/"));
  const rootOf = (dir) => Object.keys(FRAME_ROOTS).find((r) => dir === FRAME_ROOTS[r].dir || dir.startsWith(`${FRAME_ROOTS[r].dir}/`)) ?? null;
  const has = (dir, re) => files.some((f) => dirOf(f) === dir && re.test(f.slice(dir.length + 1)));

  // 宣言を集める: 根 → (segments の文字列 → { segments, default?, frame?, paths })
  const nodesByRoot = Object.fromEntries(Object.keys(FRAME_ROOTS).map((r) => [r, new Map()]));
  let declarations = 0;
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const source = SOURCES.find((s) => s.file === name);
    if (!source) {
      if (name === FRAME_DEFAULT_FILE) problems.push(`${path}: ${FRAME_DEFAULT_FILE} は使わない(ルートを作ったリポの宣言は ${FRAME_FILE}・export const frame、その下のリポは ${FRAME_OVERRIDE_FILE}・export const override。移し替え: pnpm check extensions -- frames-move)`);
      else if (FRAME_LIKE.test(name)) problems.push(`${path}: 枠の宣言の名前は ${FRAME_FILE}(ルートを作ったリポ)か ${FRAME_OVERRIDE_FILE}(その下のリポ。相手 = そのルート、${FRAME_FILE} の上に重なる)だけ`);
      continue;
    }
    if (source.file === FRAME_OVERRIDE_FILE && isTier1) {
      problems.push(`${path}: 上流(Tier1)は ${FRAME_OVERRIDE_FILE} を持たない(ルートを作ったリポの宣言は隣の ${FRAME_FILE}、export const frame)`);
      continue;
    }
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
    const hasLayout = has(dir, LAYOUT_FILE_RE);
    const hasPage = has(dir, PAGE_FILE_RE);
    if (!hasLayout && !hasPage) {
      problems.push(`${path}: 隣に layout.tsx か page.tsx が要る(宣言はその layout の下全部か page に効く)`);
      continue;
    }
    const text = readFileSync(join(repoRoot, path), "utf8");
    if (isBlankSource(text)) continue;
    const read = readExportedLiteral(path, text, source.exportName);
    const found = read.problem ? [read.problem] : checkFrameDeclaration(read.value, root);
    if (found.length === 0) {
      if (read.value.layout !== undefined && !hasLayout) found.push(`layout: は隣に layout.tsx があるフォルダだけ(このフォルダのページだけなら page:)`);
      if (read.value.page !== undefined && !hasPage) found.push(`page: は隣に page.tsx があるフォルダだけ(このフォルダの下全部なら layout:)`);
    }
    if (found.length > 0) {
      problems.push(...found.map((p) => `${path}: ${p}`));
      continue;
    }
    declarations += 1;
    const key = segments.join("/");
    const node = nodesByRoot[root].get(key) ?? { segments, paths: [] };
    node[source.slot] = read.value;
    node.paths.push(path);
    nodesByRoot[root].set(key, node);
  }

  const { routes } = discoverRoutes(files);
  for (const root of Object.keys(FRAME_ROOTS)) {
    const nodes = nodesByRoot[root];
    const sections = (node, scope) => SOURCES.map((s) => node[s.slot]?.[scope]).filter((v) => v !== undefined);
    // 親の鎖: 浅い段から layout(frame → frame.override)、葉の段で最後に page(同じ順)
    const resolve = (segments, isPage) => {
      let value = emptyFrame();
      for (let i = 0; i <= segments.length; i += 1) {
        const node = nodes.get(segments.slice(0, i).join("/"));
        if (node) for (const section of sections(node, "layout")) value = overlayFrame(value, section, root);
      }
      const leaf = isPage ? nodes.get(segments.join("/")) : undefined;
      if (leaf) for (const section of sections(leaf, "page")) value = overlayFrame(value, section, root);
      return value;
    };
    const rows = [];
    for (const node of [...nodes.values()].sort((a, b) => (a.segments.join("/") < b.segments.join("/") ? -1 : 1))) {
      for (const scope of ["layout", "page"]) {
        if (sections(node, scope).length === 0) continue;
        const value = resolve(node.segments, scope === "page");
        rows.push({ pattern: node.segments, scope, ...frameRowValue(value, root) });
        if (hidesWholeFrame(value, root)) {
          warnings.push(`${node.paths.join(" / ")}(${scope}): 枠の部位を全部隠している(枠が全部要らないページはルートグループに分けて枠の layout の外に置く。書くことは止めない)`);
        }
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
    "// 枠の表: 行 = 解決済みの最終の値(親の鎖と frame → frame.override を重ねた物)。照合は matchFrame(静的が先・長い方が先、当たる 1 行)。仕組み: src/app/_layout/frame/README.md",
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
