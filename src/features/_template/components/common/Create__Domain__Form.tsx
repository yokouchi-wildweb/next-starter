// src/features/__domain__/components/common/Create__Domain__Form.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { __Domain__CreateSchema } from "@/features/__domain__/entities/schema";
import { __Domain__CreateFields } from "@/features/__domain__/entities/form";
import { useCreate__Domain__ } from "@/features/_template/hooks/useCreate__Domain__";
import { __Domain__Form } from "./__Domain__Form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function Create__Domain__Form({ redirectPath = "/" }: Props) {
  const methods = useForm<__Domain__CreateFields>({
    resolver: zodResolver(__Domain__CreateSchema) as Resolver<__Domain__CreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useCreate__Domain__();

  const submit = async (data: __Domain__CreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <__Domain__Form
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
