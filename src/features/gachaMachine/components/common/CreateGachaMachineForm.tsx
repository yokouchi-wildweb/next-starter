// src/features/gachaMachine/components/common/CreateGachaMachineForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GachaMachineCreateSchema } from "@/features/gachaMachine/entities/schema";
import { GachaMachineCreateFields } from "@/features/gachaMachine/entities/form";
import { useCreateGachaMachine } from "../../hooks/useCreateGachaMachine";
import { GachaMachineForm } from "./GachaMachineForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useImageUploaderField } from "@/hooks/useImageUploaderField";
import { useRouteChangeEffect } from "@/hooks/useRouteChangeEffect";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateGachaMachineForm({ redirectPath = "/" }: Props) {
  const methods = useForm<GachaMachineCreateFields>({
    resolver: zodResolver(GachaMachineCreateSchema) as Resolver<GachaMachineCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: "",
      main_image_url: "",
      play_cost: undefined,
      sale_start_at: undefined,
      sale_end_at: "",
      daily_limit: undefined,
      user_limit: undefined,
      play_button_type: [],
      description: "",
    },
  });

    const { upload: uploadMain, remove: removeMain, markDeleted: markDeletedMain } =
    useImageUploaderField(methods, "main_image_url", "machine/main", { cleanupOnRouteChange: true });



  const router = useRouter();

  const { trigger, isMutating } = useCreateGachaMachine();

  const submit = async (data: GachaMachineCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      markDeletedMain();
      methods.setValue("main_image_url", "");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <GachaMachineForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      onUploadMain={uploadMain}
      onDeleteMain={removeMain}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
