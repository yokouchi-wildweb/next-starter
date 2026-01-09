// src/features/sampleCategory/components/common/EditSampleCategoryForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import type { SampleCategoryUpdateFields } from "@/features/sampleCategory/entities/form";
import type { SampleCategory } from "@/features/sampleCategory/entities";
import { useUpdateSampleCategory } from "@/features/sampleCategory/hooks/useUpdateSampleCategory";
import { SampleCategoryForm } from "./SampleCategoryForm";
import { useRouter } from "next/navigation";
import { useAppToast, useLoadingToast } from "@/hooks/useAppToast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/DomainFieldRenderer";
import domainConfig from "@/features/sampleCategory/domain.json";

type Props = {
  sampleCategory: SampleCategory;
  redirectPath?: string;
};

export default function EditSampleCategoryForm({ sampleCategory, redirectPath = "/" }: Props) {
  const methods = useForm<SampleCategoryUpdateFields>({
    resolver: zodResolver(SampleCategoryUpdateSchema) as Resolver<SampleCategoryUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, sampleCategory) as SampleCategoryUpdateFields,
  });

  const router = useRouter();
  const { showAppToast } = useAppToast();
  const { trigger, isMutating } = useUpdateSampleCategory();
  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: SampleCategoryUpdateFields) => {
    try {
      await trigger({ id: sampleCategory.id, data });
      showAppToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showAppToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <SampleCategoryForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
