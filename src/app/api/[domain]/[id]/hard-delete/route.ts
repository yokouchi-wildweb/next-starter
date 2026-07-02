// src/app/api/[domain]/[id]/hard-delete/route.ts

import { buildDomainIdRoute, hardDeleteOperation } from "src/lib/routeFactory";

// DELETE /api/[domain]/[id]/hard-delete : 完全削除（物理削除）
export const DELETE = buildDomainIdRoute(hardDeleteOperation);
