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
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  foo: Foo;
  redirectPath?: string;
};

export default function EditFooForm({ foo, redirectPath = "/" }: Props) {
  const methods = useForm<FooUpdateFields>({
    resolver: zodResolver(FooUpdateSchema) as Resolver<FooUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      filesize: foo.filesize ?? undefined,
      width: foo.width ?? undefined,
      media: foo.media ?? "",
      mimetype: foo.mimetype ?? "",
    },
  });

  const router = useRouter();

  const { trigger, isMutating } = useUpdateFoo();

  const submit = async (data: FooUpdateFields) => {
    try {
      await trigger({ id: foo.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <FooForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="処理中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
