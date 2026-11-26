// src/domains/core/couponAttributionReward/services/server/couponAttributionRewardBase.ts

import { CouponAttributionRewardTable } from "@/domains/core/couponAttributionReward/entities/drizzle";
import {
  CouponAttributionRewardCreateSchema,
  CouponAttributionRewardUpdateSchema,
  type CouponAttributionRewardWriteInput,
} from "@/domains/core/couponAttributionReward/entities/schema";
import { auditLogger } from "@/domains/core/auditLog/services/server";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

// 監査: ウォレット付与自体は wallet.balance.adjusted で記録済み。ここでは
// 管理者が汎用 API から台帳行を手動補正した履歴を残す目的で CRUD 自動監査を付ける
// （grant() 内部は raw insert/update で自動監査を通らず、二重記録にならない）。
const couponAttributionRewardOptions: CrudServiceOptions<CouponAttributionRewardWriteInput> = {
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
