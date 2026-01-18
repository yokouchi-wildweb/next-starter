// src/features/sampleTag/components/common/CreateSampleTagForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleTagCreateSchema } from "@/features/sampleTag/entities/schema";
import { SampleTagCreateFields } from "@/features/sampleTag/entities/form";
import { useCreateSampleTag } from "@/features/sampleTag/hooks/useCreateSampleTag";
import { SampleTagForm } from "./SampleTagForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/sampleTag/domain.json";

type Props = {
  redirectPath?: string;
};

export default function CreateSampleTagForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SampleTagCreateFields>({
    resolver: zodResolver(SampleTagCreateSchema) as Resolver<SampleTagCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as SampleTagCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateSampleTag();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: SampleTagCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <SampleTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
