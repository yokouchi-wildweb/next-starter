// src/lib/gradient/types.ts
// グラデーショントークン / カラー値モデルの型定義（純粋TS・Reactに依存しない）

/**
 * グラデーションの色ストップ。
 * CSS color 値であれば何でも可（oklch / hsl / hex / rgb いずれも）。
 */
export type GradientStop = string;

/**
 * グラデーショントークンの「登録（authoring）」形。
 * upstream の BASE_GRADIENTS / downstream の config / registerGradients() で使う入力型。
 */
export type GradientTokenInput = {
  /** 一意キー（kebab/camel いずれも可、CSSユーティリティ名 bg-gradient-<key> になる） */
  key: string;
  /** 表示ラベル（ピッカー等で使用） */
  label: string;
  /** 色ストップ（2色以上） */
  stops: GradientStop[];
  /** 分類グループ（ピッカーの見出し・CSS生成のグループ分けに使用） */
  group?: string;
  /** ダークモード用の色ストップ（省略時はライトと共通） */
  darkStops?: GradientStop[];
  /** text-gradient-<key> ユーティリティも生成するか（既定 false） */
  text?: boolean;
  /** inline cssValue を算出するデフォルト角度（deg, 既定 DEFAULT_GRADIENT_ANGLE） */
  angle?: number;
};

/**
 * グラデーショントークンの「確定（consumed）」形。
 * listGradients() / getGradient() が返す。cssValue は inline style にそのまま使える。
 */
export type GradientToken = {
  key: string;
  label: string;
  stops: GradientStop[];
  group?: string;
  /** 既定角度で算出済みの ready-to-use CSS（例: "linear-gradient(135deg, ...)"） */
  cssValue: string;
};

/**
 * カラー値モデル（default / solid / gradient の3モード判別共用体）。
 * - default: 意味は消費側が注入（resolveDefault）。テーマ既定色・親からの継承など。
 * - solid: 単色（hex 等の生CSS文字列）。
 * - gradient: 名前付きグラデーションのキー参照。
 *
 * NOTE: 将来 angle / 任意 stops 拡張の余地を残すため判別共用体にしている。
 */
export type ColorValue =
  | { mode: "default" }
  | { mode: "solid"; solid: string }
  | { mode: "gradient"; gradientKey: string };

/** ColorValue のモード種別 */
export type ColorMode = ColorValue["mode"];

/**
 * resolveColorValue のコンテキスト。
 * "default" の意味はドメイン非依存に保つため消費側が注入する。
 */
export type ResolveColorContext = {
  /** "default" モード時に返す最終CSS（未指定なら空文字） */
  resolveDefault?: () => string;
};
