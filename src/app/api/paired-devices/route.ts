// src/app/api/paired-devices/route.ts
//
// 管理側: 端末の一覧（GET）と登録（POST）。
// 管理できる範囲は kind の manageableScopes で決まる（admin カテゴリは全件）。
// 店長などの一般ロールも使うため /api/admin 配下ではなく、認証 + サービス側の権限判定で守る。

import {
  CreatePairedDeviceSchema,
  ListPairedDevicesSchema,
} from "@/features/core/pairedDevice/entities/schema";
import {
  createPairedDevice,
  listPairedDevices,
  toPairedDeviceForAdmin,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";

const parseScopeParam = (value: string | null): unknown => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new DomainError("scope は JSON で指定してください", { status: 400 });
  }
};

export const GET = createApiRoute(
  {
    operation: "GET /api/paired-devices",
    operationType: "read",
    access: "custom",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      const search = req.nextUrl.searchParams;
      const parsed = ListPairedDevicesSchema.safeParse({
        kind: search.get("kind") ?? undefined,
        scope: parseScopeParam(search.get("scope")),
        includeRevoked: search.get("includeRevoked") === "true" || undefined,
        page: search.get("page") ? Number(search.get("page")) : undefined,
        limit: search.get("limit") ? Number(search.get("limit")) : undefined,
      });
      if (!parsed.success) {
        throw new DomainError("検索条件が不正です", { status: 400 });
      }
      return listPairedDevices(parsed.data, user);
    }),
);

export const POST = createApiRoute(
  {
    operation: "POST /api/paired-devices",
    operationType: "write",
    access: "custom",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      const parsed = CreatePairedDeviceSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        throw new DomainError("入力が不正です", { status: 400 });
      }
      const device = await createPairedDevice(parsed.data, user);
      return { device: toPairedDeviceForAdmin(device) };
    }),
);

