// src/features/cardTag/components/common/CreateCardTagForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardTagCreateSchema } from "@/features/cardTag/entities/schema";
import { CardTagCreateFields } from "@/features/cardTag/entities/form";
import { useCreateCardTag } from "../../hooks/useCreateCardTag";
import { CardTagForm } from "./CardTagForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateCardTagForm({ redirectPath = "/" }: Props) {
  const methods = useForm<CardTagCreateFields>({
    resolver: zodResolver(CardTagCreateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useCreateCardTag();

  const submit = async (data: CardTagCreateFields) => {
    try {
      await trigger(data);
      toast.success("カードタグを登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <CardTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
