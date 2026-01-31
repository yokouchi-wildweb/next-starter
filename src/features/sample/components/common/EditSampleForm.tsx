// src/features/sample/components/common/EditSampleForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleUpdateSchema } from "@/features/sample/entities/schema";
import type { SampleUpdateFields } from "@/features/sample/entities/form";
import type { Sample } from "@/features/sample/entities";
import { useUpdateSample } from "@/features/sample/hooks/useUpdateSample";
import { useSearchSample } from "@/features/sample/hooks/useSearchSample";
import { SampleForm } from "./SampleForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useAutoSaveConfig } from "@/components/Form/AutoSave";
import { useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { getAdminPaths } from "@/lib/crud/utils/paths";
import domainConfig from "@/features/sample/domain.json";

const adminPaths = getAdminPaths(domainConfig.plural);

type Props = {
  sample: Sample;
  redirectPath?: string;
};

export default function EditSampleForm({ sample, redirectPath = "/" }: Props) {
  const methods = useForm<SampleUpdateFields>({
    resolver: zodResolver(SampleUpdateSchema) as Resolver<SampleUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, sample) as SampleUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSample();
  const { data: items } = useSearchSample({ limit: 10 });
  const autoSave = useAutoSaveConfig(trigger, sample.id);

  const { navigator, isSwitching } = useItemNavigator({
    items,
    currentItem: sample,
    getPath: adminPaths.edit,
    methods,
    updateTrigger: trigger,
    isMutating,
  });

  useLoadingToast(isMutating, isSwitching ? "アイテムを切り替え中" : "更新中です…");

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
    <>
      {navigator}
      <SampleForm
        methods={methods}
        onSubmitAction={submit}
        isMutating={isMutating}
        submitLabel="更新"
        autoSave={autoSave}
      />
    </>
  );
}
