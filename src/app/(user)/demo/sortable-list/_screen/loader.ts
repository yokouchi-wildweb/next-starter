// src/app/(user)/demo/sortable-list/_screen/loader.ts
// /demo/sortable-list(デモ)の loader。範囲 root の createLoader(access public。feature-gate の demo.samplePages で既定 404)。
// searchForSorting(sort_order が NULL のレコードを自動初期化してから検索)で sample の先頭 20 件を取る。

import "server-only";

import type { Sample } from "@/features/sample/entities/model";
import { sampleService } from "@/features/sample/services/server/sampleService";
import { createLoader } from "@/app/guard";

export type DemoSortableListScreenData = { samples: Sample[] };

export const loadDemoSortableListScreen = createLoader({
  access: "public",
  load: async (): Promise<DemoSortableListScreenData> => {
    const { results: samples } = await sampleService.searchForSorting({
      page: 1,
      limit: 20,
      orderBy: [["sort_order", "ASC", "LAST"]],
    });
    return { samples };
  },
});
