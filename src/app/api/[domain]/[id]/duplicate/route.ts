// src/app/api/[domain]/[id]/duplicate/route.ts

import { buildDomainIdRoute, duplicateOperation } from "src/lib/routeFactory";

// POST /api/[domain]/[id]/duplicate : 指定IDのデータを複製
export const POST = buildDomainIdRoute(duplicateOperation);
