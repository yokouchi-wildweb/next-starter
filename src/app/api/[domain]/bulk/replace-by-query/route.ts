// src/app/api/[domain]/bulk/replace-by-query/route.ts

import { createDomainRoute } from "src/lib/routeFactory";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/replace-by-query : 条件一致行の全削除 + records の挿入を単一トランザクションで実行
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/replace-by-query",
    crudOp: "replaceByQuery",
    operationType: "write",
    supports: "replaceByQuery",
  },
  async (req, { service }) => {
    const { where, records, options } = await req.json();
    const result = await service.replaceByQuery(where, records, options);
    return result;
  },
);
