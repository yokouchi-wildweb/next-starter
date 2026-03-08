// src/features/chatRoom/components/common/CreateChatRoomForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChatRoomCreateSchema } from "@/features/core/chatRoom/entities/schema";
import { ChatRoomCreateFields } from "@/features/core/chatRoom/entities/form";
import { useCreateChatRoom } from "@/features/core/chatRoom/hooks/useCreateChatRoom";
import { ChatRoomForm } from "./ChatRoomForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import rawDomainConfig from "@/features/core/chatRoom/domain.json";

const domainConfig = normalizeDomainJsonConfig(rawDomainConfig);

type Props = {
  redirectPath?: string;
};

export default function CreateChatRoomForm({ redirectPath = "/" }: Props) {
  const methods = useForm<ChatRoomCreateFields>({
    resolver: zodResolver(ChatRoomCreateSchema) as Resolver<ChatRoomCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as ChatRoomCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateChatRoom();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: ChatRoomCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <ChatRoomForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
