// src/app/api/admin/coupon-issuer-grants/[id]/route.ts
//
// 管理者向け: 発行権の状態遷移と per-user 設定の更新。
// 汎用 update ではなく専用アクションで遷移させる（reviewed_by / reviewed_at の自動設定、
// 遷移制約、停止時の当期クーポン無効化、設定変更時の当期クーポン同期を保証するため）。
// 一覧・検索は汎用 /api/coupon-issuer-grant（serviceRegistry, admin）を使う。

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors/domainError";
import {
  reinstateGrant,
  reviewGrant,
  suspendGrant,
  updateGrantSettings,
} from "@/features/core/couponIssuerGrant/services/server";
import { CouponIssuerGrantAdminActionSchema } from "@/features/core/couponIssuerGrant/entities/schema";

type Params = { id: string };

export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/admin/coupon-issuer-grants/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params, session }) => {
    const parsed = CouponIssuerGrantAdminActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエストの形式が不正です", { status: 400 });
    }
    const actorId = session?.userId;
    if (!actorId) {
      throw new DomainError("セッションが不正です", { status: 401 });
    }

    const { action, settings, adminNote } = parsed.data;
    const grantId = params.id;

    switch (action) {
      case "approve":
      case "reject": {
        const grant = await reviewGrant({
          grantId,
          decision: action,
          reviewedBy: actorId,
          settings,
          adminNote,
        });
        return { grant };
      }
      case "suspend": {
        const grant = await suspendGrant({ grantId, reviewedBy: actorId, adminNote });
        return { grant };
      }
      case "reinstate": {
        const grant = await reinstateGrant({ grantId, reviewedBy: actorId, adminNote });
        return { grant };
      }
      case "update_settings": {
        if (!settings) {
          throw new DomainError("settings は必須です", { status: 400 });
        }
        return updateGrantSettings({ grantId, settings, updatedBy: actorId, adminNote });
      }
    }
  },
);
