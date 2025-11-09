// src/features/__domain__/components/common/Edit__Domain__Form.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import type { __Domain__UpdateFields } from "@/features/__domain__/entities/form";
import type { __Domain__ } from "@/features/__domain__/entities";
import { useUpdate__Domain__ } from "../../hooks/useUpdate__Domain__";
import { __Domain__Form } from "./__Domain__Form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  __domain__: __Domain__;
  redirectPath?: string;
};

export default function Edit__Domain__Form({ __domain__, redirectPath = "/" }: Props) {
  const methods = useForm<__Domain__UpdateFields>({
    resolver: zodResolver(__Domain__UpdateSchema) as Resolver<__Domain__UpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      // TODO: 初期値を設定してください
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useUpdate__Domain__();

  const submit = async (data: __Domain__UpdateFields) => {
    try {
      await trigger({ id: __domain__.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <__Domain__Form
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
