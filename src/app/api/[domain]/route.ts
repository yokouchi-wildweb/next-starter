// src/app/api/[domain]/route.ts

import { buildDomainRoute, createOperation, listOperation } from "src/lib/routeFactory";

// GET /api/[domain] : 指定ドメインの一覧を取得
export const GET = buildDomainRoute(listOperation);

// POST /api/[domain] : 指定ドメインの新規データを作成
export const POST = buildDomainRoute(createOperation);
