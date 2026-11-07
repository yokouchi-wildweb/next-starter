// src/features/core/userAcquisition/types/channel.ts
//
// 獲得経路の判別表の型。表の 1 行 = 「この URL パラメータが付いていたら、この source / medium の流入」。
// UTM と外部リファラーは行ではなく判定のルール(classifyVisit の中)。

/** 補完する source / medium */
export type AcquisitionChannel = {
  source: string;
  medium: string;
};

/**
 * 行の種類。優先順位は UTM > clickId > link > 外部リファラー。
 * - clickId: 広告のクリック ID(GA / 広告が自分で判別する。GA4 へ手動のキャンペーン値は送らない)
 * - link: 独自のリンクの印(招待など。GA4 は判別しないので campaign_source / campaign_medium を送る)
 */
export type AcquisitionChannelKind = "clickId" | "link";

/** 判別表の 1 行(公開の口 getChannelDefinitions が返す形。シリアライズできる値だけ) */
export type AcquisitionChannelDefinition = {
  /** URL パラメータ名。値は extras[param] に保存される */
  param: string;
  kind: AcquisitionChannelKind;
  /** UTM の無いときに補う source / medium。null = extras に保存するだけで補わない */
  channel: AcquisitionChannel | null;
};

/**
 * 受け口 channels/<名前>.ts の項目(export const channel)。
 * 一覧の鍵は param(重複は読み込み時に例外)。
 */
export type AcquisitionChannelItem = AcquisitionChannelDefinition & {
  /** 持ち主の機能が閉じている間は行を出さない(省略 = 常に) */
  enabled?: () => boolean;
};
