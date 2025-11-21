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
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  sampleCategory: SampleCategory;
  redirectPath?: string;
};

export default function EditSampleCategoryForm({ sampleCategory, redirectPath = "/" }: Props) {
  const methods = useForm<SampleCategoryUpdateFields>({
    resolver: zodResolver(SampleCategoryUpdateSchema) as Resolver<SampleCategoryUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: sampleCategory.name ?? "",
      description: sampleCategory.description ?? "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useUpdateSampleCategory();

  const submit = async (data: SampleCategoryUpdateFields) => {
    try {
      await trigger({ id: sampleCategory.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <SampleCategoryForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
