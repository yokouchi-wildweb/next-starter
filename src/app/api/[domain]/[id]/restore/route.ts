// src/app/api/[domain]/[id]/restore/route.ts

import { buildDomainIdRoute, restoreOperation } from "src/lib/routeFactory";

// POST /api/[domain]/[id]/restore : ソフトデリートしたデータを復旧
export const POST = buildDomainIdRoute(restoreOperation);
