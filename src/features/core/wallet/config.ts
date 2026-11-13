// src/features/core/wallet/config.ts
// ウォレットの設定(既定 + 上書き、設定の議会 D11・D19・D95)。上書きは src/config/features/wallet.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。呼び手は walletConfig.<鍵> を読む(古い定数名の対応: ./README.md「設定」)。
// 通貨を足す fork は上書きで `export type Extra = { currency: { <walletType>: CurrencyConfig } }` を宣言して値を書く(WalletType に入る)。足した欄・リテラル型は Extra の型ごと残る(例 `CurrencyConfig & { isTicket: true }`、./README.md「設定ファイル」)。
// [!!] 通貨の設定の変更後は必ずマイグレーションが必要(walletType は DB の値)
// 機能の入切(wallet.enabled)は門番の規則 src/featureGate/rules/wallet.ts の持ち物で、ここには無い

import override, { type Extra } from "@/config/features/wallet.config";
import type { FeatureRequirement } from "@/featureGate";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

import type { CurrencyConfig } from "./types/currency";

/**
 * ウォレット購入制限モード
 * - none: 制限なし
 * - phoneVerified: SMS認証済みユーザーのみ購入可能
 */
export type WalletPurchaseRestriction = "none" | "phoneVerified";

/**
 * 失効予告の1段（「何日前に」送るか）。経路は連絡の種類が決める(D86。上流 = 種類 walletExpiring の email・inApp、
 * 変えるなら種類の override src/features/core/messaging/categories/walletExpiring.override.ts の channels)。
 * 文面は連絡の定義 src/features/core/wallet/messages/expiringNotice.ts(変えるなら隣に expiringNotice.override.ts。
 * 段ごとに変えたいときは {{daysBefore}} を使う)
 */
export type WalletPreExpiryNoticeStage = {
  /** 失効の何日前に送るか（1以上の整数。同一通貨内で重複不可） */
  daysBefore: number;
  /**
   * 送る連絡の鍵(省略 = 上流の wallet.expiringNotice)。通貨・段ごとに経路を変えたい fork は、自分の種類(= 自分の経路)の
   * 連絡を足してここで向ける(vars は wallet.expiringNotice と同じ物を受けること)
   */
  messageKey?: string;
};

/** 失効時の本通知(文面は連絡の定義 messages/expiredNotice.ts、経路は種類 walletExpired) */
export type WalletExpiredNotice = {
  /** 送る連絡の鍵(省略 = 上流の wallet.expiredNotice。vars は同じ物を受けること) */
  messageKey?: string;
};

export type WalletExpirationNoticeConfig = {
  /**
   * 失効予告。空配列 = 予告なし。複数段（例: 30日前と7日前）を並べられる。
   * sweepEnabled: true の通貨でのみ送信される（没収しないのに「失効します」と告げないため）。
   */
  preExpiry: WalletPreExpiryNoticeStage[];
  /** 失効時（没収後）の本通知。null = 本通知なし */
  expired: WalletExpiredNotice | null;
};

/**
 * 失効日の数え方。
 * - "grant": 付与ごとに「付与時刻 + expirationDays」で失効する（古い付与から順に失効）
 * - "lastActivity": 最後の残高変更から expirationDays の間、残高の変更が無ければ残高全額が失効する
 *   （付与・消費・SET のたびに残っている全額の失効日が「その時刻 + expirationDays」に延びる。
 *   予約・予約解除と失効スイープ自身の没収は残高変更に数えない）
 */
export type WalletExpirationBasis = "grant" | "lastActivity";

/**
 * 通貨種別ごとの有効期限設定
 */
export type WalletExpirationConfig = {
  /**
   * 失効までの日数（数え始めは expirationBasis による）。
   * null = この通貨は有効期限なし（ロット管理そのものが無効）
   */
  expirationDays: number | null;
  /**
   * 失効日の数え方。省略 = "grant"（付与ごと）。
   * 運用中の通貨で切り替える場合は README「有効期限（ロット管理）」の「数え方」を参照。
   */
  expirationBasis?: WalletExpirationBasis;
  /**
   * 失効スイープ（実際の残高没収）を実行するか。
   * false にすると、ロット記録と失効間近照会は動くが没収は行われない
   * （告知期間中だけ記録を先行させたい場合に使用）。
   * expirationDays が null の場合は無意味。
   */
  sweepEnabled: boolean;
  /**
   * 失効通知の設定。省略 = 予告も本通知も送らない。
   * 送信は wallet-expiration-notice cron が行う（スケジューラ登録が必要）。
   */
  notice?: WalletExpirationNoticeConfig;
};

/**
 * 通貨設定マップ
 * キー = walletType（DB値）
 *
 * 設定項目:
 * - slug: URLパス用（例: /wallet/coin）
 * - label: 表示名
 * - unit: 単位（例: "pt", "コイン"）
 * - color: テーマカラー（HEX）
 * - packages: 購入パッケージ一覧
 * - metaFields: 管理画面での補足入力フィールド
 */
const currency = {
  regular_coin: {
    slug: "coin",
    label: "コイン",
    unit: "コイン",
    color: "#F59E0B", // amber-500
    // maxHoldingAmount: 150_000,  // 保有上限を設けたい場合に有効化 (balance >= この値で追加購入をブロック)
    packages: [
      { amount: 500, price: 500 },
      { amount: 1000, price: 1000 },
      { amount: 2000, price: 2000 },
      { amount: 3000, price: 2940, bonus: "2%お得" },
      { amount: 4000, price: 3840, bonus: "4%お得" },
      { amount: 5000, price: 4700, bonus: "6%お得" },
      { amount: 10000, price: 8800, bonus: "12%お得" },
    ],
    metaFields: [
      {
        name: "productId",
        label: "商品ID",
        formInput: "textInput",
        placeholder: "例: ITEM-001",
        description: "対象の商品・アイテムなどがあれば入力してください。",
      },
      {
        name: "orderId",
        label: "注文ID",
        formInput: "textInput",
        placeholder: "例: ORDER-2024-0001",
      },
      {
        name: "notes",
        label: "管理者用詳細メモ",
        formInput: "textarea",
        placeholder: "社内メモや共有事項",
        rows: 2,
      },
    ],
  },
  regular_point: {
    slug: "point",
    label: "ポイント",
    unit: "pt",
    color: "#3B82F6", // blue-500
    packages: [
      { amount: 100, price: 100 },
      { amount: 500, price: 500 },
      { amount: 1000, price: 1000 },
      { amount: 3000, price: 3000 },
      { amount: 5000, price: 5000 },
    ],
    metaFields: [
    ],
  },
  // temporary_point: {
  //   slug: "temporary-point",
  //   label: "期間限定ポイント",
  //   unit: "pt",
  //   color: "#EC4899", // pink-500
  //   packages: [
  //     { amount: 100, price: 80, bonus: "20%お得" },
  //     { amount: 500, price: 400, bonus: "20%お得" },
  //     { amount: 1000, price: 800, bonus: "20%お得" },
  //   ],
  //   metaFields: [
  //   ],
  // },
} satisfies Record<string, CurrencyConfig>;

/** 上流の既定の形(通貨の値は CurrencyConfig に広げる: fork が値を変えられるように) */
export type WalletConfig = {
  /** 管理者による残高調整ボタンを有効にする */
  enableAdminBalanceAdjust: boolean;
  /** 購入制限モード */
  purchaseRestriction: WalletPurchaseRestriction;
  /**
   * 通貨購入の一時停止設定
   * enabled: true かつスケジュール期間内の場合、全通貨の購入を停止する
   * start/end が null の場合は制限なし（enabled: true + 両方 null = 無期限停止）
   */
  purchaseSuspension: {
    enabled: boolean;
    /** 開始・終了時刻（ISO8601形式）例: '2025-06-01T00:00:00+09:00' */
    schedule: { start: string | null; end: string | null };
    /** 停止中に表示するメッセージ（nullでデフォルトメッセージを使用） */
    message: string | null;
  };
  /** 管理者による残高変更時にユーザーへ通知を送信する（操作タイプ別） */
  notifyOnAdjust: { increment: boolean; decrement: boolean; set: boolean };
  /** 通貨設定マップ(キー = walletType、DB の値) */
  currency: { [K in keyof typeof currency]: CurrencyConfig };
  /** 通貨種別ごとの有効期限設定(キー = walletType。書かない通貨は有効期限なし) */
  expiration: Record<string, WalletExpirationConfig>;
  /** 失効通知の全体設定（通貨によらない） */
  expirationNoticeSettings: { targetStatuses: readonly string[]; sendConcurrency: number; dateTimeZone: string };
  /** 消費し尽くしたロット（remaining = 0）を物理削除するまでの保持日数 */
  lotPruneRetentionDays: number;
  /**
   * 管理者による残高変更通知の値の表示(文面は連絡の定義 messages/adjustmentNotice.ts。
   * 送り手: services/server/notification/sendAdjustmentNotification.ts)
   */
  adjustmentNotification: {
    /** 操作方法の表示ラベル(文面の {{methodLabel}}) */
    changeMethodLabels: Readonly<Record<string, string>>;
  };
};

const defaults: WalletConfig = {
  enableAdminBalanceAdjust: false,
  purchaseRestriction: "none",
  purchaseSuspension: {
    enabled: false,
    schedule: { start: null, end: null },
    message: null,
  },
  notifyOnAdjust: {
    increment: false,
    decrement: false,
    set: false,
  },
  currency,
  /**
   * ウォレット有効期限設定マップ
   * キー = walletType（currency.config.ts と同一キー）
   *
   * ダウンストリームでの有効化例:
   *   regular_coin: { expirationDays: 180, sweepEnabled: true },
   *
   * 「最後の残高変更から180日」で数える例:
   *   regular_point: { expirationDays: 180, expirationBasis: "lastActivity", sweepEnabled: true },
   *
   * 通知も送る例（30日前と7日前と失効時。経路は連絡の種類 walletExpiring・walletExpired が決める）:
   *   regular_coin: {
   *     expirationDays: 180,
   *     sweepEnabled: true,
   *     notice: {
   *       preExpiry: [{ daysBefore: 30 }, { daysBefore: 7 }],
   *       expired: {},
   *     },
   *   },
   *   30日前だけメールにしたいなど段ごとに経路を変えるなら、その経路の種類と連絡を fork が足して
   *   { daysBefore: 30, messageKey: "<自分のドメイン>.<名前>" } と向ける
   *   (文面は連絡の定義 messages/expiringNotice.ts・expiredNotice.ts。変えるなら隣の <名前>.override.ts)
   */
  expiration: {
    regular_coin: { expirationDays: null, sweepEnabled: false },
    regular_point: { expirationDays: null, sweepEnabled: false },
  },
  /**
   * 失効通知の全体設定（通貨によらない）
   */
  expirationNoticeSettings: {
    /**
     * 通知を送るユーザーステータス。ここに無いステータス（退会・停止・仮登録など）には送らない。
     * 語彙は users.status と同じ。
     */
    targetStatuses: ["active", "inactive"] as readonly string[],
    /**
     * 同時に送信する件数。1 = 1件ずつ順番に送る。
     * 1件の送信には1秒弱かかる（メール基盤への通信 + 記録の書き込み）ため、1 では1回の実行で
     * 送れるのが数百件にとどまる。メール基盤の流量制限と DB 接続数に収まる範囲で調整する。
     * 件数の目安: src/features/core/wallet/README.md「送信量の目安」
     */
    sendConcurrency: 5,
    /** 文面の日付（{{expiresOn}} / {{expiredOn}}）を表示するタイムゾーン */
    dateTimeZone: "Asia/Tokyo",
  },
  /**
   * 消費し尽くしたロット（remaining = 0）を物理削除するまでの保持日数。
   * ロットは会計上の現在状態であり、履歴は wallet_histories が持つため長期保持は不要。
   * 付与頻度が高いプロジェクトでは wallet_lots の肥大化を防ぐため
   * wallet-lots-prune cron（日次推奨）とセットで運用する。
   */
  lotPruneRetentionDays: 30,
  adjustmentNotification: {
    /** 操作方法の表示ラベル(文面の {{methodLabel}}) */
    changeMethodLabels: {
      INCREMENT: "増加",
      DECREMENT: "減少",
      SET: "残高設定",
    } as Readonly<Record<string, string>>,
  },
};

/**
 * 機能を要する値(設定 D107・D110、門 build の pnpm check proxies が見る): 購入に SMS 認証を求めるなら機能 phoneVerification が開いていること。
 * 必須にしたい fork は上書きに purchaseRestriction: "phoneVerified" と書き、pnpm ops features set phoneVerification on
 */
export const featureRequirements = [
  { key: "purchaseRestriction", feature: "phoneVerification", off: "none" },
] as const satisfies readonly FeatureRequirement[];

export const walletConfigDef = defineConfig<WalletConfig>(defaults, { label: "wallet" });

/** 上書きのファイルの型(`export default { ... } satisfies WalletOverride<Extra>`) */
export type WalletOverride<E extends object = Record<never, never>> = OverrideOf<typeof walletConfigDef, E>;

/** 合成済みの設定(上流の値 + 上書き、通貨は Extra で足した分も入る) */
export const walletConfig = walletConfigDef.compose<Extra>(override);

/** ウォレット種別の型(通貨設定のキー。上流 + 上書きの Extra) */
export type WalletType = keyof typeof walletConfig.currency & string;
