// src/features/core/messaging/messages/adminMarketing.ts
//
// 管理者が書いて送る連絡: 種別 marketing の定義(D65・D80・D85・D92)。宣伝(受信者の好みに従う。全員・ロール・宛先の集め方・選んだ利用者・一覧の一括)。
// authored = 文面を送るたびに受け取る(その場で書く連絡もテンプレートの文面も同じ。経路ごとの欄は経路の受け口の zod で検査する)。
// 定義は鍵・種類だけを持つ(文面・vars は空)。送り手: services/server/admin(send.ts・bulkSend.ts。送る時は選んだ種別 marketing の
// カテゴリーに替える)。宛先の種類は種別の性質 adminFreeText で確かめる。種別ごとの定義の表は services/server/admin/freeText.ts。
// 決まった挨拶・足元の文は無い(管理者が書く)。宛名 {{displayName}} は enrichers/displayName.ts が足す。上書きのファイルは置けない

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "messaging.adminMarketing",
  label: "管理者が書いたキャンペーン情報",
  category: "marketing",
  authored: true,
  vars: z.object({}),
  content: {},
});
