// src/features/core/pairedDevice/services/server/drizzleBase.ts

import { PairedDeviceTable } from "@/features/pairedDevice/entities/drizzle";
import {
  PairedDeviceCreateSchema,
  PairedDeviceUpdateSchema,
  type PairedDeviceWriteInput,
} from "@/features/pairedDevice/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

// 監査は CRUD 自動記録ではなく、deviceService / pairingService の各操作が意味づけした
// action（paired_device.device.created / renamed / scope_changed / revoked / paired 等）で手動記録する。
// トークン・失効・最終アクセスの列は、条件付き更新が要るため deviceToken.ts が drizzle で直接書く。
const pairedDeviceOptions: CrudServiceOptions<PairedDeviceWriteInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => PairedDeviceCreateSchema.parse(data),
  parseUpdate: (data) => PairedDeviceUpdateSchema.parse(data),
};

export const pairedDeviceBase = createCrudService(PairedDeviceTable, pairedDeviceOptions);
