// src/features/foo/components/common/EditFooForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FooUpdateSchema } from "@/features/foo/entities/schema";
import type { FooUpdateFields } from "@/features/foo/entities/form";
import type { Foo } from "@/features/foo/entities";
import { useUpdateFoo } from "@/features/foo/hooks/useUpdateFoo";
import { FooForm } from "./FooForm";
import { useRouter } from "next/navigation";
import { useAppToast, useLoadingToast } from "@/hooks/useAppToast";
import { useSampleCategoryList } from "@/features/sampleCategory/hooks/useSampleCategoryList";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/DomainFieldRenderer";
import domainConfig from "@/features/foo/domain.json";

type Props = {
  foo: Foo;
  redirectPath?: string;
};

export default function EditFooForm({ foo, redirectPath = "/" }: Props) {
  const methods = useForm<FooUpdateFields>({
    resolver: zodResolver(FooUpdateSchema) as Resolver<FooUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, foo) as FooUpdateFields,
  });

    const { data: sampleCategories = [] } = useSampleCategoryList({ suspense: true });

  const sampleCategoryOptions = sampleCategories.map((v) => ({ value: v.id, label: v.name }));

  const router = useRouter();
  const { showAppToast } = useAppToast();
  const { trigger, isMutating } = useUpdateFoo();
  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: FooUpdateFields) => {
    try {
      await trigger({ id: foo.id, data });
      showAppToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showAppToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <FooForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      sampleCategoryOptions={sampleCategoryOptions}
      submitLabel="更新"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
