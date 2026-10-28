// src/features/sample/services/server/collections.ts
// dc:generate が domain.json の集まりの項目（mediaCollection）から生成する（generateFiles.registry）。手で直さない。
// createCrudService の collections オプション（ドメイン集約）。生成の drizzleBase.ts が import して渡す。
// 詳細: src/lib/crud/README.md「ドメイン集約（collections オプション）」

import type { CrudCollectionConfig } from "@/lib/crud/drizzle";
import { SampleImageTable } from "@/features/sampleImage/entities/drizzle";

export const collections: CrudCollectionConfig[] = [
  {
    fieldName: "images",
    service: () => import("@/features/sampleImage/services/server/sampleImageService").then((m) => m.sampleImageService),
    parentColumn: SampleImageTable.sample_id,
    valueColumn: SampleImageTable.file,
    sortColumn: SampleImageTable.sort_order,
    maxItems: 8,
    duplicate: true,
  },
];
