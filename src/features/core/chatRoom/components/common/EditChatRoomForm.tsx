// src/features/chatRoom/components/common/EditChatRoomForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChatRoomUpdateSchema } from "@/features/core/chatRoom/entities/schema";
import type { ChatRoomUpdateFields } from "@/features/core/chatRoom/entities/form";
import type { ChatRoom } from "@/features/core/chatRoom/entities";
import { useUpdateChatRoom } from "@/features/core/chatRoom/hooks/useUpdateChatRoom";
import { ChatRoomForm } from "./ChatRoomForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { domainDisplay } from "@/features/core/chatRoom/entities/display";

type Props = {
  chatRoom: ChatRoom;
  redirectPath?: string;
};

export default function EditChatRoomForm({ chatRoom, redirectPath = "/" }: Props) {
  const methods = useForm<ChatRoomUpdateFields>({
    resolver: zodResolver(ChatRoomUpdateSchema) as Resolver<ChatRoomUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainDisplay, chatRoom) as ChatRoomUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateChatRoom();

  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: ChatRoomUpdateFields) => {
    try {
      await trigger({ id: chatRoom.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <ChatRoomForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
