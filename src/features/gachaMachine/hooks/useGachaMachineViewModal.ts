// src/features/gachaMachine/hooks/useGachaMachineViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalImage,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useGachaMachine } from "./useGachaMachine";


export type GachaMachineViewModal = {
  title: string;
  badge?: DetailModalBadge;
  image?: DetailModalImage;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const useGachaMachineViewModal = (gachaMachineId: string | null) => {
  const { data: gachaMachine, isLoading } = useGachaMachine(gachaMachineId);


  const viewModel = useMemo<GachaMachineViewModal | null>(() => {
    if (!gachaMachine) {
      return null;
    }



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
    gachaMachine,

  ]);

  return {
    isLoading,
    gachaMachine: gachaMachine ?? null,
    viewModel,
  };
};
