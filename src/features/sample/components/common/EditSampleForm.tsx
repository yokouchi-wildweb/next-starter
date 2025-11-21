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
import { useImageUploaderField } from "@/hooks/useImageUploaderField";
import { err } from "@/lib/errors";

type Props = {
  sample: Sample;
  redirectPath?: string;
};

export default function EditSampleForm({ sample, redirectPath = "/" }: Props) {
  const methods = useForm<SampleUpdateFields>({
    resolver: zodResolver(SampleUpdateSchema) as Resolver<SampleUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      sample_category_id: sample.sample_category_id ?? "",
      name: sample.name ?? "",
      number: sample.number ?? undefined,
      rich_number: sample.rich_number ?? undefined,
      switch: sample.switch ?? false,
      radio: sample.radio ?? undefined,
      select: sample.select ?? undefined,
      main_image: sample.main_image ?? "",
      description: sample.description ?? "",
    },
  });

    const { data: sampleCategories = [] } = useSampleCategoryList({ suspense: true });

  const sampleCategoryOptions = sampleCategories.map((v) => ({ value: v.id, label: v.name }));

  const { upload: uploadMain, remove: removeMain } = useImageUploaderField(methods, "main_image", "sample/main", false);

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
      onUploadMain={uploadMain}
      onDeleteMain={removeMain}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
