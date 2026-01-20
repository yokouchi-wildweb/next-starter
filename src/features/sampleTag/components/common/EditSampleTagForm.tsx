// src/features/sampleTag/components/common/EditSampleTagForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleTagUpdateSchema } from "@/features/sampleTag/entities/schema";
import type { SampleTagUpdateFields } from "@/features/sampleTag/entities/form";
import type { SampleTag } from "@/features/sampleTag/entities";
import { useUpdateSampleTag } from "@/features/sampleTag/hooks/useUpdateSampleTag";
import { SampleTagForm } from "./SampleTagForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/sampleTag/domain.json";

type Props = {
  sampleTag: SampleTag;
  redirectPath?: string;
};

export default function EditSampleTagForm({ sampleTag, redirectPath = "/" }: Props) {
  const methods = useForm<SampleTagUpdateFields>({
    resolver: zodResolver(SampleTagUpdateSchema) as Resolver<SampleTagUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, sampleTag) as SampleTagUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSampleTag();
  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: SampleTagUpdateFields) => {
    try {
      await trigger({ id: sampleTag.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <SampleTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
