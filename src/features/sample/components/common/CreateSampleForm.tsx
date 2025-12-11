// src/features/sample/components/common/CreateSampleForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCreateSchema } from "@/features/sample/entities/schema";
import { SampleCreateFields } from "@/features/sample/entities/form";
import { useCreateSample } from "@/features/sample/hooks/useCreateSample";
import { SampleForm } from "./SampleForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSampleCategoryList } from "@/features/sampleCategory/hooks/useSampleCategoryList";
import { useSampleTagList } from "@/features/sampleTag/hooks/useSampleTagList";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/DomainFieldRenderer";
import domainConfig from "@/features/sample/domain.json";

type Props = {
  redirectPath?: string;
};

export default function CreateSampleForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SampleCreateFields>({
    resolver: zodResolver(SampleCreateSchema) as Resolver<SampleCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as SampleCreateFields,
  });

    const { data: sampleCategories = [] } = useSampleCategoryList({ suspense: true });
  const { data: sampleTags = [] } = useSampleTagList({ suspense: true });

  const sampleCategoryOptions = sampleCategories.map((v) => ({ value: v.id, label: v.name }));
  const sampleTagOptions = sampleTags.map((v) => ({ value: v.id, label: v.name }));

  const router = useRouter();

  const { trigger, isMutating } = useCreateSample();

  const submit = async (data: SampleCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <SampleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      sampleCategoryOptions={sampleCategoryOptions}
      sampleTagOptions={sampleTagOptions}
      submitLabel="登録"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
