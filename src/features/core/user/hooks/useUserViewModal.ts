// src/features/core/user/hooks/useUserViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalMedia,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useUser } from "./useUser";

export type UserViewModal = {
  title: string;
  badge?: DetailModalBadge;
  media?: DetailModalMedia;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const useUserViewModal = (userId: string | null) => {
  const { data: user, isLoading } = useUser(userId);

  const viewModel = useMemo<UserViewModal | null>(() => {
    if (!user) {
      return null;
    }

    // ----- タイトルの組み立て -----
    const title = user.name || "ユーザー詳細";

    // ----- バッジの組み立て -----
    const badge: DetailModalBadge = {
      text: user.role,
      colorClass: "bg-gray-500",
    };

    // ----- 画像情報の組み立て -----
    // NOTE: User型にavatarUrlがないため、現時点ではundefined
    const media: DetailModalMedia | undefined = undefined;

    // ----- テーブル行の組み立て -----
    const rows: DetailModalRow[] = [
      [
        {
          label: "名前",
          value: user.name || "-",
        },
        {
          label: "メールアドレス",
          value: user.email || "-",
        },
      ],
      [
        {
          label: "ロール",
          value: user.role,
        },
        {
          label: "ステータス",
          value: user.status,
        },
      ],
    ];

    // ----- フッターの組み立て -----
    const footer: ReactNode = null;

    return {
      title,
      badge,
      media,
      rows,
      footer,
    };
  }, [user]);

  return {
    isLoading,
    user: user ?? null,
    viewModel,
  };
};
