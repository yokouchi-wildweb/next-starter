// src/features/coupon/hooks/useCouponViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalMedia,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useCoupon } from "./useCoupon";
import { formatDateJa } from "@/utils/date";

const TYPE_LABELS: Record<string, string> = {
  official: "公式プロモーション",
  affiliate: "アフィリエイト",
  invite: "ユーザー招待",
};

const STATUS_CONFIG: Record<string, { text: string; colorClass: string }> = {
  active: { text: "有効", colorClass: "bg-green-500" },
  inactive: { text: "無効", colorClass: "bg-gray-500" },
};

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
    const title = coupon.name;

    // ----- バッジの組み立て -----
    const statusConfig = STATUS_CONFIG[coupon.status] ?? STATUS_CONFIG.inactive;
    const badge: DetailModalBadge = {
      text: statusConfig.text,
      colorClass: statusConfig.colorClass,
    };

    // ----- 画像情報の組み立て -----
    const media: DetailModalMedia | undefined = coupon.image_url
      ? { type: "image", url: coupon.image_url, alt: coupon.name }
      : undefined;

    // ----- テーブル行の組み立て -----
    const rows: DetailModalRow[] = [
      [
        { label: "クーポンコード", value: coupon.code },
        { label: "種別", value: TYPE_LABELS[coupon.type] ?? coupon.type },
        ...(coupon.category ? [{ label: "カテゴリ", value: coupon.category }] : []),
      ],
      [
        {
          label: "有効期間",
          value: [
            coupon.valid_from ? formatDateJa(coupon.valid_from, { format: "YYYY/MM/DD HH:mm" }) : "制限なし",
            "〜",
            coupon.valid_until ? formatDateJa(coupon.valid_until, { format: "YYYY/MM/DD HH:mm" }) : "制限なし",
          ].join(" "),
        },
      ],
      [
        {
          label: "総使用回数",
          value: coupon.max_total_uses !== null
            ? `${coupon.current_total_uses} / ${coupon.max_total_uses}`
            : `${coupon.current_total_uses}（上限なし）`,
        },
        {
          label: "使用者毎の上限",
          value: coupon.max_uses_per_redeemer !== null
            ? `${coupon.max_uses_per_redeemer}回`
            : "制限なし",
        },
      ],
    ];

    // 説明があれば追加
    if (coupon.description) {
      rows.push([{ label: "説明", value: coupon.description }]);
    }

    // 管理者情報があれば追加
    if (coupon.admin_label || coupon.admin_note) {
      const adminCells: { label: string; value: string }[] = [];
      if (coupon.admin_label) {
        adminCells.push({ label: "管理者ラベル", value: coupon.admin_label });
      }
      if (coupon.admin_note) {
        adminCells.push({ label: "管理者メモ", value: coupon.admin_note });
      }
      rows.push(adminCells);
    }

    // ----- フッターの組み立て -----
    const footer: ReactNode = null;

    return {
      title,
      badge,
      media,
      rows,
      footer,
    };
  }, [coupon]);

  return {
    isLoading,
    coupon: coupon ?? null,
    viewModel,
  };
};
