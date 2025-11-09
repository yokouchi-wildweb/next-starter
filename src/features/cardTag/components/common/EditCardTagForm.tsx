// src/features/cardTag/components/common/EditCardTagForm.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardTagUpdateSchema } from "@/features/cardTag/entities/schema";
import { CardTagUpdateFields } from "@/features/cardTag/entities/form";
import type { CardTag } from "@/features/cardTag/entities";
import { useUpdateCardTag } from "../../hooks/useUpdateCardTag";
import { CardTagForm } from "./CardTagForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  cardTag: CardTag;
  redirectPath?: string;
};

export default function EditCardTagForm({ cardTag, redirectPath = "/" }: Props) {
  const methods = useForm<CardTagUpdateFields>({
    resolver: zodResolver(CardTagUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: cardTag.name,
      description: cardTag.description ?? "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useUpdateCardTag();

  const submit = async (data: CardTagUpdateFields) => {
    try {
      await trigger({ id: cardTag.id, data });
      toast.success("カードタグを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <CardTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
