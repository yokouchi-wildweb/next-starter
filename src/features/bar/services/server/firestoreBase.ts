// src/features/bar/services/server/firestoreBase.ts

import { createCrudService } from "@/lib/crud/firestore";
import type { Bar } from "@/features/bar/entities";

export const base = createCrudService<Bar>("bars", {
  idType: "db",
  defaultSearchFields: [
    "name",
    "modelNumber",
    "description"
  ],
  defaultOrderBy: [
    [
      "id",
      "ASC"
    ],
    [
      "updatedAt",
      "DESC"
    ]
  ]
});
