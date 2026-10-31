// src/app/api/[domain]/bulk/remove-relation/route.ts

import { createDomainRoute } from "@/wiring/apiRoute";
import { readBulkRelationPayload } from "../bulkRelationPayload";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/remove-relation : 複数レコードから指定の関連先だけを外す（他の関連は残す）
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/remove-relation",
    crudOp: "bulkRemoveRelation",
    operationType: "write",
    supports: "bulkRemoveRelation",
  },
  async (req, { service }) => {
    const { field, ids, targetIds } = await readBulkRelationPayload(req);
    return service.bulkRemoveRelation(field, ids, targetIds);
  },
);
