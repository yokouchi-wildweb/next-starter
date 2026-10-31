// src/app/api/[domain]/bulk/add-relation/route.ts

import { createDomainRoute } from "@/wiring/apiRoute";
import { readBulkRelationPayload } from "../bulkRelationPayload";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/add-relation : 複数レコードに同じ関連先を足す（既存の関連は残す）
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/add-relation",
    crudOp: "bulkAddRelation",
    operationType: "write",
    supports: "bulkAddRelation",
  },
  async (req, { service }) => {
    const { field, ids, targetIds } = await readBulkRelationPayload(req);
    return service.bulkAddRelation(field, ids, targetIds);
  },
);
