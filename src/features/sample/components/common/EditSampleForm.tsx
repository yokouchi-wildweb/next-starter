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
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useAutoSaveConfig } from "@/components/Form/AutoSave";
import { domainDisplay } from "@/features/sample/entities/display";

type Props = {
  sample: Sample;
  redirectPath?: string;
};

export default function EditSampleForm({ sample, redirectPath = "/" }: Props) {
  const methods = useForm<SampleUpdateFields>({
    resolver: zodResolver(SampleUpdateSchema) as Resolver<SampleUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainDisplay, sample) as SampleUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSample();
  const autoSave = useAutoSaveConfig(trigger, sample.id);

  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: SampleUpdateFields) => {
    try {
      await trigger({ id: sample.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <SampleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      autoSave={autoSave}
    />
  );
}
