// src/features/__domain__/hooks/use__Domain__ViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalImage,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { use__Domain__ } from "./use__Domain__";
__RELATION_IMPORTS__

export type __Domain__ViewModal = {
  title: string;
  badge?: DetailModalBadge;
  image?: DetailModalImage;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const use__Domain__ViewModal = (__domain__Id: string | null) => {
  const { data: __domain__, isLoading } = use__Domain__(__domain__Id);
__RELATION_HOOKS__

  const viewModel = useMemo<__Domain__ViewModal | null>(() => {
    if (!__domain__) {
      return null;
    }

__RELATION_SUMMARY_BLOCK__

    // ----- タイトルの組み立て -----
    const title = "modal ttitle";

    // ----- バッジの組み立て -----
    const badge: DetailModalBadge = {
      text: "badge",
      colorClass: "bg-gray-500",
    };

    // ----- 画像情報の組み立て -----
    const image: DetailModalImage = {
      url: "https://placehold.co/600x400?text=Detail+Image",
      alt: "image alt",
    };

    // ----- テーブル行の組み立て -----
    const rows: DetailModalRow[] = [
      [
        {
          label: "サンプル項目A",
          value: "value",
        },
        {
          label: "サンプル項目B",
          value: "value",
        },
      ],
      [
        {
          label: "サマリー",
          value: "value",
        },
      ],
    ];

    // ----- フッターの組み立て -----
    const footer: ReactNode = "modal footer";

    return {
      title,
      badge,
      image,
      rows,
      footer,
    };
  }, [
    __domain__,
__RELATION_DEPENDENCIES__
  ]);

  return {
    isLoading,
    __domain__: __domain__ ?? null,
    viewModel,
  };
};
