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
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  sampleTag: SampleTag;
  redirectPath?: string;
};

export default function EditSampleTagForm({ sampleTag, redirectPath = "/" }: Props) {
  const methods = useForm<SampleTagUpdateFields>({
    resolver: zodResolver(SampleTagUpdateSchema) as Resolver<SampleTagUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: sampleTag.name ?? "",
      description: sampleTag.description ?? "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useUpdateSampleTag();

  const submit = async (data: SampleTagUpdateFields) => {
    try {
      await trigger({ id: sampleTag.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <SampleTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
