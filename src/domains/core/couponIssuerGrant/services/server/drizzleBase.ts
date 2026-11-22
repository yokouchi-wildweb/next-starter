// src/domains/core/couponIssuerGrant/services/server/drizzleBase.ts

import { CouponIssuerGrantTable } from "@/domains/core/couponIssuerGrant/entities/drizzle";
import {
  CouponIssuerGrantCreateSchema,
  CouponIssuerGrantUpdateSchema,
  type CouponIssuerGrantWriteInput,
} from "@/domains/core/couponIssuerGrant/entities/schema";
import { auditLogger } from "@/domains/core/auditLog/services/server";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

// 監査: 承認・却下・停止・設定変更は管理者の意思決定であり、wrapper は base.update を
// 通して書くため CRUD 自動監査（coupon_issuer_grant.updated、before/after 差分付き）で
// 全遷移が残る。個別 action 名での手動記録は重複になるので行わない。
const couponIssuerGrantOptions: CrudServiceOptions<CouponIssuerGrantWriteInput> = {
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
