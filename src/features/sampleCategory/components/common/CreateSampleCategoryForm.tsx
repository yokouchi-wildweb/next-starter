// src/features/sampleCategory/components/common/CreateSampleCategoryForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCategoryCreateSchema } from "@/features/sampleCategory/entities/schema";
import { SampleCategoryCreateFields } from "@/features/sampleCategory/entities/form";
import { useCreateSampleCategory } from "@/features/sampleCategory/hooks/useCreateSampleCategory";
import { SampleCategoryForm } from "./SampleCategoryForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateSampleCategoryForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SampleCategoryCreateFields>({
    resolver: zodResolver(SampleCategoryCreateSchema) as Resolver<SampleCategoryCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useCreateSampleCategory();

  const submit = async (data: SampleCategoryCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <SampleCategoryForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
