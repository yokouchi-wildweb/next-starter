// src/features/foo/components/common/CreateFooForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FooCreateSchema } from "@/features/foo/entities/schema";
import { FooCreateFields } from "@/features/foo/entities/form";
import { useCreateFoo } from "@/features/foo/hooks/useCreateFoo";
import { FooForm } from "./FooForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateFooForm({ redirectPath = "/" }: Props) {
  const methods = useForm<FooCreateFields>({
    resolver: zodResolver(FooCreateSchema) as Resolver<FooCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: "",
      filesize: undefined,
      media: "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useCreateFoo();

  const submit = async (data: FooCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <FooForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
