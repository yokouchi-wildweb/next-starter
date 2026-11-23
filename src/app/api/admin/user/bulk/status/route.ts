// src/app/api/admin/user/bulk/status/route.ts
// 選んだ利用者の状態のまとめての変更(管理者のみ)。中身は運用コマンド pnpm task user:bulk-change-status と同じ userService.bulkChangeStatus
// (変えてよい先・飛ばす人・1 人 1 transaction の changeStatus = recordStatusTransition と監査 user.status.changed・セッション失効はサービスが持つ。
// ここは受けて渡すだけ。変えてよい先の判定もサービスの 1 か所)。
// - dryRun: true で変える人・飛ばす人だけを返す(何も書かない)。画面は dry-run → 確かめ → 本番の順に呼ぶ
// - 1 回は userConfig.bulkUpdate.maxIds 人まで(汎用の一括 API と同じ設定、既定 1000。多い時は画面側で分けて送る)。命令は上限なしのまま

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { userService } from "@/domains/core/user/services/server/userService";
import { USER_STATUSES } from "@/domains/core/user/constants/status";
import { userConfig } from "@/domains/user/config";

export const maxDuration = 60;

const MAX_USERS = userConfig.bulkUpdate.maxIds;

const BulkChangeStatusPayloadSchema = z.object({
  userIds: z
    .array(z.string().trim().min(1))
    .min(1, { message: "変えるユーザーを選んでください。" })
    .max(MAX_USERS, { message: `1 回に変えられるのは ${MAX_USERS} 人までです(分けて送ってください)。` }),
  newStatus: z.enum(USER_STATUSES),
  reason: z.string().trim().min(1, { message: "理由を入力してください。" }).max(500, { message: "理由は500文字以内で入力してください。" }),
  onlyFrom: z.enum(USER_STATUSES).optional(),
  dryRun: z.boolean().optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/user/bulk/status",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req) => {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }
    const parsed = BulkChangeStatusPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.errors[0]?.message ?? "入力値が不正です。" }, { status: 400 });
    }
    return userService.bulkChangeStatus(parsed.data);
  },
);
