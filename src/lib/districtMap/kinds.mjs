// src/lib/districtMap/kinds.mjs
// 地区(district)の種類の表(地区の議会 D8・D9・D22)と、それぞれの見つけ方・config の置き場・上書きの置き場の決まり(目録 D6・D9・D11)。
// 種類は 7 つに閉じる(中間の Tier が種類を足す口は無い、目録 D15)。足りなければ /order で Tier1 が足す。

/**
 * 地区の種類の表(決まりは種類ごとの属性で 1 か所に持つ、D8)。並び = district-map.jsonl の並び(種類 → 名前)
 * - hasGate: ゲートを持つか(門番が開け閉めするのはドメインだけ、D12・D22)
 * - readsSet: 地区の一覧(生成された一覧・地区の集合)を読む種類か。false の種類はドメインを読まず渡してもらう(D22)
 * - addedBy: 誰がこの種類の地区を足せるか("any" = どの Tier も / "tier1" = Tier1 だけ、src 直下に平らの 1 地区、D8・D9)
 * - forkMay: この種類の地区に fork ができる変え方(CHANGE_TYPES の名前。点ごとの宣言は各地区の extensionPoints.ts、段 2 で 2 段に揃える)
 * - override: src/config の上書きの置き場(folder = src/config の下のフォルダ、shape "named" = <地区の名前>.config.ts /
 *   "contents" = <中身の名前>.config.ts を平らに並べ持ち主は地区の dir に固定 / null = 上書きを持たない)
 * - dir: src 直下の 1 地区の種類のフォルダ(見つけ方が木を歩く種類は null)
 * 種類の点(この種類の地区が全部持つ点、宣言 2 段の 2 段目 D35)は KIND_POINTS(override から導く)。地区だけの点は地区の extensionPoints.ts
 * @type {readonly { kind: string, hasGate: boolean, readsSet: boolean, addedBy: "any" | "tier1", forkMay: readonly string[], override: { folder: string, shape: "named" | "contents" } | null, dir: string | null }[]}
 */
export const KINDS = Object.freeze([
  { kind: "domains", hasGate: true, readsSet: false, addedBy: "any", forkMay: ["replace", "override", "add", "counterpart"], override: { folder: "domains", shape: "named" }, dir: null },
  { kind: "lib", hasGate: false, readsSet: false, addedBy: "any", forkMay: ["replace", "override", "add", "counterpart"], override: { folder: "lib", shape: "named" }, dir: null },
  { kind: "frame", hasGate: false, readsSet: false, addedBy: "any", forkMay: ["replace", "override", "add", "counterpart"], override: { folder: "layout", shape: "named" }, dir: null },
  { kind: "featureGate", hasGate: false, readsSet: true, addedBy: "tier1", forkMay: ["add", "counterpart"], override: { folder: "featureGate", shape: "contents" }, dir: "src/featureGate" },
  { kind: "registry", hasGate: false, readsSet: true, addedBy: "tier1", forkMay: [], override: null, dir: "src/registry" },
  { kind: "wiring", hasGate: false, readsSet: true, addedBy: "tier1", forkMay: ["add"], override: null, dir: "src/wiring" },
  { kind: "proxies", hasGate: false, readsSet: false, addedBy: "tier1", forkMay: ["add"], override: null, dir: "src/proxies" },
]);

/** 地区の種類。並び = district-map.jsonl の並び(種類 → 名前) */
export const DISTRICT_KINDS = /** @type {const} */ (["domains", "lib", "frame", "featureGate", "registry", "wiring", "proxies"]);
/** 種類の行 */
export const kindOf = (/** @type {string} */ kind) => KINDS.find((k) => k.kind === kind) ?? null;
/**
 * 種類の点(宣言 2 段の 2 段目、D35 (ii)): この種類の地区は全部この点を持つ。地区の地図の forkCan に地区の宣言の点と合わせて載る
 * - config: 地区の config.ts ↔ src/config の上書き(対置点。地区の名前で置く種類は config.ts がある地区だけ、中身の名前で置く種類は持ち主の地区の中身ごと)
 * - configUi: 描画専用の config.ui.ts ↔ <名前>.ui.config.ts(対置点。config.ui.ts がある地区だけ)
 * - layout(枠の種類だけ): ルートの layout.tsx の 1 行スイッチ(差替点。_layout の隣の layout.tsx が ./_layout/ を指す枠だけ。向け先を _components/ に替える)
 * 1 行スイッチ(.default)の差替点は持ち主の地区の extensionPoints.ts に書く(宣言 2 段の 1 段目)。ルートの page.tsx の 1 行スイッチは地区と 1 対 1 でないので
 * 種類の点にせず、受け口の一覧の読み手(./intakeRows.mjs)がルートの一覧を入力に取る(注文 16 Q3)
 * @param {string} kind
 * @returns {{ point: string, change: "counterpart" | "replace", when: "config" | "configUi" | "always" | "layoutSwitch", where: (district: { name: string, dir: string }) => string }[]}
 */
export function kindPointsOf(kind) {
  const k = KINDS.find((x) => x.kind === kind);
  if (!k) return [];
  /** @type {{ point: string, change: "counterpart" | "replace", when: "config" | "configUi" | "always" | "layoutSwitch", where: (district: { name: string, dir: string }) => string }[]} */
  const points = [];
  if (k.override) {
    const folder = `${OVERRIDE_ROOT}/${k.override.folder}`;
    if (k.override.shape === "contents") points.push({ point: "config", change: "counterpart", when: "always", where: () => `${folder}/*.config.ts` });
    else {
      points.push({ point: "config", change: "counterpart", when: "config", where: (d) => `${folder}/${d.name}.config.ts` });
      points.push({ point: "configUi", change: "counterpart", when: "configUi", where: (d) => `${folder}/${d.name}.ui.config.ts` });
    }
  }
  if (kind === "frame") points.push({ point: "layout", change: "replace", when: "layoutSwitch", where: (d) => `${d.dir.slice(0, d.dir.lastIndexOf("/"))}/layout.tsx` });
  return points;
}

/** 枠の layout.tsx が 1 行スイッチか(./_layout/ の部品を default として re-export する 1 文。見分けの正本は src/lib/screens の parseSwitchLayout、ここは地図の forkCan の字面の目安) */
export const isFrameLayoutSwitch = (/** @type {string} */ text) => /^\s*export\s*\{\s*\w+\s+as\s+default\s*\}\s*from\s*["']\.\/_layout\/[^"']+["']\s*;?\s*$/.test(text.replace(/^\s*\/\/.*$/gm, ""));

/** src 直下の 1 地区の種類(dir を持つ行) */
export const SINGLE_DIR_KINDS = KINDS.filter((k) => k.dir !== null);

/** domains の地区を探すフォルダ(直下の _ 始まりでないフォルダ = 1 地区、目録 D3) */
export const DOMAINS_ROOT = "src/domains";
/** core の地区を探すフォルダ(DOMAINS_ROOT の直下の core は地区でなく core の置き場) */
export const CORE_DIR_NAME = "core";
/** lib の地区を探すフォルダ(直下のフォルダ = 1 地区)。見つけ方の決まりは src/lib/libPackage の listLibsFrom(L1.14) */
export { LIB_DIR as LIB_ROOT } from "../libPackage/index.mjs";
/** 枠の地区を探す木。_layout/config.ts の frame: "<名前>" が 1 地区(設定 D75)。宣言の無い _layout は地区にならない */
export const APP_ROOT = "src/app";
export const LAYOUT_DIR_NAME = "_layout";
export const FRAME_KEY = "frame";

/** 地区の config(既定値と型)のファイル名。地区の dir の直下 */
export const CONFIG_FILE = "config.ts";
/** 地区の描画専用の config(アイコン・部品など、設定 D38)のファイル名。地区の dir の直下。持つ地区だけ */
export const UI_CONFIG_FILE = "config.ui.ts";
/** 上書きの置き場(src/config/<種類のフォルダ>/<名前>.config.ts、設定 D11・D36・D75) */
export const OVERRIDE_ROOT = "src/config";
/** 地区の名前で置く上書きのフォルダ(種類 → src/config の下のフォルダ。種類の表の override.shape "named") */
export const OVERRIDE_FOLDERS = Object.freeze(Object.fromEntries(KINDS.flatMap((k) => (k.override?.shape === "named" ? [[k.kind, k.override.folder]] : []))));
/**
 * 中身の名前で置く上書きのフォルダ(src/config の下のフォルダ → 持ち主の地区の dir。種類の表の override.shape "contents"、設定 D91)。
 * 中は平らに <中身の名前>.config.ts を並べ(例 featureGate/switches.config.ts)、持ち主は固定のフォルダ。読むのは持ち主のフォルダの中のファイルだけ
 */
export const CONTENTS_OVERRIDE_FOLDERS = Object.freeze(Object.fromEntries(KINDS.flatMap((k) => (k.override?.shape === "contents" && k.dir !== null ? [[k.override.folder, k.dir]] : []))));

/** ドメインの生成の入力(地区の dir の直下)。有無と generate を地図に載せる(L1.15) */
export const DOMAIN_JSON_FILE = "domain.json";
/** ドメインの登録(汎用 API・表のキーと requires)の置き場(地区の dir からの相対) */
export const DOMAIN_ENTRY_FILE = "services/server/domainEntry.ts";
/** 門の規則の置き場(1 ファイル 1 規則、名前 = ファイル名) */
export const GATE_RULES_DIR = "src/featureGate/rules";
/** 受け口の宣言のファイル名 */
export const RECEPTACLE_FILE = "extensionPoints.ts";
/** 地区の中を歩くときに入らないフォルダ(生成の一覧・依存・隠し) */
export const SKIP_DIRS = ["node_modules", "extensions"];

/** 集約ファイル(人・agent・/sluice と /flux の差分用。src から import しない、他の生成の入力にしない、目録 D12) */
export const DISTRICT_MAP_FILE = "src/registry/district-map.jsonl";

/**
 * 地区の上書きファイルのパス
 * @param {(typeof DISTRICT_KINDS)[number]} kind
 * @param {string} name
 */
export const overridePathOf = (kind, name) => (OVERRIDE_FOLDERS[kind] ? `${OVERRIDE_ROOT}/${OVERRIDE_FOLDERS[kind]}/${name}.config.ts` : null);

/**
 * 地区の描画専用の上書きファイルのパス(src/config/<種類のフォルダ>/<名前>.ui.config.ts、設定 D38)
 * @param {(typeof DISTRICT_KINDS)[number]} kind
 * @param {string} name
 */
export const uiOverridePathOf = (kind, name) => (OVERRIDE_FOLDERS[kind] ? `${OVERRIDE_ROOT}/${OVERRIDE_FOLDERS[kind]}/${name}.ui.config.ts` : null);
