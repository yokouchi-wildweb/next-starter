// src/features/core/userAcquisition/channels/invite.ts
//
// 招待リンク(?invite=CODE)を獲得経路の 1 つとして分類する行。
// パラメータ名は referral の物(INVITE_LINK_PARAM)。紹介の機能が閉じている間は行を出さない
// (付け足しの連携。招待リンクの cookie 自体は referral が自分の名前だけで動かし、流入経路の記録のオンオフとは独立)。
// source / medium は設定(../config.ts)の referralParam(medium は GA の "referral" と混ざらない別語彙)。

import { userAcquisitionConfig } from "@/features/core/userAcquisition/config";
import { gate } from "@/featureGate";
import { INVITE_LINK_PARAM } from "@/features/core/referral/lib/inviteLinkCookie";
import type { AcquisitionChannelItem } from "@/features/core/userAcquisition/types/channel";

export const channel: AcquisitionChannelItem = {
  param: INVITE_LINK_PARAM,
  kind: "link",
  channel: {
    source: userAcquisitionConfig.referralParam.source,
    medium: userAcquisitionConfig.referralParam.medium,
  },
  enabled: () => gate.enabled("referral"),
};
