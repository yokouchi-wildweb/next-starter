// src/features/sample/hooks/useSampleViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalImage,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useSample } from "./useSample";
import { useSampleCategoryList } from "@/features/sampleCategory/hooks/useSampleCategoryList";
import { useSampleTagList } from "@/features/sampleTag/hooks/useSampleTagList";


export type SampleViewModal = {
  title: string;
  badge?: DetailModalBadge;
  image?: DetailModalImage;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const useSampleViewModal = (sampleId: string | null) => {
  const { data: sample, isLoading } = useSample(sampleId);
  const { data: sampleCategories = [] } = useSampleCategoryList();
  const { data: sampleTags = [] } = useSampleTagList();


  const viewModel = useMemo<SampleViewModal | null>(() => {
    if (!sample) {
      return null;
    }

    const relationSummary = Object.entries({
      sampleCategories,
      sampleTags,
    })
      .map(([key, items]) => `${key}: ${Array.isArray(items) ? items.length : 0}件`)
      .join(" / ");



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
          value: "モーダルを使用するには表示個所のロジックを実装してください。",
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
    sample,
    sampleCategories,
    sampleTags,
  ]);

  return {
    isLoading,
    sample: sample ?? null,
    viewModel,
  };
};
