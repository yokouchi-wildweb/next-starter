// src/app/api/admin/messaging/dispatches/[id]/edit-options/route.ts
//
// 管理者向け: 予約した送信の直しの材料(PATCH ../ と同じ決まり、D210)。
// 返す形 { layout { key, label, version, fields } | null, editableFields, values | null, channels { <channel>: on | off | free }, maxScheduleDays }
// - 直せる欄: 自由連絡 = レイアウトの欄の全部 / 定義連絡 = 連絡定義の直せる欄(required の連絡は無い)。この欄だけを PATCH が受ける
// - 送信チャンネル: 自由連絡 = カテゴリーの送信チャンネルが全部 free / 定義連絡 = 定義の固定
// - 時刻だけ直せる送信(本文を残していない・テンプレートを消した = 送信の canEdit.content が不可)は layout・values が null、
//   editableFields・channels が空(画面は時刻だけ直し、canEdit.content の理由を出す)
// - 予約のままでない・削除した・連絡定義が無い送信は 409、無い送信は 404。門 messagingDispatches(住所の前方一致)
// 形: src/domains/core/messaging/services/server/admin/README.md「予約の直し」
//
// GET /api/admin/messaging/dispatches/[id]/edit-options

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/dispatches/[id]/edit-options",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => messagingService.adminScheduledEditOptions(params.id),
);
