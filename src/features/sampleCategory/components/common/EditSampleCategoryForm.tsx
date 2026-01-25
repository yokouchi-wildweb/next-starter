// src/features/sampleCategory/components/common/EditSampleCategoryForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import type { SampleCategoryUpdateFields } from "@/features/sampleCategory/entities/form";
import type { SampleCategory } from "@/features/sampleCategory/entities";
import { useUpdateSampleCategory } from "@/features/sampleCategory/hooks/useUpdateSampleCategory";
import { useSearchSampleCategory } from "@/features/sampleCategory/hooks/useSearchSampleCategory";
import { SampleCategoryForm } from "./SampleCategoryForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { getAdminPaths } from "@/lib/crud/utils/paths";
import domainConfig from "@/features/sampleCategory/domain.json";

const adminPaths = getAdminPaths(domainConfig.plural);

type Props = {
  sampleCategory: SampleCategory;
  redirectPath?: string;
};

export default function EditSampleCategoryForm({ sampleCategory, redirectPath = "/" }: Props) {
  const methods = useForm<SampleCategoryUpdateFields>({
    resolver: zodResolver(SampleCategoryUpdateSchema) as Resolver<SampleCategoryUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, sampleCategory) as SampleCategoryUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSampleCategory();
  const { data: items } = useSearchSampleCategory({ limit: 10 });

  const { navigator, isSwitching } = useItemNavigator({
    items,
    currentItem: sampleCategory,
    getPath: adminPaths.edit,
    methods,
    updateTrigger: trigger,
    isMutating,
  });

  useLoadingToast(isMutating, isSwitching ? "アイテムを切り替え中" : "更新中です…");

  const submit = async (data: SampleCategoryUpdateFields) => {
    try {
      await trigger({ id: sampleCategory.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <>
      {navigator}
      <SampleCategoryForm
        methods={methods}
        onSubmitAction={submit}
        isMutating={isMutating}
        submitLabel="更新"
        onCancel={() => router.push(redirectPath)}
      />
    </>
  );
}
