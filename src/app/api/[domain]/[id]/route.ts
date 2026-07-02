// src/app/api/[domain]/[id]/route.ts

import {
  buildDomainIdRoute,
  getOperation,
  removeOperation,
  updateOperation,
} from "src/lib/routeFactory";

// GET /api/[domain]/[id] : IDで単一データを取得
export const GET = buildDomainIdRoute(getOperation);

// PUT /api/[domain]/[id] : 指定IDのデータを更新
export const PUT = buildDomainIdRoute(updateOperation);

// DELETE /api/[domain]/[id] : 指定IDのデータを削除
export const DELETE = buildDomainIdRoute(removeOperation);
