// src/features/sampleCategory/components/common/CreateSampleCategoryForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCategoryCreateSchema } from "@/features/sampleCategory/entities/schema";
import { SampleCategoryCreateFields } from "@/features/sampleCategory/entities/form";
import { useCreateSampleCategory } from "@/features/sampleCategory/hooks/useCreateSampleCategory";
import { SampleCategoryForm } from "./SampleCategoryForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/sampleCategory/domain.json";

type Props = {
  redirectPath?: string;
};

export default function CreateSampleCategoryForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SampleCategoryCreateFields>({
    resolver: zodResolver(SampleCategoryCreateSchema) as Resolver<SampleCategoryCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as SampleCategoryCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateSampleCategory();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: SampleCategoryCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <SampleCategoryForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
