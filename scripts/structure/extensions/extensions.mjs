// scripts/structure/extensions/extensions.mjs
// 拡張点の項目の走査と生成一覧の組み立て(pnpm generate extensions / pnpm check extensions の中身)。
// Node 組み込み + typescript(宣言の構文木)だけで動く。項目のファイルは import しない(字面で名前と export を見るだけ)。
// 項目の名前に fork の印は付けない(点つきの名前の分類は src/lib/districtMap/dottedNames.mjs)。
// 書式・置き場・失敗の条件: ./README.md

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";

import { classifyDottedName, oldMarkerProblem, DECLARATION_NAME, EXTENSIONS_DIR_NAME, PLUGS_DIR_NAME, SEARCH_ROOT, WIRE_NAME, isListPoint, isPlugsPoint, isSelectPoint } from "../../../src/lib/districtMap/index.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";

import { collectPoints } from "../../../src/lib/districtMap/node.mjs";
import { createFeatureTables } from "./derive/featureTables.mjs";
import { checkDependsOnGraph } from "./derive/gateDependsOn.mjs";
import { checkRequiresCoverage } from "./derive/gateRequires.mjs";
import { WHEN_INPUTS_NAME, renderWhenInputs } from "./derive/gateWhen.mjs";
import { checkSettingRoles } from "./derive/settingRoles.mjs";
import { checkOverrideKeys } from "./overrideKeys.mjs";
import { checkOrphans, filesOverrideNamesOf, listSrcFiles, targetOf } from "./orphans.mjs";
import { checkMessageGuards } from "./derive/messageGuards.mjs";
import { checkOverrides, isBlankSource } from "./overrides.mjs";
import { checkPureImports, literalPropOf, overrideKeys } from "./pureImports.mjs";
import { planFrames } from "./frames.mjs";
import { planIntake } from "./intake.mjs";
import { discoverPlugs } from "./plugs.mjs";
import { STATUS_POINT, planSelection } from "./select.mjs";
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
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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
  // files の点は同じフォルダを読む点を全部回す(レイアウトの layouts・layoutEmails・layoutInApps のように 1 つのフォルダの別々のファイル)
  if (points[0].spec.files) {
    const problems = [];
    for (const point of points) problems.push(...discoverFiles(repoRoot, rel, abs, point, items).problems);
    return { items, problems };
  }
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
    // <名前>.replace・<名前>.default は 1 行スイッチ <名前>.ts(x) の既定と置き換え。項目は素の名前のスイッチの方(ちょうど 1 つの点の上流の項目、
    // 差替点の宣言は項目を差したドメインの extensionPoints.ts。スイッチの形と孤立は switches.mjs が止める、注文 30)
    if (entry.isFile() && ["replace", "default"].includes(classifyDottedName(entry.name).kind)) continue;
    let itemFile;
    if (entry.isDirectory()) {
      if (entry.name === EXTENSIONS_DIR_NAME || entry.name.startsWith(".") || ignore.has(entry.name) || otherDirs.has(posix.join(rel, entry.name))) continue;
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
    // 1 行スイッチの項目(隣に <名前>.default.ts(x))は既定の中身で export を見る(置き換えも既定と同じ export の形)
    const switchDefault = entry.isFile() ? [".ts", ".tsx"].map((ext) => `${rel}/${place.name}.default${ext}`).find((f) => existsSync(join(repoRoot, f))) : undefined;
    const text = readFileSync(join(repoRoot, switchDefault ?? itemFile), "utf8");
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
    const item = items.get(point.name).find((i) => i.name === target);
    const refuse = point.spec.overrideRefuse;
    if (refuse && literalPropOf(item.path, item.text, point.spec.export, refuse.flag) === true && literalPropOf(label, text, "override", refuse.key) === refuse.value) {
      problems.push(`${label}: 項目 ${target} は ${refuse.flag}: true なので ${refuse.key}: ${JSON.stringify(refuse.value)} は書けない(点 ${point.name} の overrideRefuse、${point.declaredIn ?? "宣言"})`);
      continue;
    }
    item.override = label;
  }
  return { items, problems };
}

/**
 * files の点: 受け口の 1 段下の決まった名前のファイルが項目、項目名 = フォルダ名(ファイルが無いフォルダは項目でない)。
 * overrideOf の点は項目のファイルの隣の <ファイル名>.override.ts(属性だけ)を重ねる(鍵の検査は素の点と同じ)
 */
function discoverFiles(repoRoot, rel, abs, point, items) {
  const problems = [];
  const fileName = point.spec.files.slice("*/".length);
  const overrideNames = point.spec.overrideOf ? filesOverrideNamesOf(point.spec.files) : [];
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name))) {
    if (!entry.isDirectory()) continue;
    const overrideName = overrideNames.find((name) => existsSync(join(abs, entry.name, name)));
    const overrideLabel = overrideName ? `${rel}/${entry.name}/${overrideName}` : null;
    const overrideText = overrideLabel ? readFileSync(join(repoRoot, overrideLabel), "utf8") : null;
    const hasOverride = overrideText !== null && !isBlankSource(overrideText);
    if (!existsSync(join(abs, entry.name, fileName))) {
      if (hasOverride) problems.push(`${overrideLabel}: 項目 ${entry.name}/${fileName} が無い(override は同じ受け口の既存の項目の属性を上書きする)`);
      continue;
    }
    const label = `${rel}/${entry.name}/${fileName}`;
    const text = readFileSync(join(repoRoot, label), "utf8");
    if (!markOf(point.spec.export).test(text)) {
      problems.push(`${label}: export const ${point.spec.export} が無い`);
      continue;
    }
    const item = { name: entry.name, path: label, itemFile: label, text, folder: entry.name };
    if (hasOverride) {
      const keys = overrideKeys(overrideLabel, overrideText);
      if (keys === null) problems.push(`${overrideLabel}: export const override = { … } の形で書く`);
      else {
        const denied = keys.filter((k) => !point.spec.overrideOf.includes(k));
        if (denied.length > 0) problems.push(`${overrideLabel}: ${denied.join("・")} は上書きできない(できるのは ${point.spec.overrideOf.join("・")}。型と検証は変えられない)`);
        else item.override = overrideLabel;
      }
    }
    items.get(point.name).push(item);
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

/** 項目の runtime の字面(runtime: "nodejs" | "edge" | "both")。書かない = 既定の nodejs(src/lib/startup の StartupTask) */
export function runtimeOf(item) {
  return /\bruntime:\s*["'](nodejs|edge|both)["']/.exec(item.text ?? "")?.[1] ?? "nodejs";
}

/** 1 つの点の一覧の本体(ヘッダと型の import を除く) */
function renderPoint(point, items) {
  const { spec } = point;
  const T = spec.type.name;
  const lines = [];
  if (isPlugsPoint(spec)) return renderPlugsPoint(point, items);
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
    item.folder ? `  { ...${aliasOf(point, item)}, ${item.override ? `...${aliasOf(point, item)}_override, ` : ""}folder: ${JSON.stringify(item.folder)} },` : item.override ? `  { ...${aliasOf(point, item)}, ...${aliasOf(point, item)}_override },` : item.fields ? `  { ...${aliasOf(point, item)}, ${renderFields(aliasOf(point, item), item.fields)} },` : `  ${aliasOf(point, item)},`,
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
  if (spec.derive === "featureTables") lines.push(...renderGateTables(point.gateTables ?? { domains: [], cronTasks: [], settingSections: [] }));
  return { imports, lines };
}

/**
 * plugs の点の一覧: 項目 { domain, name, requires, plug }(load "lazy" は plug の代わりに load)の配列。
 * domain = 差したドメインのフォルダ名(lib の項目は null)、requires = そのドメインの requires。使う時に門番の gate.plugs で閉じたドメインの項目を外す(D26)。
 * alwaysOn の点は外さない(項目の enabled が自分で閉じる)。注文 25 の欄: overrideOf = 隣の <名前>.override.ts を plug に重ねる / files = folder を付ける /
 * shape "object" = 名前を鍵にした <点>Map と型 <点>Map も出す(名前は差す側をまたいで一意)/ literalKeys = 鍵の字面の union 型 <点>Key
 */
function renderPlugsPoint(point, items) {
  const { spec } = point;
  const T = spec.type.name;
  // stages の点(注文 31): 項目に段 stage を付け、型は段の名前の union(骨組みの段も含む)
  const stageType = Array.isArray(spec.stages) ? spec.stages.map((s) => JSON.stringify(s)).join(" | ") : null;
  const head = (item) => `domain: ${JSON.stringify(item.plug.domain)}, name: ${JSON.stringify(item.name)}, requires: [${item.plug.requires.map((r) => JSON.stringify(r)).join(", ")}]${stageType ? `, stage: ${JSON.stringify(item.stage)}` : ""}`;
  const shape = (value) => `{ domain: string | null; name: string; requires: readonly string[]; ${stageType ? `stage: ${stageType}; ` : ""}${value} }`;
  const typeName = cap(point.name);
  const lines = [];
  if (spec.literalKeys && typeof spec.key === "string") {
    const keyPattern = new RegExp(`\\b${spec.key}:\\s*["']([^"']+)["']`);
    const keys = [...new Set(items.map((item) => keyPattern.exec(item.text ?? "")?.[1]).filter((k) => k !== undefined))].sort(byName);
    lines.push(`/** 項目の ${spec.key} の字面(全体で一意) */`, `export type ${typeName}Key = ${keys.length === 0 ? "never" : keys.map((k) => JSON.stringify(k)).join(" | ")};`, "");
  }
  if (spec.load === "lazy") {
    // load の字面を持つ行(選ぶ点の起動時の知らせ、./select.mjs)はそのまま、ほかは項目のファイルを読む
    const importItem = (item) => `import(${JSON.stringify(specifierOf(item.path))}).then((m) => m.${spec.export})`;
    // runtimeGuard(起動時の処理): runtime が nodejs の項目(字面で "edge" | "both" と書かない物 = 既定)は NEXT_RUNTIME が nodejs の時だけ読む。
    // 一覧は edge の instrumentation の束にも入るので、条件の外の import は項目の Node 専用の物(node:crypto など)を edge に入れて警告になる。
    // edge では同じ名前の走らない nodejs の項目を返す(lib/startup が runtime で外す)
    const loadOf = (item) => {
      if (item.load) return item.load;
      if (spec.runtimeGuard && runtimeOf(item) === "nodejs") {
        return `async () => { if (process.env.NEXT_RUNTIME === "nodejs") return ${importItem(item)}; return { name: ${JSON.stringify(item.name)}, runtime: "nodejs", run: () => {} }; }`;
      }
      return `() => ${importItem(item)}`;
    };
    const list = items.map((item) => `  { ${head(item)}, load: ${loadOf(item)} },`);
    lines.push(`export const ${point.name}: ${shape(`load: () => Promise<${T}>`)}[] = ${list.length === 0 ? "[]" : `[\n${list.join("\n")}\n]`};`);
    return { imports: [], lines };
  }
  const alias = (item) => `${point.name}_${item.plug.domain ?? item.source}_${item.name.replace(/[^A-Za-z0-9]/g, "_")}`;
  const imports = items.map((item) => `import { ${spec.export} as ${alias(item)} } from ${JSON.stringify(specifierOf(item.path))};`);
  for (const item of items.filter((i) => i.override)) imports.push(`import { override as ${alias(item)}_override } from ${JSON.stringify(specifierOf(item.override))};`);
  const value = (item) => {
    const parts = [`...${alias(item)}`];
    if (item.override) parts.push(`...${alias(item)}_override`);
    if (item.folder) parts.push(`folder: ${JSON.stringify(item.folder)}`);
    return parts.length === 1 ? alias(item) : `{ ${parts.join(", ")} }`;
  };
  if (spec.shape === "object") {
    const map = `${point.name}Map`;
    const entries = items.map((item) => `  ${item.name}: ${value(item)},`);
    lines.push(`const ${map} = ${entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n}`} as const satisfies Readonly<Record<string, ${T}>>;`);
    lines.push(`/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */`, `export type ${typeName}Map = typeof ${map};`);
    const list = items.map((item) => `  { ${head(item)}, plug: ${map}.${item.name} },`);
    lines.push(`export const ${point.name}: ${shape(`plug: ${T}`)}[] = ${list.length === 0 ? "[]" : `[\n${list.join("\n")}\n]`};`);
    return { imports, lines };
  }
  const list = items.map((item) => `  { ${head(item)}, plug: ${value(item)} },`);
  lines.push(`export const ${point.name}: ${shape(`plug: ${T}${spec.files ? " & { folder: string }" : ""}`)}[] = ${list.length === 0 ? "[]" : `[\n${list.join("\n")}\n]`};`);
  return { imports, lines };
}

/** derive featureTables の導出の表: ドメイン(フォルダ・表・汎用 API の住所・持つ機能)と cron の task(住所・読むドメイン)。開閉は src/featureGate/ruleList.ts */
function renderGateTables({ domains, cronTasks, settingSections = [] }) {
  const list = (v) => `[${v.map((x) => JSON.stringify(x)).join(", ")}]`;
  const block = (name, type, rows) => `export const ${name}: ${type}[] = ${rows.length === 0 ? "[]" : `[\n${rows.map((row) => `  ${row},`).join("\n")}\n]`};`;
  return [
    "",
    "// domains = どれかの規則の features に載るドメイン(開 = 持つ機能 features のどれかが開。載らないドメインは常に開)、apiPaths = 汎用 API の住所",
    block("domains", "GatedDomain", domains.map((d) => `{ folder: ${JSON.stringify(d.folder)}, tables: ${list(d.tables)}, apiPaths: ${list(d.apiPaths)}, features: ${list(d.features)} }`)),
    "",
    "// cronTasks = domains のドメインを値で import する cron の task(開 = 読むドメイン folders が全部開。載らない task は常に開)",
    block("cronTasks", "GatedCronTask", cronTasks.map((t) => `{ path: ${JSON.stringify(t.path)}, folders: ${list(t.folders)} }`)),
    "",
    "// settingSections = 機能を名指す設定の節(開 = 名指す機能 features が全部開。名指さない節は常に開)",
    block("settingSections", "GatedSettingSection", settingSections.map((t) => `{ path: ${JSON.stringify(t.path)}, features: ${list(t.features)} }`)),
  ];
}

/** derive "settingSections": 項目の section の字面が、同じ持ち主の sections の key にあるか・上書きが権限を広げないか */
function checkSettingSections(repoRoot, points, itemsByPoint) {
  const problems = [];
  for (const point of points.filter((p) => p.spec.derive === "settingSections")) {
    // 節の点: 同じ持ち主の sections(plugs の点は持ち主の名前で始まる <持ち主>Sections、注文 24 Q1)
    const sections = points.find((p) => p.owner === point.owner && (p.name === "sections" || p.name === `${p.owner.slice(p.owner.lastIndexOf("/") + 1)}Sections`));
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
    // 上書きは権限を絞るだけ(広げない)。決まりと比べ方: ./derive/settingRoles.mjs
    const withOverrideText = (list) => list.map((i) => (i.override ? { ...i, overrideText: readFileSync(join(repoRoot, i.override), "utf8") } : i));
    problems.push(...checkSettingRoles(withOverrideText(itemsByPoint.get(point)), withOverrideText(sectionItems)));
  }
  return problems;
}

/** 生成一覧の出力先 */
const outputOf = (point) => (point.spec.target === "wiring" ? `${WIRING_DIR}/${basename(point.owner)}.ts` : `${point.owner}/${EXTENSIONS_DIR_NAME}/${point.name}.ts`);

/** 1 つの出力ファイルを組み立てる(wiring は同じ lib の点を 1 本に) */
// 生成器が付ける欄の描画。tables・domainApiPaths・settingPaths・cronPaths(derive featureTables)は説明用で項目の pathPatterns に足さない
// (汎用 API・cron の住所はドメインに、設定の節の住所は節に付き、生成一覧の domains・cronTasks・settingSections で開閉が決まる。D34 K4)。dependsOn は規則の字面の写し
function renderFields(alias, fields) {
  const literal = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));
  return Object.entries(fields).map(([k, v]) => `${k}: ${literal(v)}`).join(", ");
}

/**
 * lib の結び目(D31): 宣言 export const wire から src/wiring/<lib>.ts の末尾に書く。一覧は門番で絞ってから lib に渡す(D26)。
 * server = <export> = <name>({ <点>: gate.plugs(<点>), … })(点がどれも shape "object" なら <name><<点>Map, …>) / client = 子を包む部品 <export> が <name> に { <点>: useGate().plugs(<点>) } を渡す。
 * registers = 項目の key の字面(全体で一意、plugs.mjs)を lib の interface に広げる(登録名を型に載せる)
 * @returns {{ directive: string | null, imports: string[], lines: string[] }}
 */
function renderWire(wire, points, itemsByPoint) {
  const { spec, owner } = wire;
  const entry = `@/${owner.slice(`${SEARCH_ROOT}/`.length)}`;
  const args = `{ ${points.map((p) => `${p.name}: gate.plugs(${p.name})`).join(", ")} }`;
  if (spec.side === "server") {
    // 点がどれも shape "object" なら、項目の具体の型を残す <点>Map の型を宣言の順に型引数で渡す(利用者の型などを lib の作り手の戻り値へ運ぶ)
    const typeArgs = points.every((p) => p.spec.shape === "object") ? `<${points.map((p) => `${cap(p.name)}Map`).join(", ")}>` : "";
    return { directive: null, imports: ['import { gate } from "@/featureGate";', `import { ${spec.name} } from ${JSON.stringify(entry)};`], lines: [`export const ${spec.export} = ${spec.name}${typeArgs}(${args});`] };
  }
  const lines = [];
  if (spec.registers) {
    const keys = [];
    for (const p of points.filter((point) => typeof point.spec.key === "string")) {
      const pattern = new RegExp(`\\b${p.spec.key}:\\s*["']([^"']+)["']`);
      for (const item of itemsByPoint.get(p) ?? []) {
        const key = pattern.exec(item.text ?? "")?.[1];
        if (key !== undefined) keys.push(key);
      }
    }
    const union = keys.length === 0 ? "never" : [...new Set(keys)].sort(byName).map((k) => JSON.stringify(k)).join(" | ");
    lines.push(`declare module ${JSON.stringify(entry)} {`, `  // 登録名(項目の ${points.map((p) => p.spec.key).filter(Boolean).join("・")} の字面)を型に載せる`, `  interface ${spec.registers} extends Record<${union}, true> {}`, "}", "");
  }
  lines.push(
    `export function ${spec.export}({ children }: Readonly<{ children: ReactNode }>) {`,
    "  const gate = useGate();",
    `  return createElement(${spec.name}, ${args}, children);`,
    "}",
  );
  return {
    directive: '"use client";',
    imports: ['import { createElement, type ReactNode } from "react";', "", 'import { useGate } from "@/featureGate/client";', `import { ${spec.name} } from ${JSON.stringify(entry)};`],
    lines,
  };
}

function renderFile(points, itemsByPoint, wire = null) {
  const sources = [...new Set(points.map((p) => p.declaredIn))].join("・");
  const types = new Map();
  for (const p of points) {
    const names = types.get(p.spec.type.from) ?? new Set();
    names.add(p.spec.type.name);
    // 導出の表の型(門番の規則の一覧だけ)
    if (p.spec.derive === "featureTables") for (const extra of ["GatedCronTask", "GatedDomain", "GatedSettingSection"]) names.add(extra);
    types.set(p.spec.type.from, names);
  }
  const knot = wire ? renderWire(wire, points, itemsByPoint) : null;
  const out = [
    headerFor(sources),
    ...points.map((p) => isPlugsPoint(p.spec) ? `// ${p.name}: 差す側の <ドメイン>/${PLUGS_DIR_NAME}/${p.spec.itemsOf ?? p.name}/${p.spec.files ? p.spec.files : "<名前>.ts(x) か <名前>/index.ts(x)"}(lib は <lib>/${PLUGS_DIR_NAME}/…)の export const ${p.spec.export}${Array.isArray(p.spec.stages) ? ` と段 export const stage` : ""}(並びは${p.spec.order === "declared" ? "項目の order → " : ""}${Array.isArray(p.spec.stages) ? `段(${p.spec.stages.join(" → ")}。骨組みだけの段 ${(p.spec.skeletonStages ?? []).join("・") || "なし"})→ ` : ""}<差す側>/<名前> の順、${p.spec.alwaysOn ? "常に読む: gate.plugs を掛けず項目の enabled で閉じる" : "使う時に gate.plugs で閉じたドメインの項目を外す"}${p.spec.overrideOf ? `。隣の <名前>.override.ts の ${p.spec.overrideOf.join("・")} を重ねる` : ""})` : p.spec.files ? `// ${p.name}: ${posix.normalize(posix.join(p.owner, p.spec.dir))}/${p.spec.files} の export const ${p.spec.export}(folder = フォルダ名、並びはフォルダ名の順${p.spec.overrideOf ? `。隣の ${filesOverrideNamesOf(p.spec.files)[0]} の ${p.spec.overrideOf.join("・")} を重ねる` : ""})` : `// ${p.name}: ${posix.normalize(posix.join(p.owner, p.spec.dir))}/<名前>.ts(x) か <名前>/index.ts(x) の export const ${p.spec.export}(並びはファイル名の順)`),
    ...(knot ? [`// 結び目: ${wire.declaredIn} の ${WIRE_NAME}(一覧を門番で絞って lib の ${wire.spec.name} に渡す)`] : []),
    "",
    ...(knot?.directive ? [knot.directive, ""] : []),
    ...(knot ? [...knot.imports, ""] : []),
    ...[...types.entries()].sort(([a], [b]) => byName(a, b)).map(([from, names]) => `import type { ${[...names].sort(byName).join(", ")} } from ${JSON.stringify(from)};`),
  ];
  const bodies = points.map((p) => renderPoint(p, itemsByPoint.get(p)));
  const imports = bodies.flatMap((b) => b.imports);
  if (imports.length > 0) out.push("", ...imports);
  for (const body of bodies) out.push("", ...body.lines);
  if (knot) out.push("", ...knot.lines);
  out.push("");
  return out.join("\n");
}

/**
 * 全拡張点を走査して、生成一覧の中身を組み立てる。1 行スイッチと override の検査(./switches.mjs・./overrides.mjs)も同じ problems に
 * @param {string} repoRoot
 * @returns {{ points: object[], itemsByPoint: Map<object, object[]>, outputs: Record<string, string>, intake: { path: string, content: string } | null, switches: object[], overrides: object[], problems: string[] }}
 *   intake = 受け口の一覧(intake.txt)の生成区画を作り直した中身(一覧の数には入れない。intake.txt の無い fixture は null)
 */
/** proxy の骨組みのファイル(src/proxies の直下で項目でない物、注文 31) */
const PROXIES_SKELETON = ["extensionPoints.ts", "featureGate.ts", "index.ts", "redirect.ts", "types.ts"];
const OLD_PROXY_ITEM = /^export\s+const\s+(handler|decorator)\b/m;

/**
 * 古い置き場の proxy の項目(段 3 の前の受け口 src/proxies/<名前>.ts と src/proxies/redirects/)は読まれなくなるので止める。
 * 項目は差す側の <ドメイン>/plugs/proxyHandlers・proxyDecorators・proxyRedirects/<名前>.ts(D30、段 3 の道具が動かす)
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function oldProxyItemProblems(repoRoot) {
  const dir = join(repoRoot, "src/proxies");
  if (!existsSync(dir)) return [];
  const problems = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "redirects") {
      problems.push("src/proxies/redirects/: 転送の規則の古い置き場。自分のドメインの plugs/proxyRedirects/<名前>.ts へ(段 3 の道具が動かす)");
      continue;
    }
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || PROXIES_SKELETON.includes(entry.name) || /\.test\./.test(entry.name)) continue;
    const match = OLD_PROXY_ITEM.exec(readFileSync(join(dir, entry.name), "utf8"));
    if (match) {
      const point = match[1] === "handler" ? "proxyHandlers" : "proxyDecorators";
      problems.push(`src/proxies/${entry.name}: proxy の ${match[1]} の古い置き場。自分のドメインの plugs/${point}/<名前>.ts へ(${match[1] === "handler" ? 'export const stage = "<段>" も足す。' : ""}段 3 の道具が動かす)`);
    }
  }
  return problems;
}

/** 段 3 で畳んだ古い置き場(注文 32): 残っていれば読まれないので移す先を出して止める */
const OLD_FRAME_PLACES = [
  { dir: "src/app/_providers", message: "fork の Provider の古い口(ForkProviders、注文 32 で畳んだ)。自分のドメインの plugs/rootProviders/<名前>.tsx に export const provider と export const stage = \"project\" へ(段 3 の道具が動かす)" },
  { dir: "src/app/_layout/adminCommand", message: "管理者コマンドの点の古い置き場。カテゴリは自分のドメインの plugs/adminCommandCategories/<名前>.tsx、プラグインは plugs/adminCommandPlugins/<名前>.tsx へ(段 3 の道具が動かす)" },
];

/**
 * 古い置き場の枠の項目(段 3 の前の src/app/_providers・src/app/_layout/adminCommand)を止める
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function oldFramePlaceProblems(repoRoot) {
  return OLD_FRAME_PLACES.filter((p) => existsSync(join(repoRoot, p.dir))).map((p) => `${p.dir}/: ${p.message}`);
}

/** 消した例外の受け口(注文 36、D22・D34)。項目が残っていれば代わりのやり方を出して止める */
const OLD_EXCEPTION_PLACES = [
  { dir: "src/featureGate/alwaysOnExceptions", message: "常時実行の入口の例外の受け口は無くなった。exception(結線が閉じうるドメインを読む)→ 読みをやめ、ゲートの無い地区が宣言した点の項目としてドメインから受け取る / registry(fork の手書きの登録表)→ 自分のドメインの plugs/<点>/<名前>.ts の項目にする(D22)" },
  { dir: "src/featureGate/dependencyExceptions", message: "依存の検査の例外の受け口は無くなった。読む側のドメインの domainEntry.ts の requires・gate.enabled(\"<規則>\")・src/featureGate/required/<規則>.ts のどれかで守るか、読みを点の項目にする(D22)" },
  { dir: "scripts/proxies/alwaysOnExceptions", message: "常時実行の入口の例外の旧い置き場(受け口そのものも無くなった)。src/featureGate/alwaysOnExceptions と同じく、読みを点の項目にする(D22)" },
];

/**
 * 消した例外の受け口(src/featureGate/alwaysOnExceptions・dependencyExceptions と、もっと旧い scripts/proxies/alwaysOnExceptions[.<x>.mjs])を止める
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function oldExceptionPlaceProblems(repoRoot) {
  const problems = OLD_EXCEPTION_PLACES.filter((p) => existsSync(join(repoRoot, p.dir))).map((p) => `${p.dir}/: ${p.message}`);
  const proxiesDir = join(repoRoot, "scripts/proxies");
  if (existsSync(proxiesDir)) {
    for (const name of readdirSync(proxiesDir).filter((n) => n.startsWith("alwaysOnExceptions."))) problems.push(`scripts/proxies/${name}: ${OLD_EXCEPTION_PLACES[2].message}`);
  }
  return problems;
}

/** 型だけの入口の名前(D33、注文 37): ゲートの無い地区の持ち主の点の約束の型は <持ち主>/points(lib は入口 "./points")から出す */
export const POINTS_ENTRY_NAME = "points";

/**
 * ドメインでない持ち主(lib・枠・proxies・門番・ルート)の点の type.from は、その持ち主の型だけの入口 @/<持ち主>/points だけ(D33)。
 * 呼ぶのは実物の木を見る入口(generate.mjs・check.mjs)。planExtensions の fixture は型の置き場を問わない
 * @param {{ owner: string, name: string, declaredIn: string, spec: Record<string, any> }[]} points
 * @returns {string[]}
 */
export function pointsEntryProblems(points) {
  const problems = [];
  for (const p of points) {
    if (p.owner.startsWith("src/domains/") || !p.spec.type || typeof p.spec.type.from !== "string") continue;
    const entry = `@/${p.owner.slice("src/".length)}/${POINTS_ENTRY_NAME}`;
    if (p.spec.type.from !== entry) {
      problems.push(`${p.declaredIn}: ${p.name}: 約束の型は持ち主の型だけの入口から出す(type.from は "${entry}"、今 "${p.spec.type.from}"。${p.owner}/${POINTS_ENTRY_NAME}.ts に export type { ${p.spec.type.name ?? "…"} } を置く、D33)`);
    }
  }
  return problems;
}

export function planExtensions(repoRoot) {
  const identity = readForkIdentity(repoRoot);
  const { points: declared, wires, alwaysOpen, backendRequirements, problems } = collectPoints(repoRoot);
  problems.unshift(...identity.errors);
  problems.push(...oldProxyItemProblems(repoRoot), ...oldFramePlaceProblems(repoRoot), ...oldExceptionPlaceProblems(repoRoot));
  // writer の点の一覧は別の生成器が書く・overrides の点は一覧を持たない: ここでは探さず書かない(宣言の数にだけ入る)
  const listPoints = declared.filter((p) => isListPoint(p.spec));
  const points = listPoints.filter((p) => !isPlugsPoint(p.spec));
  const dirOf = (p) => posix.normalize(posix.join(p.owner, p.spec.dir));
  const allDirs = new Set(points.map(dirOf));
  const groups = new Map();
  for (const p of points) groups.set(dirOf(p), [...(groups.get(dirOf(p)) ?? []), p]);

  const itemsByPoint = new Map();
  /** 導出の生成物(規則の when の一覧 whenInputs.ts) */
  const derivedOutputs = {};
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
          else kept.push({ ...item, fields: { name: item.name, ...derived.fields }, domainFolders: derived.domainFolders, domains: derived.domains, whenRefs: derived.whenRefs });
        }
        // 導出の表: ドメイン(持つ機能を集める、フォルダの順)と cron の task(住所の順)
        const domainMap = new Map();
        for (const item of kept) {
          for (const d of item.domains) {
            const entry = domainMap.get(d.folder) ?? { ...d, features: [] };
            entry.features.push(item.name);
            domainMap.set(d.folder, entry);
          }
        }
        const domains = [...domainMap.values()].sort((a, b) => byName(a.folder, b.folder));
        // 設定の節(名指す機能が規則に無い節は unknownFeatures が止める。ここでは知っている名前だけの節を載せる)
        const names = new Set(kept.map((item) => item.name));
        const settingSections = featureTables.settingSections.filter((section) => section.features.every((name) => names.has(name)));
        p.gateTables = { domains, cronTasks: featureTables.cronTasksFor(domains.map((d) => d.folder)), settingSections };
        problems.push(...featureTables.unknownFeatures(items.map((item) => item.name)));
        // dependsOn の未知の名前・輪(全規則で。読めなかった規則は名前だけ知っている物として数える)
        const unread = items.filter((item) => !kept.some((k) => k.name === item.name)).map((item) => ({ path: item.path, name: item.name, dependsOn: [] }));
        problems.push(...checkDependsOnGraph([...kept.map((item) => ({ path: item.path, name: item.name, dependsOn: item.fields.dependsOn, anyOf: item.fields.anyOf })), ...unread]));
        // requires の被覆(機能のドメインの requires の先が自分・依存先・常設のどれか、D24。例外は上流の規則の縮む表で、fork にも同じ規則があるので全 Tier で数える)
        problems.push(
          ...checkRequiresCoverage(
            kept.map((item) => ({ path: item.path, name: item.name, domains: item.domainFolders, dependsOn: item.fields.dependsOn })),
            featureTables.districts,
          ),
        );
        // when が指したドメインの config.ts だけを import する一覧(<門番>/extensions/whenInputs.ts、./derive/gateWhen.mjs)
        derivedOutputs[`${p.owner}/${EXTENSIONS_DIR_NAME}/${WHEN_INPUTS_NAME}.ts`] = renderWhenInputs(headerFor(p.declaredIn), kept.flatMap((item) => item.whenRefs));
        itemsByPoint.set(p, kept);
      } else {
        itemsByPoint.set(p, items);
      }
    }
  }
  if (featureTables) problems.unshift(...featureTables.problems);
  // plugs の点: 差す側の <ドメイン>/plugs/<点>/ から集める(./plugs.mjs。項目の検査は受け口のフォルダと同じ discoverDir)
  const plugs = discoverPlugs(repoRoot, listPoints, discoverDir);
  problems.push(...plugs.problems);
  for (const [p, items] of plugs.itemsByPoint) itemsByPoint.set(p, items);
  problems.push(...checkSettingSections(repoRoot, listPoints, itemsByPoint));

  // 選ぶ点(D9・D36): 一覧でなく、選択表 backend-selection.json が指す 1 項目の re-export(./select.mjs)
  const gatePoint = listPoints.find((p) => p.spec.derive === "featureTables");
  const selection = planSelection({ repoRoot, points: declared, itemsByPoint, alwaysOpen, backendRequirements, gateDomains: gatePoint?.gateTables?.domains ?? [], headerFor });
  problems.push(...selection.problems);
  // 選ぶ点の起動時の知らせの行(項目のファイルは無い、D49)は点 startupTasks の一覧に足す(差す側 backends、lib の行なので門番は外さない)
  const statusPoint = listPoints.find((p) => isPlugsPoint(p.spec) && p.name === STATUS_POINT);
  if (statusPoint && selection.statusEntries.length > 0) {
    const items = [...itemsByPoint.get(statusPoint)];
    for (const entry of selection.statusEntries) items.push({ name: entry.name, path: entry.path, itemFile: entry.path, load: entry.load, source: "backends", standing: true, plug: { domain: null, requires: [] } });
    items.sort((a, b) => byName(`${a.source}/${a.name}`, `${b.source}/${b.name}`));
    itemsByPoint.set(statusPoint, items);
  }
  const files = new Map();
  for (const p of listPoints.filter((point) => !isSelectPoint(point.spec))) files.set(outputOf(p), [...(files.get(outputOf(p)) ?? []), p]);
  const outputs = {};
  // 結び目(lib の export const wire)は同じ lib の wiring の点の一覧のファイルに書く。wiring の点の無い lib の結び目は止める
  const wireOf = new Map(wires.map((w) => [w.owner, w]));
  for (const w of wires) {
    if (!listPoints.some((p) => p.owner === w.owner && p.spec.target === "wiring" && isPlugsPoint(p.spec))) problems.push(`${w.declaredIn}: ${WIRE_NAME} は target "wiring" の plugs の点と一緒に宣言する(結び目は src/wiring/<lib>.ts に一覧と並ぶ)`);
    if (w.spec.registers && !listPoints.some((p) => p.owner === w.owner && typeof p.spec.key === "string")) problems.push(`${w.declaredIn}: ${WIRE_NAME} の registers は key を持つ点と一緒に(登録名 = 項目の key の字面)`);
  }
  for (const [path, filePoints] of [...files.entries()].sort(([a], [b]) => byName(a, b))) {
    const names = filePoints.map((p) => p.name);
    if (new Set(names).size !== names.length) problems.push(`${path}: 同じ名前の点が 1 つの wiring に重なる`);
    const wire = filePoints[0].spec.target === "wiring" ? (wireOf.get(filePoints[0].owner) ?? null) : null;
    outputs[path] = renderFile(filePoints, itemsByPoint, wire);
  }
  Object.assign(outputs, derivedOutputs, selection.outputs);
  const { isTier1 } = identity;
  const switchCheck = checkSwitches(repoRoot, { isTier1, points: declared });
  const overrideCheck = checkOverrides(repoRoot, { isTier1 });
  // 孤立の検査は 1 つ(.override・.replace、D165)。上書きの対象の点が受けた上書きの鍵は宣言と照らす
  const orphanCheck = checkOrphans(repoRoot, { points: declared, receptacleDirs: allDirs });
  problems.push(...switchCheck.problems, ...overrideCheck.problems, ...orphanCheck.problems, ...checkOverrideKeys(repoRoot, orphanCheck.overrides, targetOf));
  // 止められない連絡(required)の守り: 連絡の定義と上書きを字面で読む(./derive/messageGuards.mjs)
  problems.push(...checkMessageGuards(repoRoot, declared, listSrcFiles(repoRoot)));
  const intakePlan = planIntake(repoRoot, declared, switchCheck.switches);
  if (intakePlan && "problem" in intakePlan) problems.push(intakePlan.problem);
  const intake = intakePlan && !("problem" in intakePlan) ? intakePlan : null;
  // 枠の表(<枠の根>/_layout/extensions/frameTable.ts。frame.ts / frame.override.ts から、frames.mjs)
  const framePlan = planFrames(repoRoot, headerFor);
  problems.push(...framePlan.problems);
  Object.assign(outputs, framePlan.outputs);
  const frames = { tables: Object.keys(framePlan.outputs).length, declarations: framePlan.declarations };
  return { points: declared, itemsByPoint, outputs, intake, switches: switchCheck.switches, overrides: overrideCheck.overrides, frames, warnings: [...framePlan.warnings, ...selection.warnings], selection: { problems: selection.problems, paths: selection.paths }, problems };
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
export function strayExtensionFiles(repoRoot, outputs, points, keep = []) {
  const kept = new Set(keep);
  const strays = [];
  const writerOutputs = new Set(points.filter((p) => p.spec.writer).map(outputOf));
  const listPoints = points.filter((p) => isListPoint(p.spec) && !isPlugsPoint(p.spec));
  const walk = (dir, inside) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path, inside || entry.name === EXTENSIONS_DIR_NAME);
      } else if (kept.has(path)) {
        // 選ぶ点に問題がある間の選ぶ点の生成物(書かず・消さず・古いと数えない)
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

/**
 * 選ぶ点に問題がある間に生成と検査が触らない選ぶ点の生成物(問題が無ければ空)
 * @param {{ selection: { problems: string[], paths: string[] } }} plan
 */
export const heldSelectionPaths = (plan) => (plan.selection.problems.length > 0 ? plan.selection.paths : []);

/**
 * pnpm generate extensions の本体: 宣言と項目から全部の一覧を書き、宣言の消えた古い一覧(生成の印つき)を消す。
 * - 選ぶ点でない問題があれば何も書かずに止める
 * - 問題が選ぶ点(選択表)のものだけなら、選ぶ点でない一覧と可変域の区画は書き、選ぶ点の生成物は今のまま残し、問題を出して止める
 *   (選択表の鍵の欠けで src/wiring/startup.ts の衝突を作り直せない、を避ける。起動時の知らせの行は選択表に左右されず一覧に残る)
 * @param {string} repoRoot
 * @returns {{ code: 0 | 1, out: string[], err: string[], warn: string[] }}
 */
export function writeExtensions(repoRoot) {
  const plan = planExtensions(repoRoot);
  plan.problems.push(...pointsEntryProblems(collectPoints(repoRoot).points));
  const selectionProblems = new Set(plan.selection.problems);
  const others = plan.problems.filter((p) => !selectionProblems.has(p));
  const out = [];
  const err = [];
  const warn = plan.warnings.map((w) => `[generate extensions] warn: ${w}`);
  if (others.length > 0) {
    err.push(`[generate extensions] 書き出しを止めました(${plan.problems.length} 件):\n${plan.problems.map((p) => `  - ${p}`).join("\n")}`);
    return { code: 1, out, err, warn };
  }
  const held = heldSelectionPaths(plan);
  const stale = staleOutputs(repoRoot, plan.outputs);
  for (const path of stale) {
    const abs = join(repoRoot, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, plan.outputs[path]);
  }
  // 受け口の一覧の生成区画(intake.txt。一覧の数には入れない)
  if (plan.intake && (!existsSync(join(repoRoot, plan.intake.path)) || readFileSync(join(repoRoot, plan.intake.path), "utf8") !== plan.intake.content)) {
    writeFileSync(join(repoRoot, plan.intake.path), plan.intake.content);
    stale.push(plan.intake.path);
  }
  const strays = strayExtensionFiles(repoRoot, plan.outputs, plan.points, held);
  const removed = strays.filter((s) => s.generated);
  for (const stray of removed) rmSync(join(repoRoot, stray.path));
  const handMade = strays.filter((s) => !s.generated);
  out.push(
    `[generate extensions] 点 ${plan.points.length} / 一覧 ${Object.keys(plan.outputs).length}(うち枠の表 ${plan.frames.tables}、宣言 ${plan.frames.declarations})` +
      (stale.length > 0 ? `、書き出し: ${stale.join(", ")}` : "、変更なし") +
      (removed.length > 0 ? `、古い一覧を削除: ${removed.map((s) => s.path).join(", ")}` : ""),
  );
  let code = /** @type {0 | 1} */ (0);
  if (handMade.length > 0) {
    err.push(`[generate extensions] extensions/ に手で置いたファイル(${handMade.length} 件、消していない):\n${handMade.map((s) => `  - ${s.path}: 生成物の置き場。${s.hint}`).join("\n")}`);
    code = 1;
  }
  if (selectionProblems.size > 0) {
    err.push(`[generate extensions] 選ぶ点の生成物は書いていない(ほかの一覧は書いた。${selectionProblems.size} 件、直して生成し直す):\n${[...selectionProblems].map((p) => `  - ${p}`).join("\n")}`);
    code = 1;
  }
  return { code, out, err, warn };
}
