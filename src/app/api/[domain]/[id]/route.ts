// src/app/api/[domain]/[id]/route.ts

import { createDomainIdRoute } from "src/lib/routeFactory";

// GET /api/[domain]/[id] : IDで単一データを取得
export const GET = createDomainIdRoute(
  {
    operation: "GET /api/[domain]/[id]",
    operationType: "read",
  },
  async (_req, { service, params }) => {
    return service.get(params.id);
  },
);

// PUT /api/[domain]/[id] : 指定IDのデータを更新
export const PUT = createDomainIdRoute(
  {
    operation: "PUT /api/[domain]/[id]",
    operationType: "write",
  },
  async (req, { service, params }) => {
    const { data } = await req.json();
    return service.update(params.id, data);
  },
);

// DELETE /api/[domain]/[id] : 指定IDのデータを削除
export const DELETE = createDomainIdRoute(
  {
    operation: "DELETE /api/[domain]/[id]",
    operationType: "write",
  },
  async (_req, { service, params }) => {
    await service.remove(params.id);
    return { success: true };
  },
);
