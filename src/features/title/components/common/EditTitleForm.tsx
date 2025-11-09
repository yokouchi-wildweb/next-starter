// src/features/title/components/common/EditTitleForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TitleUpdateSchema } from "@/features/title/entities/schema";
import { TitleUpdateFields } from "@/features/title/entities/form";
import type { Title } from "@/features/title/entities";
import { useUpdateTitle } from "../../hooks/useUpdateTitle";
import { TitleForm } from "./TitleForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  title: Title;
  redirectPath?: string;
};

export default function EditTitleForm({ title, redirectPath = "/" }: Props) {
  const methods = useForm<TitleUpdateFields>({
    resolver: zodResolver(TitleUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: title.name,
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useUpdateTitle();

  const submit = async (data: TitleUpdateFields) => {
    try {
      await trigger({ id: title.id, data });
      toast.success("タイトルを更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <TitleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
