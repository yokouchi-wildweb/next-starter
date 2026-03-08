// src/features/chatRoom/hooks/useChatRoomViewModal.ts

"use client";

import { useMemo, type ReactNode } from "react";
import type {
  DetailModalBadge,
  DetailModalMedia,
  DetailModalRow,
} from "@/components/Overlays/DetailModal";
import { useChatRoom } from "./useChatRoom";


export type ChatRoomViewModal = {
  title: string;
  badge?: DetailModalBadge;
  media?: DetailModalMedia;
  rows: DetailModalRow[];
  footer: ReactNode;
};

export const useChatRoomViewModal = (chatRoomId: string | null) => {
  const { data: chatRoom, isLoading } = useChatRoom(chatRoomId);


  const viewModel = useMemo<ChatRoomViewModal | null>(() => {
    if (!chatRoom) {
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
    chatRoom,

  ]);

  return {
    isLoading,
    chatRoom: chatRoom ?? null,
    viewModel,
  };
};
