// src/features/core/analytics/services/server/rollup/types.ts
// 日次ロールアップ（事前集計）フレームワークの型定義。
//
// downstream は RollupMetricConfig を満たす値を
// src/registry/analyticsRollupRegistry.ts に登録するだけで、
// 日次 cron / バックフィル / 読み取りヘルパーの対象になる。

/**
 * compute に渡される「集計対象の1日」のコンテキスト。
 */
export type RollupDayContext = {
  /** 対象日（YYYY-MM-DD、メトリクスのタイムゾーン上のローカル日付） */
  dateKey: string;
  /** 対象日の開始（UTC Date、timezone 上の 00:00:00.000） */
  dateFrom: Date;
  /** 対象日の終了（UTC Date、timezone 上の 23:59:59.999） */
  dateTo: Date;
  /** メトリクスに適用されているタイムゾーン */
  timezone: string;
  /**
   * 前日のロールアップ済み行（存在する場合）。
   *
   * ランニングバランス系（kind=snapshot）の compute が
   * 「前日クロージング値 + 当日差分」の増分計算でバックフィルを O(n) にするための入力。
   * 前日行が無い（未計算・ギャップ）場合は undefined — その場合 compute は
   * ソーステーブルからのフル計算にフォールバックすること。
   */
  previous?: RollupMetricValue[];
};

/**
 * compute が返す1行分の値。
 *
 * dims はメトリクス内のディメンション分割（例: { walletType: "coin" }）。
 * フラットなオブジェクトのみサポート（正規化はトップレベルキーのソートで行うため、
 * ネストした値の内部順序までは正規化されない）。
 * 同一日の戻り値内で dims の正規化キーが重複してはならない（compute 側で集約すること）。
 */
export type RollupMetricValue = {
  value: number;
  dims?: Record<string, unknown>;
};

/**
 * ロールアップメトリクスの定義。
 *
 * kind の意味論（読み取り時の週/月集約と欠損日の扱いが変わる）:
 *  - "flow":     日ごとの発生量（売上、獲得数等）。週/月 = 日の合計、欠損日 = 0
 *  - "snapshot": 日末時点の状態量（残高、在庫等のクロージング値）。
 *                週/月 = バケット末日の値、欠損日 = 直前値のキャリーフォワード
 */
export type RollupMetricConfig = {
  /**
   * メトリクス識別子。テーブルの metric_key としてそのまま格納される。
   * "<domain>.<metric>" 形式の snake/dot 命名を推奨（例: "wallet.closing_balance"）。
   * レジストリ内で一意であること。
   */
  key: string;
  /** メトリクスの意味論（flow=フロー量 / snapshot=状態量） */
  kind: "flow" | "snapshot";
  /**
   * 1日分の値を計算する。ソーステーブルへの読み取りクエリのみを行うこと。
   * 集計除外（analytics exclusion 等）の適用はこの関数内部の責務。
   * ディメンション無しなら要素1の配列を返す。
   */
  compute: (day: RollupDayContext) => Promise<RollupMetricValue[]>;
  /**
   * バックフィル可能な最古日（YYYY-MM-DD）。
   * ソースデータの開始日を指定する。バックフィルの既定開始日になり、
   * 日次 cron のルックバックもこの日より前へは遡らない。
   */
  backfillFrom?: string;
  /** バケット境界のタイムゾーン（省略時 DEFAULT_TIMEZONE） */
  timezone?: string;
};

/** runDailyRollup の実行結果（メトリクス単位） */
export type RollupRunMetricResult = {
  metricKey: string;
  /** 計算した日付キー */
  days: string[];
  /** upsert した行数（全日合計） */
  rows: number;
};

/** readRolledDailySeries の戻り値 */
export type RolledDailySeriesResponse = {
  dateFrom: string;
  dateTo: string;
  granularity: "day" | "week" | "month";
  history: { date: string; value: number }[];
  /** 末尾バケットが当日ライブ計算を含むか（キャッシュTTL判断等の参考情報） */
  includesLiveBucket: boolean;
};
