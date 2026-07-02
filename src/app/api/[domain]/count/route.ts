// src/app/api/[domain]/count/route.ts

import { buildDomainRoute, countOperation } from "src/lib/routeFactory";

// POST /api/[domain]/count : フィルタ条件に一致するレコード件数を取得
export const POST = buildDomainRoute(countOperation);
