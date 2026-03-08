// src/features/chatRoom/components/common/EditChatRoomForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChatRoomUpdateSchema } from "@/features/core/chatRoom/entities/schema";
import type { ChatRoomUpdateFields } from "@/features/core/chatRoom/entities/form";
import type { ChatRoom } from "@/features/core/chatRoom/entities";
import { useUpdateChatRoom } from "@/features/core/chatRoom/hooks/useUpdateChatRoom";
import { useSearchChatRoom } from "@/features/core/chatRoom/hooks/useSearchChatRoom";
import { ChatRoomForm } from "./ChatRoomForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { getAdminPaths } from "@/lib/crud/utils/paths";
import domainConfig from "@/features/core/chatRoom/domain.json";

const adminPaths = getAdminPaths(domainConfig.plural);

type Props = {
  chatRoom: ChatRoom;
  redirectPath?: string;
};

export default function EditChatRoomForm({ chatRoom, redirectPath = "/" }: Props) {
  const methods = useForm<ChatRoomUpdateFields>({
    resolver: zodResolver(ChatRoomUpdateSchema) as Resolver<ChatRoomUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, chatRoom) as ChatRoomUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateChatRoom();
  const { data: items } = useSearchChatRoom({ limit: 10 });

  const { navigator, isSwitching } = useItemNavigator({
    items,
    currentItem: chatRoom,
    getPath: adminPaths.edit,
    methods,
    updateTrigger: trigger,
    isMutating,
  });

  useLoadingToast(isMutating, isSwitching ? "アイテムを切り替え中" : "更新中です…");

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
    <>
      {navigator}
      <ChatRoomForm
        methods={methods}
        onSubmitAction={submit}
        isMutating={isMutating}
        submitLabel="更新"
        onCancel={() => router.push(redirectPath)}
      />
    </>
  );
}
