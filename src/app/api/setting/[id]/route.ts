// src/app/api/setting/[id]/route.ts
//
// setting は /api/setting/setup 静的フォルダを持つため、Next.js App Router が
// 静的 "setting" セグメントを優先解決し、/api/setting/<id>（例: /api/setting/global）が
// 汎用 /api/[domain]/[id] へフォールバックせず 404 になる（静的フォルダ・シャドーイング）。
// 固定ドメインファクトリで同一の serviceRegistry・認可（setting=ADMIN_ONLY）に対して
// 汎用 ID オペレーションをこの位置に再公開し、クライアント CRUD の解決を復旧する。
// useSetting()（GET /api/setting/global）/ useUpdateSetting()（PUT /api/setting/global）用。

import { createDomainIdRouteFor } from "src/lib/routeFactory";

export const { GET, PUT, DELETE } = createDomainIdRouteFor("setting");
