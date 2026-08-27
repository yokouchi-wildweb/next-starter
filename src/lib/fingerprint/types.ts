// src/lib/fingerprint/types.ts
//
// ブラウザフィンガープリント収集ライブラリの型定義。
// このライブラリはドメイン非依存（DB / HTTP を持たない）。蓄積・照合は
// features/core/deviceFingerprint、チャレンジは features/core/fingerprintChallenge が担う。

/** 収集フォーマットのバージョン。互換性が壊れる変更時にインクリメント */
export const FINGERPRINT_SIGNALS_VERSION = 1;

/** 行動計測 payload のバージョン */
export const BEHAVIOR_PAYLOAD_VERSION = 1;

/**
 * ブラウザから収集したデバイス信号（正規化前の生値）。
 * 各成分は個別 try-catch で収集され、取得できない環境では null になる
 * （全体が失敗することはない = fail-soft）。
 */
export type DeviceSignals = {
  version: typeof FINGERPRINT_SIGNALS_VERSION;
  /** Canvas 2D 描画結果のハッシュ（GPU / ドライバ / フォントレンダリングの個体差） */
  canvas: string | null;
  /** WebGL の実体情報。renderer / vendor は人間可読の生値も保持する */
  webgl: {
    vendor: string | null;
    renderer: string | null;
    /** 主要 WebGL パラメータ群のハッシュ */
    paramsHash: string | null;
  } | null;
  /** OfflineAudioContext 出力波形のハッシュ */
  audio: string | null;
  /** テキスト幅測定で検出したインストール済みフォント名 */
  fonts: string[] | null;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    /** devicePixelRatio */
    dpr: number;
  } | null;
  /** IANA タイムゾーン名（例: "Asia/Tokyo"） */
  timezone: string | null;
  /** navigator.languages */
  languages: string[] | null;
  /** navigator.platform（非推奨 API だが取得できる間はエントロピー源として有用） */
  platform: string | null;
  hardware: {
    concurrency: number | null;
    /** navigator.deviceMemory (GB)。Chromium のみ */
    memory: number | null;
    touchPoints: number | null;
  } | null;
  /** User-Agent Client Hints（Chromium のみ、getHighEntropyValues） */
  uaData: {
    brands: string[] | null;
    platform: string | null;
    platformVersion: string | null;
    architecture: string | null;
    model: string | null;
    bitness: string | null;
  } | null;
  /** メディアコーデック対応表（canPlayType / isTypeSupported の結果） */
  codecs: Record<string, string | boolean> | null;
  /** Math 関数の丸め癖ハッシュ（JS エンジン / CPU の個体差） */
  math: string | null;
};

/**
 * 検索軸となる成分別ハッシュ。deviceFingerprint 側で個別カラムに展開される。
 * キー集合はサーバー側の照合 SQL と対応しているため、変更時は
 * deviceFingerprint の entities / similarity も同時に更新すること。
 */
export type FingerprintComponentHashes = {
  canvas: string | null;
  webgl: string | null;
  audio: string | null;
  fonts: string | null;
  /** "1920x1080x24@2" 形式（ハッシュではなく可読キー） */
  screen: string | null;
  timezone: string | null;
  /** languages を join した可読キー */
  languages: string | null;
  platform: string | null;
  /** "c8/m8/t0" 形式（concurrency / memory / touchPoints） */
  hardware: string | null;
};

/** ingest API へ送る形。deviceFingerprint の Zod スキーマと対応 */
export type FingerprintPayload = {
  version: typeof FINGERPRINT_SIGNALS_VERSION;
  componentHashes: FingerprintComponentHashes;
  /** 人間可読の WebGL renderer（管理画面での目視確認用） */
  webglRenderer: string | null;
  /** 正規化前の生信号（サーバー側でサイズ上限あり） */
  rawSignals: DeviceSignals;
};

/** フィールド単位の行動統計。キー内容・入力値は一切含まない（構造的に保証） */
export type FieldBehavior = {
  /** 打鍵数（printable / 制御キー含む総数） */
  keyCount: number;
  /** Backspace / Delete の回数 */
  backspaceCount: number;
  /** 打鍵間隔の平均 (ms)。打鍵 2 回未満なら null */
  meanKeyIntervalMs: number | null;
  /** 打鍵間隔の標準偏差 (ms) */
  stdKeyIntervalMs: number | null;
  /** ペースト回数 */
  pasteCount: number;
  /** ペーストされた文字数の合計（内容は記録しない） */
  pasteTotalLength: number;
  /** フォーカスされた回数 */
  focusCount: number;
  /** フォーカス滞在時間の合計 (ms) */
  dwellMs: number;
};

/** マウス / タッチ軌跡のサマリー統計（生座標列は保持しない） */
export type PointerBehavior = {
  /** サンプリングした移動イベント数 */
  sampleCount: number;
  /** 総移動距離 (px) */
  totalDistance: number;
  /** 平均速度 (px/s) */
  meanSpeed: number | null;
  /** 速度の標準偏差 (px/s)。bot は分散が極端に小さい傾向 */
  stdSpeed: number | null;
  /** 直線度 = 直線距離 / 経路長 (0-1)。1 に近いほど直線的 */
  straightness: number | null;
  /** pointerType 別のイベント数 */
  byType: Record<string, number>;
};

/**
 * useBehavioralCapture が生成する行動計測 payload。
 *
 * プライバシー上の不変条件（このライブラリが構造的に保証する）:
 * - キーの内容（どの文字を打ったか）は記録しない。Backspace/Delete の判別のみ
 * - 入力値・ペースト内容は記録しない（長さのみ）
 * - 生の座標列は保持せず統計値のみ
 */
export type BehaviorPayload = {
  version: typeof BEHAVIOR_PAYLOAD_VERSION;
  /** 計測開始（マウント / reset）から payload 生成までの経過 (ms) */
  durationMs: number;
  /** フィールド名（name / id / data-behavior-field）→ 行動統計 */
  fields: Record<string, FieldBehavior>;
  /** フォーカス遷移順（フィールド名の列、上限あり） */
  focusOrder: string[];
  pointer: PointerBehavior;
  /** 計測中にタブが非表示になった回数（他画面参照の推定材料） */
  visibilityHiddenCount: number;
};
