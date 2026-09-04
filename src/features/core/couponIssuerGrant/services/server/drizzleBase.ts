// src/features/core/couponIssuerGrant/services/server/drizzleBase.ts

import { CouponIssuerGrantTable } from "@/features/core/couponIssuerGrant/entities/drizzle";
import {
  CouponIssuerGrantCreateSchema,
  CouponIssuerGrantUpdateSchema,
  type CouponIssuerGrantWriteInput,
} from "@/features/core/couponIssuerGrant/entities/schema";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

// 監査: 承認・却下・停止・設定変更は管理者の意思決定であり、wrapper は base.update を
// 通して書くため CRUD 自動監査（coupon_issuer_grant.updated、before/after 差分付き）で
// 全遷移が残る。個別 action 名での手動記録は重複になるので行わない。
const couponIssuerGrantOptions: DrizzleCrudServiceOptions<CouponIssuerGrantWriteInput> = {
  idType: "uuid",
  defaultOrderBy: [["requested_at", "DESC"]],
  defaultSearchFields: ["user_id"],
  parseCreate: (data) => CouponIssuerGrantCreateSchema.parse(data),
  parseUpdate: (data) => CouponIssuerGrantUpdateSchema.parse(data),
  audit: {
    enabled: true,
    targetType: "couponIssuerGrant",
    actionPrefix: "coupon_issuer_grant",
    bulkMode: "detail",
    retentionDays: 730,
    recorder: auditLogger,
  },
};

export const couponIssuerGrantBase = createCrudService(
  CouponIssuerGrantTable,
  couponIssuerGrantOptions,
);
