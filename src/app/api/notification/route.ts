// src/app/api/notification/route.ts
//
// 静的フォルダ・シャドーイング対策の mirror ルート。notification は /api/notification/my 等の
// 静的サブルートを持つため、汎用 /api/[domain] がシャドーされる。同一 serviceRegistry・
// 認可（notification=ADMIN_ONLY）で汎用コレクション CRUD をここに再公開する。
// 詳細: src/lib/routeFactory/domainRoutes.ts

import { createDomainCollectionRouteFor } from "src/lib/routeFactory";

export const { GET, POST } = createDomainCollectionRouteFor("notification");
