// src/features/__domain__/components/common/Edit__Domain__Form.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import type { __Domain__UpdateFields } from "@/features/__domain__/entities/form";
import type { __Domain__ } from "@/features/__domain__/entities";
import { useUpdate__Domain__ } from "@/features/__domain__/hooks/useUpdate__Domain__";
import { __Domain__Form } from "./__Domain__Form";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/__domain__/domain.json";

type Props = {
  __domain__: __Domain__;
  redirectPath?: string;
};

export default function Edit__Domain__Form({ __domain__, redirectPath = "/" }: Props) {
  const methods = useForm<__Domain__UpdateFields>({
    resolver: zodResolver(__Domain__UpdateSchema) as Resolver<__Domain__UpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, __domain__) as __Domain__UpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdate__Domain__();
  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: __Domain__UpdateFields) => {
    try {
      await trigger({ id: __domain__.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <__Domain__Form
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
