// src/features/core/userAcquisition/config.ts
// 流入経路の設定(既定 + 上書き)。上書きは src/config/features/userAcquisition.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。読み手はこのドメインの中だけ(外は公開の口 classifyVisit・getChannelDefinitions)
// 記録するか(cookie の蓄積・本登録の確定保存・GA4 へ判別表を渡す)は門番の規則 userAcquisition の入切(上流の既定は閉、設定 D115)。
// ここには置かない(設定 L1.56: 記録の opt-in の enabled は規則に一本化した)

import override from "@/config/features/userAcquisition.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 経路の値(UTM が無いときに補う source / medium) */
export type AcquisitionChannelValue = { source: string; medium: string };

export type UserAcquisitionConfig = {
  /**
   * タッチ履歴 cookie の有効期間(日)。タッチを追記するたびに maxAge をリフレッシュするため、
   * 実質「最終タッチからこの日数」が遡り可能期間になる
   */
  cookieMaxAgeDays: number;
  /**
   * cookie に保持するタッチ数の上限(cookie 4KB 制限対策)。超過時は first-touch を必ず保持し、
   * 古い中間タッチから間引く(アトリビューション分析では first / last が最重要のため)
   */
  maxTouches: number;
  /**
   * ユーザー紹介の招待リンクから来た訪問の source / medium(判別表の行 channels/invite.ts、紹介の機能が閉じている間は行を出さない)。
   * パラメータ名("invite")は referral の物(referral/lib/inviteLinkCookie.ts の INVITE_LINK_PARAM、設定 D67)。
   * medium は GA が外部サイト流入に自動分類する "referral" と混ざらないよう別語彙。コードは extras[<パラメータ名>] に保存される
   */
  referralParam: AcquisitionChannelValue;
  /**
   * 判別表の広告クリック ID の行(並び = 表の順。先の行が source / medium を決める)。UTM が無い場合に補う source / medium(GA の慣例)。
   * 値の null は「クリック ID は extras に保存するが source/medium は導出しない」
   */
  clickIdParams: Record<string, AcquisitionChannelValue | null>;
};

const defaults: UserAcquisitionConfig = {
  cookieMaxAgeDays: 30,
  maxTouches: 15,
  referralParam: {
    source: "invite",
    medium: "invite",
  },
  clickIdParams: {
    gclid: { source: "google", medium: "cpc" },
    wbraid: { source: "google", medium: "cpc" },
    gbraid: { source: "google", medium: "cpc" },
    fbclid: { source: "facebook", medium: "paid-social" },
    ttclid: { source: "tiktok", medium: "paid-social" },
    msclkid: { source: "bing", medium: "cpc" },
    yclid: { source: "yahoo", medium: "cpc" },
    twclid: { source: "twitter", medium: "paid-social" },
    ldtag_cl: { source: "line", medium: "paid-social" },
  },
};

export const userAcquisitionConfigDef = defineConfig<UserAcquisitionConfig>(defaults, { label: "userAcquisition" });

/** 上書きのファイルの型(`export default { ... } satisfies UserAcquisitionOverride`) */
export type UserAcquisitionOverride<E extends object = Record<never, never>> = OverrideOf<typeof userAcquisitionConfigDef, E>;

/** 合成済みの設定 */
export const userAcquisitionConfig = userAcquisitionConfigDef.compose(override);
