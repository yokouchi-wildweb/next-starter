// src/app/api/admin/wallet/bulk/grant/route.ts
// 選んだ利用者へのまとめての付与・補填(管理者のみ)。中身は運用コマンド pnpm task wallet:bulk-grant と同じ walletService.bulkGrant
// (確かめ・飛ばす人・1 つの transaction・監査 wallet.balance.bulk_adjusted_by_users・知らせはサービスが持つ。ここは受けて渡すだけ)。
// - dryRun: true で人数・合計・飛ばす人だけを返す(何も書かない)。画面は dry-run → 確かめ → 本番の順に呼ぶ
// - 1 回は userConfig.bulkUpdate.maxIds 人まで(汎用の一括 API と同じ設定、既定 1000。多い時は画面側で分けて送る)。命令の上限(1 万人)はサービスのまま
// - 取り消し: 結果の requestBatchId を pnpm task wallet:reverse-history -- --batch に渡す

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { walletConfig, type WalletType } from "@/domains/wallet/config";
import { walletService } from "@/domains/core/wallet/services/server/walletService";
import { BULK_GRANT_KINDS } from "@/domains/core/wallet/services/server/wrappers/bulkGrant";
import type { BulkGrantKind } from "@/domains/core/wallet/services/types";
import { userConfig } from "@/domains/user/config";

export const maxDuration = 60;

const MAX_USERS = userConfig.bulkUpdate.maxIds;

const walletTypeValues = Object.keys(walletConfig.currency) as [WalletType, ...WalletType[]];
const kindValues = Object.keys(BULK_GRANT_KINDS) as [BulkGrantKind, ...BulkGrantKind[]];

const BulkGrantPayloadSchema = z.object({
  walletType: z.enum(walletTypeValues),
  kind: z.enum(kindValues),
  grants: z
    .array(z.object({ userId: z.string().trim().min(1), amount: z.number().int().positive() }))
    .min(1, { message: "付けるユーザーを選んでください。" })
    .max(MAX_USERS, { message: `1 回に付けられるのは ${MAX_USERS} 人までです(分けて送ってください)。` }),
  reason: z.string().trim().min(1, { message: "理由を入力してください。" }).max(200, { message: "理由は200文字以内で入力してください。" }),
  notify: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/wallet/bulk/grant",
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
    const parsed = BulkGrantPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.errors[0]?.message ?? "入力値が不正です。" }, { status: 400 });
    }
    return walletService.bulkGrant(parsed.data);
  },
);
