// src/features/chatRoom/components/AdminChatRoomEdit/index.tsx

import { Suspense } from "react";
import EditChatRoomForm from "../common/EditChatRoomForm";
import type { ChatRoom } from "@/features/core/chatRoom/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminChatRoomEditProps = {
  chatRoom: ChatRoom;
  redirectPath?: string;
};

export default function AdminChatRoomEdit({ chatRoom, redirectPath }: AdminChatRoomEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditChatRoomForm chatRoom={chatRoom} redirectPath={redirectPath} />
    </Suspense>
  );
}
