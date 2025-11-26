// src/features/sampleTag/components/common/CreateSampleTagForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleTagCreateSchema } from "@/features/sampleTag/entities/schema";
import { SampleTagCreateFields } from "@/features/sampleTag/entities/form";
import { useCreateSampleTag } from "@/features/sampleTag/hooks/useCreateSampleTag";
import { SampleTagForm } from "./SampleTagForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateSampleTagForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SampleTagCreateFields>({
    resolver: zodResolver(SampleTagCreateSchema) as Resolver<SampleTagCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useCreateSampleTag();

  const submit = async (data: SampleTagCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <SampleTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
