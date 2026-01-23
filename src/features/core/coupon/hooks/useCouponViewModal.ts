// src/features/coupon/hooks/useCouponViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalMedia,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useCoupon } from "./useCoupon";


export type CouponViewModal = {
  title: string;
  badge?: DetailModalBadge;
  media?: DetailModalMedia;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const useCouponViewModal = (couponId: string | null) => {
  const { data: coupon, isLoading } = useCoupon(couponId);


  const viewModel = useMemo<CouponViewModal | null>(() => {
    if (!coupon) {
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
    const media: DetailModalMedia = {
      type: "image",
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
      media,
      rows,
      footer,
    };
  }, [
    coupon,

  ]);

  return {
    isLoading,
    coupon: coupon ?? null,
    viewModel,
  };
};
