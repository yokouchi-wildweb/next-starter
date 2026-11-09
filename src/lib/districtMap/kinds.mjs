// src/lib/districtMap/kinds.mjs
// 地区(district)の 4 種と、それぞれの見つけ方・config の置き場・上書きの置き場の決まり(目録 D6・D9・D11)。
// 種類は 4 つに閉じる(中間の Tier が種類を足す口は無い、目録 D15)。足りなければ /order で Tier1 が足す。

/** 地区の種類。並び = district-map.jsonl の並び(種類 → 名前) */
export const DISTRICT_KINDS = /** @type {const} */ (["features", "lib", "frame", "proxies"]);

/** features の地区を探すフォルダ(直下の _ 始まりでないフォルダ = 1 地区、目録 D3) */
export const FEATURES_ROOT = "src/features";
/** core の地区を探すフォルダ(FEATURES_ROOT の直下の core は地区でなく core の置き場) */
export const CORE_DIR_NAME = "core";
/** lib の地区を探すフォルダ(直下のフォルダ = 1 地区)。見つけ方の決まりは src/lib/libPackage の listLibsFrom(L1.14) */
export { LIB_DIR as LIB_ROOT } from "../libPackage/index.mjs";
/** proxies の地区(全体で 1 つ、設定 D36) */
export const PROXIES_DIR = "src/proxies";
export const PROXIES_NAME = "proxies";
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
export const OVERRIDE_FOLDERS = /** @type {const} */ ({ features: "features", lib: "lib", frame: "layout", proxies: "proxies" });
/**
 * 基盤の上書きのフォルダ(src 直下の基盤の名前 → 持ち主のフォルダ、設定 D91)。地区でない(地図に載らない)。
 * 中は平らに <中身の名前>.config.ts を並べ(例 featureGate/switches.config.ts)、持ち主は固定のフォルダ。読むのは持ち主のフォルダの中のファイルだけ
 */
export const BASE_OVERRIDE_FOLDERS = /** @type {const} */ ({ featureGate: "src/featureGate" });

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

/** 集約ファイル(人・agent・/ship と /flux の差分用。src から import しない、他の生成の入力にしない、目録 D12) */
export const DISTRICT_MAP_FILE = "src/registry/district-map.jsonl";

/**
 * 地区の上書きファイルのパス
 * @param {(typeof DISTRICT_KINDS)[number]} kind
 * @param {string} name
 */
export const overridePathOf = (kind, name) => `${OVERRIDE_ROOT}/${OVERRIDE_FOLDERS[kind]}/${name}.config.ts`;

/**
 * 地区の描画専用の上書きファイルのパス(src/config/<種類のフォルダ>/<名前>.ui.config.ts、設定 D38)
 * @param {(typeof DISTRICT_KINDS)[number]} kind
 * @param {string} name
 */
export const uiOverridePathOf = (kind, name) => `${OVERRIDE_ROOT}/${OVERRIDE_FOLDERS[kind]}/${name}.ui.config.ts`;
