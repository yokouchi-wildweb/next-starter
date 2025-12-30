// src/features/foo/components/common/CreateFooForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FooCreateSchema } from "@/features/foo/entities/schema";
import { FooCreateFields } from "@/features/foo/entities/form";
import { useCreateFoo } from "@/features/foo/hooks/useCreateFoo";
import { FooForm } from "./FooForm";
import { useRouter } from "next/navigation";
import { useAppToast, useLoadingToast } from "@/hooks/useAppToast";
import { useSampleCategoryList } from "@/features/sampleCategory/hooks/useSampleCategoryList";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/DomainFieldRenderer";
import domainConfig from "@/features/foo/domain.json";

type Props = {
  redirectPath?: string;
};

export default function CreateFooForm({ redirectPath = "/" }: Props) {
  const methods = useForm<FooCreateFields>({
    resolver: zodResolver(FooCreateSchema) as Resolver<FooCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as FooCreateFields,
  });

    const { data: sampleCategories = [] } = useSampleCategoryList({ suspense: true });

  const sampleCategoryOptions = sampleCategories.map((v) => ({ value: v.id, label: v.name }));

  const router = useRouter();
  const { showAppToast } = useAppToast();
  const { trigger, isMutating } = useCreateFoo();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: FooCreateFields) => {
    try {
      await trigger(data);
      showAppToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showAppToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <FooForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      sampleCategoryOptions={sampleCategoryOptions}
      submitLabel="登録"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
