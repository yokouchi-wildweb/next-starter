// src/features/sample/components/common/CreateSampleForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCreateSchema } from "@/features/sample/entities/schema";
import { SampleCreateFields } from "@/features/sample/entities/form";
import { useCreateSample } from "@/features/sample/hooks/useCreateSample";
import { SampleForm } from "./SampleForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
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

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateSample();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: SampleCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <SampleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
