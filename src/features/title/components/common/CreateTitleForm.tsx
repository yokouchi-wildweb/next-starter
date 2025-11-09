// src/features/title/components/common/CreateTitleForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TitleCreateSchema } from "@/features/title/entities/schema";
import { TitleCreateFields } from "@/features/title/entities/form";
import { useCreateTitle } from "../../hooks/useCreateTitle";
import { TitleForm } from "./TitleForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateTitleForm({ redirectPath = "/" }: Props) {
  const methods = useForm<TitleCreateFields>({
    resolver: zodResolver(TitleCreateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useCreateTitle();

  const submit = async (data: TitleCreateFields) => {
    try {
      await trigger(data);
      toast.success("タイトルを登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <TitleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
