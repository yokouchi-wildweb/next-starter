// src/features/sample/components/common/EditSampleForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleUpdateSchema } from "@/features/sample/entities/schema";
import type { SampleUpdateFields } from "@/features/sample/entities/form";
import type { Sample } from "@/features/sample/entities";
import { useUpdateSample } from "@/features/sample/hooks/useUpdateSample";
import { SampleForm } from "./SampleForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSampleCategoryList } from "@/features/sampleCategory/hooks/useSampleCategoryList";
import { useSampleTagList } from "@/features/sampleTag/hooks/useSampleTagList";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/DomainFieldRenderer";
import domainConfig from "@/features/sample/domain.json";

type Props = {
  sample: Sample;
  redirectPath?: string;
};

export default function EditSampleForm({ sample, redirectPath = "/" }: Props) {
  const methods = useForm<SampleUpdateFields>({
    resolver: zodResolver(SampleUpdateSchema) as Resolver<SampleUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, sample) as SampleUpdateFields,
  });

    const { data: sampleCategories = [] } = useSampleCategoryList({ suspense: true });
  const { data: sampleTags = [] } = useSampleTagList({ suspense: true });

  const sampleCategoryOptions = sampleCategories.map((v) => ({ value: v.id, label: v.name }));
  const sampleTagOptions = sampleTags.map((v) => ({ value: v.id, label: v.name }));

  const router = useRouter();

  const { trigger, isMutating } = useUpdateSample();

  const submit = async (data: SampleUpdateFields) => {
    try {
      await trigger({ id: sample.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <SampleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      sampleCategoryOptions={sampleCategoryOptions}
      sampleTagOptions={sampleTagOptions}
      submitLabel="更新"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
