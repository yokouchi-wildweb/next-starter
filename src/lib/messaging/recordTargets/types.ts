// src/lib/messaging/recordTargets/types.ts
//
// 記録の宛先(recordTargets、D190・D195・D204)の型。管理一覧で選んだ記録 → 宛先の利用者(と記録から埋める値)を解く項目。
// 項目は持ち主のドメインの <domain>/recordTargets/<名前>.ts に export const recordTarget で置き、pnpm generate registry が
// 生成の一覧 src/registry/recordTargetRegistry.ts にする(鍵 = <ドメインのフォルダ名>.<ファイル名>、連絡定義と同じ道)。
// 一覧は絞らない: 門で閉じたドメインの項目は使う時に門番(messaging の recordTargetOpen)が落とす。

/** 宛先 1 人分: 利用者・記録から埋める値・その利用者に当たる記録(1 記録 1 件 = 記録ごと、複数 = まとめ。項目が決める、D204) */
export type MessageRecordRecipient = {
  userId: string;
  /** 記録から埋める値(連絡の vars の鍵 → 値)。無ければ {} */
  vars: Record<string, unknown>;
  /** この宛先に当たる選んだ記録の id */
  recordIds: string[];
};

/** 送った後の処理に渡す結果(管理の一括送信。形は指令 05 で組み直す) */
export type MessageRecordTargetSent = {
  /** 選んだ記録の id(全部) */
  recordIds: readonly string[];
  /** 送信の id(送信を書かなかった時は null) */
  dispatchId: string | null;
  counts: {
    /** 重複を除いた利用者の数 */
    recipientCount: number;
    /** 送信チャンネルごとの数(要求の中で分かった分) */
    channelCounts: Readonly<Record<string, unknown>>;
    /** cron に任せた配達の数 */
    queuedCount: number;
  };
  /** 送った欄の中身(レイアウトの欄、差し込む前の字) */
  values: Record<string, unknown>;
  /** 中身の出どころ: 選んだレイアウトか、DB のテンプレートの固定した版と直した印 */
  origin: { layout: string } | { id: string; version: number; edited: boolean };
};

/** 記録の宛先の項目(<domain>/recordTargets/<名前>.ts の export const recordTarget) */
export type MessageRecordTarget = {
  /** 鍵 = <ドメインのフォルダ名>.<ファイル名>(場所と一致しなければ生成器が止める。管理 API の target、送り元の既定は "<鍵>.bulk") */
  key: string;
  /** 表示名 */
  label: string;
  /** 使えるか(ドメインの門の他の条件。省略 = 使える。ドメインの門は門番が見る) */
  enabled?: () => boolean;
  /** 選んだ記録の id → 宛先(1 人 1 件。見つからない記録は飛ばす) */
  resolveRecipients: (recordIds: readonly string[]) => Promise<MessageRecordRecipient[]>;
  /**
   * 送った後の業務の処理(管理メモの追記など)。送信の受け付けの直後に 1 回呼ぶ。
   * 投げても送信は戻らない(呼び手が失敗として返し、監査ログにも残す)
   */
  afterSend?: (sent: MessageRecordTargetSent) => Promise<void>;
};

/** 項目のモジュール(recordTargets/<名前>.ts) */
export type MessageRecordTargetModule = {
  recordTarget: MessageRecordTarget;
};

/** 生成の一覧の 1 項目 */
export type MessageRecordTargetRegistryEntry = {
  key: string;
  /** 項目を置いたドメイン(フォルダ名)。門番がこのドメインの門を見る */
  domain: string;
  target: () => Promise<MessageRecordTargetModule>;
};

/** 記録の宛先の一覧(鍵 → 項目、絞らない) */
export type MessageRecordTargetRegistry = Readonly<Record<string, MessageRecordTargetRegistryEntry>>;
