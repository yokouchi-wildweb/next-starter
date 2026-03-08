// src/features/chatRoom/components/AdminChatRoomCreate/index.tsx

import { Suspense } from "react";
import CreateChatRoomForm from "../common/CreateChatRoomForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminChatRoomCreateProps = {
  redirectPath?: string;
};

export default function AdminChatRoomCreate({ redirectPath }: AdminChatRoomCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateChatRoomForm redirectPath={redirectPath} />
    </Suspense>
  );
}
