// src/app/api/[domain]/route.ts

import { createDomainRoute } from "src/lib/routeFactory";
import type { WithOptions } from "@/lib/crud";
import { parseBooleanFlag } from "./search/utils";

type DomainParams = { domain: string };

// GET /api/[domain] : 指定ドメインの一覧を取得
export const GET = createDomainRoute<any, DomainParams>(
  {
    operation: "GET /api/[domain]",
    operationType: "read",
  },
  async (req, { service }) => {
    const query = req.nextUrl.searchParams;
    const options: WithOptions = {};
    const withRelations = parseBooleanFlag(query.get("withRelations"), "withRelations");
    const withCount = parseBooleanFlag(query.get("withCount"), "withCount");
    if (withRelations) options.withRelations = withRelations;
    if (withCount) options.withCount = withCount;
    return service.list(options);
  },
);

// POST /api/[domain] : 指定ドメインの新規データを作成
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]",
    operationType: "write",
  },
  async (req, { service }) => {
    const { data } = await req.json();
    return service.create(data);
  },
);
