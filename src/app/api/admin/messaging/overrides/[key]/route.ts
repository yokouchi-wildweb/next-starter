// src/app/api/admin/messaging/overrides/[key]/route.ts
//
// 管理者向け: 1 連絡の文言の上書き(AdminOverrideMessageDetail)。門 messagingOverrides が閉なら 404
//
// GET    /api/admin/messaging/overrides/[key]                  全欄(コードの値・管理画面の値・印・使ってよい {{鍵}})
// PUT    /api/admin/messaging/overrides/[key]                  body { fields: [{ fieldPath, value } | { fieldPath, reset: true }] } 直した欄をまとめて保存
//        (D132 の 1 回の保存。1 つの取引で、どれかが誤りなら何も書かない。欄の誤りは 400 code override_fields_invalid・details.fields { 欄の鍵: 理由 })
// DELETE /api/admin/messaging/overrides/[key]?field=<欄の鍵>   欄 1 つを既定に戻す(行を消す。管理画面は PUT の reset を使う)

import { gate } from "@/featureGate";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

type Params = { key: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/messaging/overrides/[key]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("messagingOverrides");
    return messagingService.getMessageOverrides(params.key);
  },
);

export const PUT = createApiRoute<Params>(
  {
    operation: "PUT /api/admin/messaging/overrides/[key]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("messagingOverrides");
    const body = await req.json().catch(() => null);
    return messagingService.saveMessageOverride(params.key, body);
  },
);

export const DELETE = createApiRoute<Params>(
  {
    operation: "DELETE /api/admin/messaging/overrides/[key]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("messagingOverrides");
    const field = req.nextUrl.searchParams.get("field");
    if (!field) throw new DomainError("field を指定してください", { status: 400 });
    return messagingService.resetMessageOverride(params.key, field);
  },
);
