// scripts/structure/extensions/extensions.mjs
// 拡張点の項目の走査と生成一覧の組み立て(pnpm generate extensions / pnpm check extensions の中身)。
// Node 組み込み + typescript(宣言の構文木)だけで動く。項目のファイルは import しない(字面で名前と export を見るだけ)。
// 項目の名前に fork の印は付けない(点つきの名前の分類は src/lib/districtMap/dottedNames.mjs)。
// 書式・置き場・失敗の条件: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, posix } from "node:path";

import { classifyDottedName, oldMarkerProblem } from "../../../src/lib/districtMap/dottedNames.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

import { DECLARATION_NAME, EXTENSIONS_DIR_NAME, SEARCH_ROOT, collectPoints } from "../../../src/lib/districtMap/declarations.mjs";
import { createFeatureTables } from "./derive/featureTables.mjs";
import { checkOverrides, isBlankSource } from "./overrides.mjs";
import { checkPureImports, overrideKeys } from "./pureImports.mjs";
import { planFrames } from "./frames.mjs";
import { planIntake } from "./intake.mjs";
import { checkSwitches } from "./switches.mjs";

export const COMMAND = "pnpm generate extensions";
/** 生成物の 1 行目(pnpm generate registry と同じ形の目印) */
export const headerFor = (source) => `// 生成物・編集不可: ${COMMAND} が ${source} から生成する`;
const HEADER_PREFIX = "// 生成物・編集不可: ";
const WIRING_DIR = "src/wiring";

const ITEM_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
// テスト・宣言(extensionPoints.<x>.ts の旧い形は宣言の読み手 src/lib/districtMap/declarations.mjs が止める)は項目でない
const isSkippedFile = (name) => /\.(test|spec|d)\.[cm]?tsx?$/.test(name) || !/\.tsx?$/.test(name) || classifyDottedName(name).base === DECLARATION_NAME;
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const markOf = (exportName) => new RegExp(`^export\\s+const\\s+${exportName}\\b`, "m");

/** 項目の名前の判定(印なしの <名前>.ts(x) か <名前>/ だけ。旧い fork の印は止めて移し方を案内する)。{ name } か { problem } */
function placement(label, entry, isFolder) {
  const shape = classifyDottedName(entry, { folder: isFolder });
  if (shape.kind === "marker" && ITEM_NAME.test(shape.base)) {
    return { problem: oldMarkerProblem(label, isFolder ? `${shape.base}/` : `${shape.base}.${shape.ext}`) };
  }
  if (shape.kind !== "plain" || !ITEM_NAME.test(shape.base)) {
    return { problem: `${label}: 名前の形が違う(<名前>.ts(x) かそのフォルダ形 <名前>/index.ts(x)。名前は英字始まりの英数字)` };
  }
  return { name: shape.base };
}

/**
 * 同じフォルダを受け口にする点(proxy の handlers と decorators のように)をまとめて走査する
 * @returns {{ items: Map<string, object[]>, problems: string[] }} items = 点の名前 → 項目(ファイル名の順)
 */
function discoverDir(repoRoot, owner, dir, points, otherDirs) {
  const rel = posix.normalize(posix.join(owner, dir));
  const abs = join(repoRoot, rel);
  const items = new Map(points.map((p) => [p.name, []]));
  const problems = [];
  // 受け口のフォルダが無い = 項目 0(git は空のフォルダを持てない。上流の項目が 0 の点はここを通る)
  if (!existsSync(abs)) return { items, problems };
  if (points[0].spec.files) return discoverFiles(repoRoot, rel, abs, points[0], items);
  const ignore = new Set(points.flatMap((p) => p.spec.ignore ?? []));
  const seen = new Map();
  const pendingOverrides = [];
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name))) {
    const label = `${rel}/${entry.name}`;
    if (entry.isFile() && /\.override\.tsx?$/.test(entry.name)) {
      if (points.some((p) => p.spec.overrideOf)) pendingOverrides.push({ label, target: entry.name.replace(/\.override\.tsx?$/, "") });
      else if (!isBlankSource(readFileSync(join(abs, entry.name), "utf8"))) problems.push(`${label}: この受け口の点は override を受けない(宣言に overrideOf が無い)`);
      continue;
    }
    // <名前>.replace は 1 行スイッチの既定の置き換え。受け口の項目ではない(孤立は switches.mjs が止める)
    if (entry.isFile() && classifyDottedName(entry.name).kind === "replace") continue;
    let itemFile;
    if (entry.isDirectory()) {
      if (entry.name === EXTENSIONS_DIR_NAME || entry.name.startsWith(".") || otherDirs.has(posix.join(rel, entry.name))) continue;
      const index = ["index.ts", "index.tsx"].find((f) => existsSync(join(abs, entry.name, f)));
      if (!index) {
        problems.push(`${label}: フォルダの項目は中に index.ts(x) を置く`);
        continue;
      }
      itemFile = `${label}/${index}`;
    } else {
      if (!entry.isFile() || isSkippedFile(entry.name) || ignore.has(entry.name)) continue;
      itemFile = label;
    }
    const place = placement(label, entry.name, entry.isDirectory());
    if (place.problem) {
      problems.push(place.problem);
      continue;
    }
    if (seen.has(place.name)) {
      problems.push(`${label}: ${seen.get(place.name)} と同じ名前の項目(ファイルとフォルダの両方は置かない)`);
      continue;
    }
    seen.set(place.name, label);
    const text = readFileSync(join(repoRoot, itemFile), "utf8");
    const hits = points.filter((p) => markOf(p.spec.export).test(text));
    const exportsList = points.map((p) => `export const ${p.spec.export}`).join(" / ");
    if (hits.length === 0) {
      problems.push(`${label}: ${exportsList} が無い(受け口 ${rel} に置くのは項目だけ。部品は責務のドメインへ)`);
      continue;
    }
    if (hits.length > 1) {
      problems.push(`${label}: ${hits.map((p) => p.spec.export).join(" と ")} の両方を export している(1 項目 1 つ。分けて置く)`);
      continue;
    }
    items.get(hits[0].name).push({ name: place.name, path: label, itemFile, text });
    const spec = hits[0].spec;
    if (spec.requireText && !text.includes(spec.requireText)) problems.push(`${label}: ${spec.requireText} が無い(この点の項目に必須)`);
    if (spec.pureImports) problems.push(...checkPureImports(repoRoot, itemFile));
  }
  // 隣の <名前>.override.ts(属性だけ)。対象は同じ受け口にある項目(「上流の項目だけ」の検査は所有の側、指令 02)
  for (const { label, target } of pendingOverrides) {
    const text = readFileSync(join(repoRoot, label), "utf8");
    if (isBlankSource(text)) continue;
    const point = points.find((p) => p.spec.overrideOf && items.get(p.name).some((i) => i.name === target));
    if (!point) {
      problems.push(`${label}: 項目 ${target} が無い(override は同じ受け口の既存の項目の属性を上書きする)`);
      continue;
    }
    const keys = overrideKeys(label, text);
    if (keys === null) {
      problems.push(`${label}: export const override = { … } の形で書く`);
      continue;
    }
    const denied = keys.filter((k) => !point.spec.overrideOf.includes(k));
    if (denied.length > 0) {
      problems.push(`${label}: ${denied.join("・")} は上書きできない(できるのは ${point.spec.overrideOf.join("・")}。型と検証は変えられない)`);
      continue;
    }
    items.get(point.name).find((i) => i.name === target).override = label;
  }
  return { items, problems };
}

/** files の点: 受け口の 1 段下の決まった名前のファイルが項目、項目名 = フォルダ名(ファイルが無いフォルダは項目でない) */
function discoverFiles(repoRoot, rel, abs, point, items) {
  const problems = [];
  const fileName = point.spec.files.slice("*/".length);
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name))) {
    if (!entry.isDirectory() || !existsSync(join(abs, entry.name, fileName))) continue;
    const label = `${rel}/${entry.name}/${fileName}`;
    const text = readFileSync(join(repoRoot, label), "utf8");
    if (!markOf(point.spec.export).test(text)) {
      problems.push(`${label}: export const ${point.spec.export} が無い`);
      continue;
    }
    items.get(point.name).push({ name: entry.name, path: label, itemFile: label, text, folder: entry.name });
  }
  return { items, problems };
}

/**
 * import の別名 = <点の名前>_<項目の名前>。点の名前は英数字だけなので最初の "_" で区切れ、
 * 1 つの出力に複数の点を混ぜる wiring(dbAgent など)・予約語の項目名・生成の識別子 <点>/<点>Map/<点>List とも衝突しない。
 * files の点の項目名(フォルダ名)の記号は _ に
 */
const aliasOf = (point, item) => `${point.name}_${item.name.replace(/[^A-Za-z0-9]/g, "_")}`;
/** 項目の import 元(@/ からの path、拡張子とフォルダの index を除く) */
const specifierOf = (path) => `@/${path.slice(`${SEARCH_ROOT}/`.length).replace(/\.tsx?$/, "")}`;

/** 1 つの点の一覧の本体(ヘッダと型の import を除く) */
function renderPoint(point, items) {
  const { spec } = point;
  const T = spec.type.name;
  const lines = [];
  // key の一覧は null プロトタイプ(外から来た名前で引いても "constructor" などに当たらない)
  if (spec.load === "lazy") {
    const list = items.map((item) => `  { name: ${JSON.stringify(item.name)}, load: () => import(${JSON.stringify(specifierOf(item.path))}).then((m) => m.${spec.export}) },`);
    lines.push(`export const ${point.name}: { name: string; load: () => Promise<${T}> }[] = ${list.length === 0 ? "[]" : `[\n${list.join("\n")}\n]`};`);
    return { imports: [], lines };
  }
  const imports = items.map((item) => `import { ${spec.export} as ${aliasOf(point, item)} } from ${JSON.stringify(specifierOf(item.path))};`);
  for (const item of items.filter((i) => i.override)) imports.push(`import { override as ${aliasOf(point, item)}_override } from ${JSON.stringify(specifierOf(item.override))};`);
  if (spec.shape === "object") {
    const list = `${point.name}Map`;
    const entries = items.map((item) => `  ${item.name}: ${item.override ? `{ ...${aliasOf(point, item)}, ...${aliasOf(point, item)}_override }` : aliasOf(point, item)},`);
    lines.push(`const ${list} = ${entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n}`} as const satisfies Readonly<Record<string, ${T}>>;`);
    lines.push(`export const ${point.name} = Object.assign(Object.create(null), ${list}) as typeof ${list};`);
    return { imports, lines };
  }
  const values = items.map((item) =>
    item.folder ? `  { ...${aliasOf(point, item)}, folder: ${JSON.stringify(item.folder)} },` : item.override ? `  { ...${aliasOf(point, item)}, ...${aliasOf(point, item)}_override },` : item.fields ? `  { ...${aliasOf(point, item)}, ${renderFields(aliasOf(point, item), item.fields)} },` : `  ${aliasOf(point, item)},`,
  );
  const array = values.length === 0 ? "[]" : `[\n${values.join("\n")}\n]`;
  if (spec.derive === "featureTables") {
    // 機能の名前 = 規則のファイル名(gate.enabled(name) の型)。一覧の並びと同じ
    lines.push(`export type FeatureName = ${items.length === 0 ? "never" : items.map((item) => JSON.stringify(item.name)).join(" | ")};`, "");
    lines.push("// name = 規則のファイル名、tables = 規則の features のフォルダから導いた表名(表定義は import しない。proxy が読むのは規則と config だけ)");
  }
  if (spec.literalKeys) {
    // 鍵の文字列を型に残す(項目の値の型が鍵を文字列リテラルで持つこと)
    const list = `${point.name}List`;
    lines.push(`const ${list} = ${array} as const satisfies readonly ${T}[];`);
    lines.push(`export const ${point.name} = Object.assign(Object.create(null), Object.fromEntries((${list} as readonly ${T}[]).map((item) => [String(item.${spec.key}), item]))) as unknown as { readonly [I in (typeof ${list})[number] as I[${JSON.stringify(spec.key)}]]: I };`);
    lines.push(`if (Object.keys(${point.name}).length !== ${list}.length) throw new Error(${JSON.stringify(`${point.name}: ${spec.key} が重複している項目がある`)});`);
  } else if (spec.key) {
    const list = `${point.name}List`;
    lines.push(`const ${list}: ${T}[] = ${array};`);
    lines.push(`export const ${point.name}: Readonly<Record<string, ${T}>> = Object.assign(Object.create(null), Object.fromEntries(${list}.map((item) => [String(item.${spec.key}), item])));`);
    lines.push(`if (Object.keys(${point.name}).length !== ${list}.length) throw new Error(${JSON.stringify(`${point.name}: ${spec.key} が重複している項目がある`)});`);
  } else {
    lines.push(`export const ${point.name}: ${T}[] = ${array};`);
  }
  return { imports, lines };
}

/** derive "settingSections": 項目の section の字面が、同じ持ち主の sections の key にあるか */
function checkSettingSections(points, itemsByPoint) {
  const problems = [];
  for (const point of points.filter((p) => p.spec.derive === "settingSections")) {
    const sections = points.find((p) => p.owner === point.owner && p.name === "sections");
    const keyOf = (i) => /\bkey:\s*["']([^"']+)["']/.exec(i.text)?.[1];
    const sectionItems = sections ? itemsByPoint.get(sections) : [];
    const seen = new Map();
    for (const item of sectionItems) {
      const key = keyOf(item);
      if (key && seen.has(key)) problems.push(`${item.path}: セクションの key "${key}" は ${seen.get(key)} にもある`);
      if (key) seen.set(key, item.path);
    }
    const keys = new Set(seen.keys());
    for (const item of itemsByPoint.get(point)) {
      const section = /\bsection:\s*["']([^"']+)["']/.exec(item.text)?.[1];
      if (section && !keys.has(section)) problems.push(`${item.path}: 無いセクション "${section}" を指している`);
    }
  }
  return problems;
}

/** 生成一覧の出力先 */
const outputOf = (point) => (point.spec.target === "wiring" ? `${WIRING_DIR}/${basename(point.owner)}.ts` : `${point.owner}/${EXTENSIONS_DIR_NAME}/${point.name}.ts`);

/** 1 つの出力ファイルを組み立てる(wiring は同じ lib の点を 1 本に) */
// 生成器が付ける欄の描画。domainApiPaths・settingPaths・cronPaths(derive featureTables)は項目の pathPatterns の後ろにも足す(読み手は pathPatterns だけを見る)
function renderFields(alias, fields) {
  const literal = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));
  const parts = Object.entries(fields).map(([k, v]) => `${k}: ${literal(v)}`);
  const extra = [...(fields.domainApiPaths ?? []), ...(fields.settingPaths ?? []), ...(fields.cronPaths ?? [])];
  if (extra.length > 0) parts.push(`pathPatterns: [...${alias}.pathPatterns, ${extra.map((x) => JSON.stringify(x)).join(", ")}]`);
  return parts.join(", ");
}

function renderFile(points, itemsByPoint) {
  const sources = [...new Set(points.map((p) => p.declaredIn))].join("・");
  const types = new Map();
  for (const p of points) {
    const names = types.get(p.spec.type.from) ?? new Set();
    names.add(p.spec.type.name);
    types.set(p.spec.type.from, names);
  }
  const out = [
    headerFor(sources),
    ...points.map((p) => p.spec.files ? `// ${p.name}: ${posix.normalize(posix.join(p.owner, p.spec.dir))}/${p.spec.files} の export const ${p.spec.export}(folder = フォルダ名、並びはフォルダ名の順)` : `// ${p.name}: ${posix.normalize(posix.join(p.owner, p.spec.dir))}/<名前>.ts(x) か <名前>/index.ts(x) の export const ${p.spec.export}(並びはファイル名の順)`),
    "",
    ...[...types.entries()].sort(([a], [b]) => byName(a, b)).map(([from, names]) => `import type { ${[...names].sort(byName).join(", ")} } from ${JSON.stringify(from)};`),
  ];
  const bodies = points.map((p) => renderPoint(p, itemsByPoint.get(p)));
  const imports = bodies.flatMap((b) => b.imports);
  if (imports.length > 0) out.push("", ...imports);
  for (const body of bodies) out.push("", ...body.lines);
  out.push("");
  return out.join("\n");
}

/**
 * 全拡張点を走査して、生成一覧の中身を組み立てる。1 行スイッチと override の検査(./switches.mjs・./overrides.mjs)も同じ problems に
 * @param {string} repoRoot
 * @returns {{ points: object[], itemsByPoint: Map<object, object[]>, outputs: Record<string, string>, intake: { path: string, content: string } | null, switches: object[], overrides: object[], problems: string[] }}
 *   intake = 受け口の一覧(intake.txt)の生成区画を作り直した中身(一覧の数には入れない。intake.txt の無い fixture は null)
 */
export function planExtensions(repoRoot) {
  const identity = readForkIdentity(repoRoot);
  const { points: declared, problems } = collectPoints(repoRoot);
  problems.unshift(...identity.errors);
  // writer の点の一覧は別の生成器が書く: ここでは探さず書かない(宣言の数にだけ入る)
  const points = declared.filter((p) => !p.spec.writer);
  const dirOf = (p) => posix.normalize(posix.join(p.owner, p.spec.dir));
  const allDirs = new Set(points.map(dirOf));
  const groups = new Map();
  for (const p of points) groups.set(dirOf(p), [...(groups.get(dirOf(p)) ?? []), p]);

  const itemsByPoint = new Map();
  let featureTables = null;
  for (const [dir, group] of groups) {
    const others = new Set([...allDirs].filter((d) => d !== dir));
    const found = discoverDir(repoRoot, group[0].owner, posix.relative(group[0].owner, dir) || ".", group, others);
    problems.push(...found.problems);
    for (const p of group) {
      const items = found.items.get(p.name);
      if (p.spec.derive === "featureTables") {
        featureTables ??= createFeatureTables(repoRoot);
        const kept = [];
        for (const item of items) {
          const derived = featureTables.apply(item.path, item.text, item.name);
          if (derived.problem) problems.push(derived.problem);
          else kept.push({ ...item, fields: { name: item.name, ...derived.fields }, features: derived.features });
        }
        problems.push(...featureTables.unknownFeatures(items.map((item) => item.name)));
        itemsByPoint.set(p, kept);
      } else {
        itemsByPoint.set(p, items);
      }
    }
  }
  if (featureTables) problems.unshift(...featureTables.problems);
  problems.push(...checkSettingSections(points, itemsByPoint));

  const files = new Map();
  for (const p of points) files.set(outputOf(p), [...(files.get(outputOf(p)) ?? []), p]);
  const outputs = {};
  for (const [path, filePoints] of [...files.entries()].sort(([a], [b]) => byName(a, b))) {
    const names = filePoints.map((p) => p.name);
    if (new Set(names).size !== names.length) problems.push(`${path}: 同じ名前の点が 1 つの wiring に重なる`);
    outputs[path] = renderFile(filePoints, itemsByPoint);
  }
  const { isTier1 } = identity;
  const switchCheck = checkSwitches(repoRoot, { isTier1 });
  const overrideCheck = checkOverrides(repoRoot, { isTier1, receptacleDirs: allDirs });
  problems.push(...switchCheck.problems, ...overrideCheck.problems);
  const intakePlan = planIntake(repoRoot, declared, switchCheck.switches);
  if (intakePlan && "problem" in intakePlan) problems.push(intakePlan.problem);
  const intake = intakePlan && !("problem" in intakePlan) ? intakePlan : null;
  // 枠の表(<枠の根>/_layout/extensions/frameTable.ts。frame.default.ts / frame.ts から、frames.mjs)
  const framePlan = planFrames(repoRoot, headerFor);
  problems.push(...framePlan.problems);
  Object.assign(outputs, framePlan.outputs);
  const frames = { tables: Object.keys(framePlan.outputs).length, declarations: framePlan.declarations };
  return { points: declared, itemsByPoint, outputs, intake, switches: switchCheck.switches, overrides: overrideCheck.overrides, frames, warnings: framePlan.warnings, problems };
}

/** 点の項目(テスト・検査用): 持ち主のフォルダと点の名前で引く */
export function itemsOf(plan, owner, name) {
  const point = plan.points.find((p) => p.owner === owner && p.name === name);
  return point ? plan.itemsByPoint.get(point) : undefined;
}

/** 生成一覧と今のファイルのずれ(空 = 一致) */
export function staleOutputs(repoRoot, outputs) {
  return Object.entries(outputs)
    .filter(([path, content]) => {
      const abs = join(repoRoot, path);
      return !existsSync(abs) || readFileSync(abs, "utf8") !== content;
    })
    .map(([path]) => path);
}

/**
 * src の下の extensions/ にある、宣言に無いファイル(手で置いた・古い一覧)
 * @returns {{ path: string, generated: boolean, hint: string }[]} generated = 目印のヘッダを持つ(= 宣言が消えた古い一覧)
 */
export function strayExtensionFiles(repoRoot, outputs, points) {
  const strays = [];
  const writerOutputs = new Set(points.filter((p) => p.spec.writer).map(outputOf));
  const listPoints = points.filter((p) => !p.spec.writer);
  const walk = (dir, inside) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path, inside || entry.name === EXTENSIONS_DIR_NAME);
      } else if (inside && !(path in outputs) && !writerOutputs.has(path)) {
        const owner = path.slice(0, path.lastIndexOf(`/${EXTENSIONS_DIR_NAME}/`));
        const dirs = [...new Set(listPoints.filter((p) => p.owner === owner).map((p) => posix.normalize(posix.join(p.owner, p.spec.dir))))];
        const text = readFileSync(join(repoRoot, path), "utf8");
        strays.push({
          path,
          generated: text.startsWith(HEADER_PREFIX),
          hint: dirs.length > 0 ? `受け口は ${dirs.join(" / ")}` : `${owner} に拡張点の宣言(${DECLARATION_NAME}.ts)が無い`,
        });
      }
    }
  };
  walk(SEARCH_ROOT, false);
  return strays;
}
