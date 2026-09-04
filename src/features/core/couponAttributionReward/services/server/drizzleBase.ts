// src/features/core/couponAttributionReward/services/server/drizzleBase.ts

import { CouponAttributionRewardTable } from "@/features/core/couponAttributionReward/entities/drizzle";
import {
  CouponAttributionRewardCreateSchema,
  CouponAttributionRewardUpdateSchema,
  type CouponAttributionRewardWriteInput,
} from "@/features/core/couponAttributionReward/entities/schema";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

// 監査: ウォレット付与自体は wallet.balance.adjusted で記録済み。ここでは
// 管理者が汎用 API から台帳行を手動補正した履歴を残す目的で CRUD 自動監査を付ける
// （grant() 内部は raw insert/update で自動監査を通らず、二重記録にならない）。
const couponAttributionRewardOptions: DrizzleCrudServiceOptions<CouponAttributionRewardWriteInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  defaultSearchFields: ["coupon_id", "coupon_history_id", "recipient_user_id"],
  parseCreate: (data) => CouponAttributionRewardCreateSchema.parse(data),
  parseUpdate: (data) => CouponAttributionRewardUpdateSchema.parse(data),
  audit: {
    enabled: true,
    targetType: "couponAttributionReward",
    actionPrefix: "coupon_attribution_reward",
    bulkMode: "detail",
    retentionDays: 730,
    recorder: auditLogger,
  },
};

export const couponAttributionRewardBase = createCrudService(
  CouponAttributionRewardTable,
  couponAttributionRewardOptions,
);
