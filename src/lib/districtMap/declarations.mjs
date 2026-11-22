// 拡張点の宣言(extensionPoints.ts = 地区の受け口)の唯一の読み手。地区の地図(./read.mjs)・生成器(scripts/structure/extensions)・
// 所有の検査の単位名(src/lib/forkOwnership/unitNames.mjs)・src/wiring の配線テスト・上書きの読み手(ロール scripts/structure/role・
// cron src/lib/cron/discover.ts・登録表 scripts/structure/registry/serviceRegistry。上書きしてよい鍵は overrideKeysOf)が使う
// (D2: 仕組みは src/lib に 1 本、scripts から import。目録 D13: 地区の発見の側に置き、所有の軸 forkOwnership はここを import する)。
// ファイルを読まない(入口 "." から出す。木を歩いて探す findDeclarationFiles・collectPoints・overrideKeysOf は ./declarationFiles.mjs、入口 "./node")。
// fork の点は fork 自身のフォルダの extensionPoints.ts に書く
// (旧い extensionPoints.<x>.ts は止めて移し方を案内する)。
// 宣言はリテラルだけ: TypeScript の構文木で字面を読み、実行しない(式・変数・関数呼び出し・テンプレートは失敗)。
// 書式と置き場: scripts/structure/extensions/README.md

import ts from "typescript";

export const DECLARATION_NAME = "extensionPoints";
/** lib の結び目の宣言の名前(同じ extensionPoints.ts の export const wire、D31): 生成器が src/wiring/<lib>.ts に一覧と一緒に結び目を書く */
export const WIRE_NAME = "wire";
/**
 * ドメインの常設の明示の宣言の名前(同じ extensionPoints.ts の export const alwaysOpen = true、D22・D53、注文 35)。
 * 常設 = どの機能の規則にも載らず常に開くドメイン。宣言はドメインだけ(lib・枠などは止める)。点の欄 alwaysOn(門番を掛けずに読む一覧)とは別の物
 */
export const ALWAYS_OPEN_NAME = "alwaysOpen";
/** ドメインの地区の置き場(常設の宣言を持てるのはこの下の宣言だけ) */
const DOMAINS_ROOT = "src/domains/";
/** 宣言を探す範囲(リポジトリ直下からの相対) */
export const SEARCH_ROOT = "src";
/** 生成一覧の置き場の名前(持ち主のフォルダの直下) */
export const EXTENSIONS_DIR_NAME = "extensions";
/** 差す側の手書きの項目の置き場の名前(<ドメイン>/plugs/<点の名前>/<名前>.ts(x)、lib は <lib>/plugs/…。extensions/ = 持ち主の側の生成された一覧と対、D40) */
export const PLUGS_DIR_NAME = "plugs";
/**
 * plugs の下に置く、増設点ではない登録表の項目のフォルダ(D42: messages と recordTargets も plugs の下)。
 * 項目は <ドメイン>/plugs/<フォルダ>/<名前>.ts、集めるのは pnpm generate registry(連絡の一覧・記録の宛先の一覧)。点の名前に使えない
 */
export const PLUGS_REGISTRY_FOLDERS = ["messages", "recordTargets"];

/** @typedef {LiteralValue[]} LiteralArray 再帰の型は配列だけ別の JSDoc に置く(同じ塊だと TS2456) */
/**
 * @typedef {string | number | boolean | LiteralArray | LiteralObject} LiteralValue 宣言に書けるリテラルの値
 * @typedef {{ [key: string]: LiteralValue }} LiteralObject
 * @typedef {{ value: LiteralValue, problem?: undefined } | { problem: string, value?: undefined }} LiteralRead literalOf の結果
 * @typedef {{ [key: string]: LiteralValue | undefined }} PointSpec 1 つの点の宣言(キーと形は checkPoint が確かめる)
 * @typedef {{ name: string, export: string, side: "server" | "client", registers?: string }} WireSpec lib の結び目の宣言(checkWire が確かめる)
 */

const SIDES = ["server", "client", "shared"];
const LOADS = ["eager", "lazy"];
const WRITERS = ["role:generate"];
const TARGETS = ["wiring"];
/** 組み込みの変換(一覧の項目に付け足す値)。fork が足す口は無い */
export const DERIVES = ["featureTables", "settingSections"];
const KEYS = ["change", "plugs", "max", "required", "order", "stages", "skeletonStages", "default", "dir", "export", "type", "side", "key", "load", "target", "ignore", "derive", "alwaysOn", "literalKeys", "files", "shape", "pureImports", "requireText", "overrideOf", "writer", "overrides", "addable", "placement", "kind", "keyedBy", "itemsOf"];
/**
 * 点の変え方の型(CHANGE_TYPES 1〜4、地区の議会 D20・D35)。どの点も change を書く(段 2 の宣言の 2 段の 1 段目)。
 * add = 増設点(dir か files の受け口、writer の一覧も fork が項目を足す点)/ override = 上書点(overrides)/ counterpart = 対置点(placement)/
 * replace = 差替点(default の既定の出し手と type の約束の型。ちょうど 1 つ、D24・D53)
 */
export const CHANGES = ["add", "override", "counterpart", "replace"];
/** 増設点の順位の並び: file = 項目のファイル名の順 / declared = 項目が宣言する順位 */
const ORDERS = ["file", "declared"];
/** 置き場の点が名乗れる種類(受け口の一覧 intake.txt の行の kind) */
export const PLACEMENT_KINDS = ["edit", "append"];
/** 上書きの対象の点(受け口でない)が持てるキー */
const OVERRIDE_TARGET_KEYS = ["change", "overrides", "side", "overrideOf", "addable", "export", "keyedBy"];
/** plugs の点が持てないキー(項目のフォルダは差す側の <ドメイン か lib>/plugs/<点>/ に決まる。注文 25 で上書き・形・導出・常時・files を受けた) */
const PLUGS_DENIED = ["dir", "ignore"];
/** 差替点が持てるキー */
const REPLACE_KEYS = ["change", "default", "type", "side"];
const POINT_NAME = /^[a-z][A-Za-z0-9]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * 構文木の値をリテラルとして読む。リテラルでなければ { problem }
 * @param {ts.Node} node
 * @returns {LiteralRead}
 */
export function literalOf(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { value: node.text };
  if (ts.isNumericLiteral(node)) return { value: Number(node.text) };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (ts.isArrayLiteralExpression(node)) {
    /** @type {LiteralValue[]} */
    const value = [];
    for (const element of node.elements) {
      const read = literalOf(element);
      if (read.problem !== undefined) return read;
      value.push(read.value);
    }
    return { value };
  }
  if (ts.isObjectLiteralExpression(node)) {
    /** @type {{ [key: string]: LiteralValue }} */
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) return { problem: `リテラルでない書き方(${property.getText()})` };
      const name = property.name;
      if (!(ts.isIdentifier(name) || ts.isStringLiteral(name))) return { problem: `キーはリテラル(${name.getText()})` };
      const read = literalOf(property.initializer);
      if (read.problem !== undefined) return read;
      value[name.text] = read.value;
    }
    return { value };
  }
  return { problem: `リテラルでない値(${node.getText()})。宣言は文字列・真偽・数・配列・object だけで書く` };
}

/**
 * 空でない文字列か
 * @param {unknown} v
 * @returns {v is string}
 */
const isString = (v) => typeof v === "string" && v.length > 0;
/**
 * 決まった名前の 1 つか
 * @param {readonly string[]} list
 * @param {unknown} v
 */
const oneOf = (list, v) => typeof v === "string" && list.includes(v);

/**
 * 1 つの点の宣言を確かめる。問題の一覧を返す
 * @param {string} name
 * @param {LiteralValue} value
 * @returns {string[]}
 */
function checkPoint(name, value) {
  /** @type {string[]} */
  const problems = [];
  if (!POINT_NAME.test(name)) problems.push(`点の名前 ${name} は英小文字始まりの camelCase(項目の種類の複数形)`);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [...problems, `${name}: 点は object で書く`];
  /** @type {PointSpec} */
  const point = value;
  for (const key of Object.keys(point)) if (!KEYS.includes(key)) problems.push(`${name}: 未知のキー ${key}(使えるのは ${KEYS.join(" / ")})`);
  // change: どの点も変え方の型を書く。型は欄と合う(段 2 の前の形は段 2 の移し替えの道具 .notices/20261122-213044-district-stage2.declarations.mjs で書き直す)
  const expected = changeOfFields(point);
  if (point.change === undefined) problems.push(`${name}: change が無い(${CHANGES.join(" | ")} のどれか。欄から読むと ${expected}。段 2 の移し替えの道具で書き直す)`);
  else if (!oneOf(CHANGES, point.change)) problems.push(`${name}: change は ${CHANGES.join(" | ")}`);
  else if (point.change !== expected) problems.push(`${name}: change ${point.change} が欄と合わない(${fieldsNote(point)}の点は ${expected})`);
  // placement: 置き場の点。fork が書いてよい場所(リポジトリ直下からの glob)と、その書き方(intake.txt の kind)だけを持つ
  if (point.placement !== undefined) {
    if (!isString(point.placement) || !point.placement.startsWith(`${SEARCH_ROOT}/`) || point.placement.split("/").includes("..")) {
      problems.push(`${name}: placement は置き場のリポジトリ直下からの glob(${SEARCH_ROOT}/ 始まり、.. 無し)`);
    }
    if (!oneOf(PLACEMENT_KINDS, point.kind)) problems.push(`${name}: kind は ${PLACEMENT_KINDS.join(" | ")}`);
    for (const key of Object.keys(point)) if (KEYS.includes(key) && !["change", "placement", "kind"].includes(key)) problems.push(`${name}: placement の点に ${key} は書けない(書けるのは change / placement / kind)`);
    return problems;
  }
  if (point.kind !== undefined) problems.push(`${name}: kind は placement の点だけ`);
  // overrides: 受け口でない上書きの対象の点(ロールの JSON・cron の task.ts・domainEntry.ts など)。
  // 対象のファイルの場所(リポジトリ直下からの glob)と、隣の <対象>.override.ts が書いてよい鍵を持つ。
  // addable: true = fork が同じ場所に対象を足してよい(ロール・プロフィールの JSON。受け口の一覧 intake.txt の add の行になる)
  if (point.overrides !== undefined) {
    if (!isString(point.overrides) || !point.overrides.startsWith(`${SEARCH_ROOT}/`) || point.overrides.split("/").includes("..")) {
      problems.push(`${name}: overrides は対象のファイルのリポジトリ直下からの glob(${SEARCH_ROOT}/ 始まり、.. 無し)`);
    }
    if (!oneOf(SIDES, point.side)) problems.push(`${name}: side は ${SIDES.join(" | ")}`);
    if (!(Array.isArray(point.overrideOf) && point.overrideOf.length > 0 && point.overrideOf.every(isString))) problems.push(`${name}: overrideOf は上書きしてよい属性の名前の配列(overrides の点では必須)`);
    if (!isString(point.export) || !IDENTIFIER.test(point.export)) problems.push(`${name}: export は上書きのファイルが export する名前(例 override)`);
    // keyedBy: 上書きが { <対象のキー>: <宣言した 1 つの属性の値> } の形(domainEntry)。値は対象のその export のキーの中だけ
    if (point.keyedBy !== undefined && (!isString(point.keyedBy) || !IDENTIFIER.test(point.keyedBy))) problems.push(`${name}: keyedBy は対象のファイルが export する名前(キーの集合)`);
    if (point.keyedBy !== undefined && Array.isArray(point.overrideOf) && point.overrideOf.length !== 1) problems.push(`${name}: keyedBy の点の overrideOf は 1 つ(キーごとに 1 つの属性を差し替える)`);
    if (point.addable !== undefined && point.addable !== true) problems.push(`${name}: addable は true だけ(fork が対象を足してよい点の印。足せない点は書かない)`);
    for (const key of Object.keys(point)) if (KEYS.includes(key) && !OVERRIDE_TARGET_KEYS.includes(key)) problems.push(`${name}: overrides の点に ${key} は書けない(書けるのは ${OVERRIDE_TARGET_KEYS.join(" / ")})`);
    return problems;
  }
  // writer: 一覧を別の生成器が書く点。受け口・印・型は無く、持てるのは side だけ
  if (point.writer !== undefined) {
    if (!oneOf(WRITERS, point.writer)) problems.push(`${name}: writer は ${WRITERS.join(" | ")}`);
    if (!oneOf(SIDES, point.side)) problems.push(`${name}: side は ${SIDES.join(" | ")}`);
    for (const key of Object.keys(point)) if (!["change", "writer", "side"].includes(key)) problems.push(`${name}: writer の点に ${key} は書けない`);
    return problems;
  }
  // default: 差替点。既定の出し手(リポジトリ直下からのパス)と約束の型を持つ。ちょうど 1 つ要る点で、fork は差し替える(足して 2 つにしない、D24・D53)
  if (point.default !== undefined) {
    if (!isString(point.default) || !point.default.startsWith(`${SEARCH_ROOT}/`) || point.default.split("/").includes("..")) problems.push(`${name}: default は既定の出し手のリポジトリ直下からのパス(${SEARCH_ROOT}/ 始まり、.. 無し)`);
    if (typeof point.type !== "object" || point.type === null || Array.isArray(point.type) || !isString(point.type.from) || !isString(point.type.name) || !IDENTIFIER.test(point.type.name)) {
      problems.push(`${name}: type は { from: "<import 元>", name: "<約束の型の名前>" }`);
    }
    if (!oneOf(SIDES, point.side)) problems.push(`${name}: side は ${SIDES.join(" | ")}`);
    for (const key of Object.keys(point)) if (KEYS.includes(key) && !REPLACE_KEYS.includes(key)) problems.push(`${name}: 差替点に ${key} は書けない(書けるのは ${REPLACE_KEYS.join(" / ")})`);
    return problems;
  }
  if (point.keyedBy !== undefined) problems.push(`${name}: keyedBy は overrides の点だけ`);
  // plugs: 項目を差す側の自分のフォルダ <ドメイン>/plugs/<点の名前>/(lib は <lib>/plugs/…)から集める増設点(D38・D40)。項目のフォルダ dir は持たない
  if (point.plugs !== undefined) {
    if (point.plugs !== true) problems.push(`${name}: plugs は true だけ(差す側の <ドメイン>/plugs/${name}/ から集める増設点の印)`);
    for (const key of PLUGS_DENIED) if (point[key] !== undefined) problems.push(`${name}: plugs の点に ${key} は書けない(項目は差す側の <ドメイン>/plugs/${name}/<名前>.ts(x)、一覧は配列)`);
    // itemsOf: 同じ宣言の別の plugs の点の項目のフォルダ(plugs/<その点>/<名前>/)の別のファイルを読む点(連絡のレイアウトのメール・お知らせの描き方、注文 25)
    if (point.itemsOf !== undefined && (!isString(point.itemsOf) || !POINT_NAME.test(point.itemsOf) || point.files === undefined)) problems.push(`${name}: itemsOf は同じ宣言の plugs の点の名前で、files と一緒に(その点の項目のフォルダの別のファイルを読む)`);
  } else if (point.itemsOf !== undefined) problems.push(`${name}: itemsOf は plugs の点だけ`);
  else if (!isString(point.dir) || point.dir.startsWith("/") || point.dir.split("/").includes("..")) problems.push(`${name}: dir は持ち主のフォルダからの相対パス("." = 持ち主の直下)`);
  if (!isString(point.export) || !IDENTIFIER.test(point.export)) problems.push(`${name}: export は項目が export する名前`);
  if (typeof point.type !== "object" || point.type === null || Array.isArray(point.type) || !isString(point.type.from) || !isString(point.type.name) || !IDENTIFIER.test(point.type.name)) {
    problems.push(`${name}: type は { from: "<import 元>", name: "<型の名前>" }`);
  }
  if (!oneOf(SIDES, point.side)) problems.push(`${name}: side は ${SIDES.join(" | ")}`);
  if (point.key !== undefined && (!isString(point.key) || !IDENTIFIER.test(point.key))) problems.push(`${name}: key は項目の値のプロパティ名`);
  if (point.load !== undefined && !oneOf(LOADS, point.load)) problems.push(`${name}: load は ${LOADS.join(" | ")}`);
  if (point.target !== undefined && !oneOf(TARGETS, point.target)) problems.push(`${name}: target は ${TARGETS.join(" | ")}`);
  if (point.ignore !== undefined && !(Array.isArray(point.ignore) && point.ignore.every(isString))) problems.push(`${name}: ignore はファイル名の配列`);
  if (point.derive !== undefined && !oneOf(DERIVES, point.derive)) problems.push(`${name}: derive は ${DERIVES.join(" | ")}(組み込みの変換だけ)`);
  if (point.literalKeys !== undefined && (point.literalKeys !== true || point.key === undefined)) problems.push(`${name}: literalKeys は key と一緒に true だけ`);
  if (point.alwaysOn !== undefined && typeof point.alwaysOn !== "boolean") problems.push(`${name}: alwaysOn は真偽`);
  if (point.files !== undefined && !(isString(point.files) && /^\*\/[A-Za-z_][A-Za-z0-9_.]*\.tsx?$/.test(point.files))) problems.push(`${name}: files は "*/<ファイル名>"(受け口の 1 段下の決まった名前のファイル)`);
  // plugs の点の shape は名前で引く表と並ぶので key(全体で一意の鍵)と一緒に使える(注文 27: 端末の種類は kind の型を表の型から導く)
  if (point.shape !== undefined && (point.shape !== "object" || (point.key !== undefined && point.plugs !== true) || point.load !== undefined || point.files !== undefined)) problems.push(`${name}: shape は "object" だけで、load・files と(plugs でない点では key とも)一緒に使えない`);
  if (point.pureImports !== undefined && point.pureImports !== true) problems.push(`${name}: pureImports は true だけ`);
  if (point.requireText !== undefined && !isString(point.requireText)) problems.push(`${name}: requireText は文字列`);
  if (point.overrideOf !== undefined && !(Array.isArray(point.overrideOf) && point.overrideOf.length > 0 && point.overrideOf.every(isString))) problems.push(`${name}: overrideOf は上書きしてよい属性の名前の配列`);
  if (point.load === "lazy" && (point.key !== undefined || point.derive !== undefined)) problems.push(`${name}: load "lazy" は key・derive と一緒に使えない`);
  // 増設点の欄(D24・D53): max = 上限(空なら点の持ち主の既定で動く)、order = 順位の並び(意味がある点だけ)
  if (point.max !== undefined && !(Number.isInteger(point.max) && Number(point.max) >= 1)) problems.push(`${name}: max は 1 以上の整数(増設点の上限)`);
  if (point.order !== undefined && !oneOf(ORDERS, point.order)) problems.push(`${name}: order は ${ORDERS.join(" | ")}`);
  // ちょうど 1 つの点(D53、注文 30): required = 項目が 1 つ無ければ生成で止める。plugs で max: 1 の点だけ。
  // 上流の既定は常設のドメインの項目(1 行スイッチ、fork は差替点で替える)。常設だけが埋める検査は S6
  if (point.required !== undefined && (point.required !== true || point.plugs !== true || point.max !== 1)) problems.push(`${name}: required は plugs で max: 1 の点に true だけ(ちょうど 1 つ)`);
  // 段の閉じた並び(D30、注文 31): stages = 段の名前の並び(項目は export const stage = "<名前>" で 1 つ選ぶ。同じ段の中は <差す側>/<名前> の順)、
  // skeletonStages = 点の持ち主の骨組みだけが使う段(項目は選べない)。plugs の点だけで、order とは一緒に使えない
  if (point.stages !== undefined) {
    const names = Array.isArray(point.stages) ? point.stages : [];
    if (point.plugs !== true || names.length < 2 || !names.every((n) => isString(n) && IDENTIFIER.test(n)) || new Set(names).size !== names.length || point.order !== undefined) {
      problems.push(`${name}: stages は plugs の点の段の名前(識別子・重ならない・2 つ以上)の配列で、order と一緒に使えない`);
    }
  }
  if (point.skeletonStages !== undefined) {
    const stages = Array.isArray(point.stages) ? point.stages : [];
    const names = Array.isArray(point.skeletonStages) ? point.skeletonStages : [];
    if (names.length === 0 || !names.every((n) => stages.includes(n)) || names.length >= stages.length) problems.push(`${name}: skeletonStages は stages の中の名前の配列(項目の選べる段が 1 つは残る)`);
  }
  return problems;
}

/** 結び目の宣言が持てるキー */
const WIRE_KEYS = ["name", "export", "side", "registers"];

/**
 * lib の結び目の宣言 export const wire = { name, export, side, registers? } を確かめる(D31: 一覧と lib に渡す結び目は src/wiring/<lib>.ts)。
 * name = lib の入口("@/lib/<lib>")が出す結び目の作り手。server: name({ <点>: 門番で絞った一覧, … }) の値を export の名前で出す /
 * client: export の名前の部品(子を包む)が name の Provider に { <点>: useGate().plugs(一覧), … } を渡す。registers = 項目の key の字面を鍵に広げる lib の interface(client だけ)
 * @param {LiteralValue} value
 * @returns {string[]}
 */
function checkWire(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${WIRE_NAME} は { name, export, side, registers? } の object`];
  /** @type {{ [key: string]: LiteralValue | undefined }} */
  const wire = value;
  /** @type {string[]} */
  const problems = [];
  for (const key of Object.keys(wire)) if (!WIRE_KEYS.includes(key)) problems.push(`${WIRE_NAME}: 未知のキー ${key}(使えるのは ${WIRE_KEYS.join(" / ")})`);
  if (!isString(wire.name) || !IDENTIFIER.test(wire.name)) problems.push(`${WIRE_NAME}: name は lib の入口が出す結び目の作り手の名前`);
  if (!isString(wire.export) || !IDENTIFIER.test(wire.export)) problems.push(`${WIRE_NAME}: export は src/wiring/<lib>.ts が出す結び目の名前`);
  if (!oneOf(["server", "client"], wire.side)) problems.push(`${WIRE_NAME}: side は server | client`);
  if (wire.registers !== undefined && (!isString(wire.registers) || !IDENTIFIER.test(wire.registers) || wire.side !== "client")) problems.push(`${WIRE_NAME}: registers は client の結び目だけで、lib の interface の名前`);
  return problems;
}

/**
 * 欄から読む変え方の型(change と照らす。段 2 の移し替えの道具もこれで change を書く)
 * @param {PointSpec} point
 * @returns {"add" | "override" | "counterpart" | "replace"}
 */
export function changeOfFields(point) {
  if (point.placement !== undefined) return "counterpart";
  if (point.overrides !== undefined) return "override";
  if (point.default !== undefined) return "replace";
  return "add";
}

/** @param {PointSpec} point */
const fieldsNote = (point) =>
  point.placement !== undefined ? "placement " : point.overrides !== undefined ? "overrides " : point.default !== undefined ? "default " : point.writer !== undefined ? "writer " : "dir・files ";

/** plugs の点(差す側の <ドメイン>/plugs/<点>/ から集める増設点)か */
export const isPlugsPoint = (/** @type {PointSpec} */ spec) => spec.plugs === true;

/**
 * 受け口の点(項目のフォルダ dir か plugs を持ち、pnpm generate extensions が一覧を書く)か。writer の点・overrides の点・placement の点・差替点は違う
 * @param {PointSpec} spec
 */
export const isListPoint = (spec) => spec.writer === undefined && spec.overrides === undefined && spec.placement === undefined && spec.default === undefined;

/**
 * 宣言のファイルを 1 つ読む
 * @param {string} path リポジトリ直下からの相対
 * @param {string} text
 * @returns {{ points: Record<string, PointSpec>, wire?: WireSpec, alwaysOpen?: boolean, problems: string[] }} alwaysOpen = 常設の宣言(export const alwaysOpen = true)
 */
export function readDeclaration(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  /** @type {ts.Expression | null} */
  let initializer = null;
  /** @type {ts.Expression | null} */
  let wireInitializer = null;
  /** @type {ts.Expression | null} */
  let alwaysOpenInitializer = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const declaration of statement.declarationList.declarations) {
      if (exported && ts.isIdentifier(declaration.name) && declaration.name.text === DECLARATION_NAME) initializer = declaration.initializer ?? null;
      if (exported && ts.isIdentifier(declaration.name) && declaration.name.text === WIRE_NAME) wireInitializer = declaration.initializer ?? null;
      if (exported && ts.isIdentifier(declaration.name) && declaration.name.text === ALWAYS_OPEN_NAME) alwaysOpenInitializer = declaration.initializer ?? null;
    }
  }
  // 常設の宣言(リテラルの true だけ。点を持たないドメインは alwaysOpen だけのファイルでよい)
  /** @type {boolean} */
  let alwaysOpen = false;
  if (alwaysOpenInitializer) {
    if (alwaysOpenInitializer.kind !== ts.SyntaxKind.TrueKeyword) return { points: {}, problems: [`${path}: ${ALWAYS_OPEN_NAME} は字面の true だけ(常設でないなら書かない)`] };
    alwaysOpen = true;
  }
  if (!initializer && alwaysOpen) return { points: {}, alwaysOpen, problems: [] };
  if (!initializer) return { points: {}, problems: [`${path}: export const ${DECLARATION_NAME} = { … } が無い`] };
  const read = literalOf(initializer);
  if (read.problem !== undefined) return { points: {}, problems: [`${path}: ${read.problem}`] };
  if (typeof read.value !== "object" || read.value === null || Array.isArray(read.value)) {
    return { points: {}, problems: [`${path}: ${DECLARATION_NAME} は { <点の名前>: { … } } の object`] };
  }
  const declared = read.value;
  const problems = Object.entries(declared).flatMap(([name, point]) => checkPoint(name, point).map((p) => `${path}: ${p}`));
  // itemsOf の先: 同じ宣言の files を持つ plugs の点(itemsOf でない)
  for (const [name, point] of Object.entries(declared)) {
    if (typeof point !== "object" || point === null || Array.isArray(point) || typeof point.itemsOf !== "string") continue;
    const target = declared[point.itemsOf];
    const ok = typeof target === "object" && target !== null && !Array.isArray(target) && target.plugs === true && typeof target.files === "string" && target.itemsOf === undefined;
    if (!ok) problems.push(`${path}: ${name}: itemsOf の ${point.itemsOf} は同じ宣言の files を持つ plugs の点(itemsOf でない)`);
  }
  // 問題が無い = どの点も object(checkPoint が確かめた)
  /** @type {Record<string, PointSpec>} */
  const points = {};
  if (problems.length === 0) for (const [name, point] of Object.entries(declared)) if (typeof point === "object" && point !== null && !Array.isArray(point)) points[name] = point;
  if (!wireInitializer) return { points, alwaysOpen, problems };
  const wireRead = literalOf(wireInitializer);
  if (wireRead.problem !== undefined) return { points, problems: [...problems, `${path}: ${WIRE_NAME}: ${wireRead.problem}`] };
  const wireProblems = checkWire(wireRead.value).map((p) => `${path}: ${p}`);
  if (wireProblems.length > 0) return { points, problems: [...problems, ...wireProblems] };
  return { points, alwaysOpen, wire: /** @type {WireSpec} */ (/** @type {unknown} */ (wireRead.value)), problems };
}

/**
 * 宣言のファイルのパスか(src の下の extensionPoints.ts。生成一覧 extensions/ と node_modules・隠しフォルダの中は除く)
 * @param {string} path
 */
export const isDeclarationPath = (path) =>
  path.startsWith(`${SEARCH_ROOT}/`) &&
  path.endsWith(`/${DECLARATION_NAME}.ts`) &&
  !path.split("/").slice(0, -1).some((seg) => seg === "node_modules" || seg === EXTENSIONS_DIR_NAME || seg.startsWith("."));

/**
 * 宣言のファイルの一覧と読み方から点の一覧を作る(ファイルにも git にも触れない。git の版の木を読む pnpm workflow ownership who も使う)
 * @param {Iterable<string>} files 宣言のファイル(リポジトリ直下からの相対。宣言でないパスは isDeclarationPath で除く)
 * @param {(path: string) => string | null} readText
 * @returns {{ points: { owner: string, name: string, declaredIn: string, spec: PointSpec }[], wires: { owner: string, declaredIn: string, spec: WireSpec }[], alwaysOpen: string[], problems: string[] }}
 *   wires = lib の結び目の宣言(export const wire)/ alwaysOpen = 常設を宣言したドメインのフォルダ(export const alwaysOpen = true)
 */
export function pointsFromFiles(files, readText) {
  /** @type {{ owner: string, name: string, declaredIn: string, spec: PointSpec }[]} */
  const points = [];
  /** @type {{ owner: string, declaredIn: string, spec: WireSpec }[]} */
  const wires = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const alwaysOpen = [];
  for (const path of [...files].filter(isDeclarationPath).sort()) {
    const text = readText(path);
    if (text === null) continue;
    const read = readDeclaration(path, text);
    problems.push(...read.problems);
    if (read.alwaysOpen) {
      if (path.startsWith(DOMAINS_ROOT)) alwaysOpen.push(path.slice(0, path.lastIndexOf("/")));
      else problems.push(`${path}: ${ALWAYS_OPEN_NAME}(常設)を宣言できるのはドメインだけ(lib・枠などは門番を持たず閉じない)`);
    }
    for (const [name, spec] of Object.entries(read.points)) points.push({ owner: path.slice(0, path.lastIndexOf("/")), name, declaredIn: path, spec });
    if (read.wire) wires.push({ owner: path.slice(0, path.lastIndexOf("/")), declaredIn: path, spec: read.wire });
  }
  return { points: points.sort((a, b) => (a.declaredIn + a.name < b.declaredIn + b.name ? -1 : 1)), wires, alwaysOpen, problems };
}

/** 枠の地区の宣言のフォルダ(src/app の下の _layout)。枠の差替点だけは default が src/app の下なら地区の dir の外でも通す(枠の部品はルートの隣にもある、注文 16 Q1) */
const FRAME_OWNER = /^src\/app\/(?:.+\/)?_layout$/;
/** 差替点の既定の出し手 <名前>.default.ts(x)(1 = 素の名前までのパス、2 = 名前、3 = 拡張子) */
const REPLACE_DEFAULT = /^(.*\/([A-Za-z][A-Za-z0-9]*))\.default\.(ts|tsx)$/;

/**
 * 差替点(change: replace)の一覧と、既定の出し手の置き場の問題(1 行スイッチの検査・受け口の一覧・地図が読む)。
 * default は <名前>.default.ts(x) で、宣言した地区の dir の中(枠の地区は src/app の下)。同じ default を 2 つの点が指すのも止める
 * @param {{ owner: string, name: string, declaredIn: string, spec: PointSpec }[]} points 全拡張点
 * @returns {{ replaces: { point: string, owner: string, declaredIn: string, default: string, stem: string, name: string, ext: string }[], problems: string[] }}
 *   stem = 素の名前までのパス(スイッチ = <stem>.ts(x)、fork の置き換え = <stem>.replace.ts(x))
 */
export function replacePointsOf(points) {
  /** @type {{ point: string, owner: string, declaredIn: string, default: string, stem: string, name: string, ext: string }[]} */
  const replaces = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const p of points) {
    if (p.spec.change !== "replace" || typeof p.spec.default !== "string") continue;
    const path = p.spec.default;
    const match = REPLACE_DEFAULT.exec(path);
    if (!match) {
      problems.push(`${p.declaredIn}: 差替点 ${p.name} の default ${path} は <名前>.default.ts(x)(1 行スイッチの既定)`);
      continue;
    }
    const inside = path.startsWith(`${p.owner}/`) || (FRAME_OWNER.test(p.owner) && path.startsWith("src/app/"));
    if (!inside) {
      problems.push(`${p.declaredIn}: 差替点 ${p.name} の default ${path} が宣言した地区(${p.owner})の外(差替点は既定を持つ地区の extensionPoints.ts に書く)`);
      continue;
    }
    const other = seen.get(path);
    if (other) {
      problems.push(`${p.declaredIn}: 差替点 ${p.name} の default ${path} は ${other} と重なる(1 つの既定に差替点は 1 つ)`);
      continue;
    }
    seen.set(path, `${p.declaredIn} の ${p.name}`);
    replaces.push({ point: p.name, owner: p.owner, declaredIn: p.declaredIn, default: path, stem: match[1], name: match[2], ext: match[3] });
  }
  return { replaces: replaces.sort((a, b) => (a.default < b.default ? -1 : 1)), problems };
}
