// src/features/gachaMachine/components/common/EditGachaMachineForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GachaMachineUpdateSchema } from "@/features/gachaMachine/entities/schema";
import type { GachaMachineUpdateFields } from "@/features/gachaMachine/entities/form";
import type { GachaMachine } from "@/features/gachaMachine/entities";
import { useUpdateGachaMachine } from "../../hooks/useUpdateGachaMachine";
import { GachaMachineForm } from "./GachaMachineForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useImageUploaderField } from "@/hooks/useImageUploaderField";
import { err } from "@/lib/errors";

type Props = {
  gachaMachine: GachaMachine;
  redirectPath?: string;
};

export default function EditGachaMachineForm({ gachaMachine, redirectPath = "/" }: Props) {
  const methods = useForm<GachaMachineUpdateFields>({
    resolver: zodResolver(GachaMachineUpdateSchema) as Resolver<GachaMachineUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      name: gachaMachine.name ?? "",
      main_image_url: gachaMachine.main_image_url ?? "",
      play_cost: gachaMachine.play_cost ?? undefined,
      sale_start_at: gachaMachine.sale_start_at ? new Date(gachaMachine.sale_start_at) : undefined,
      sale_end_at: gachaMachine.sale_end_at ?? "",
      daily_limit: gachaMachine.daily_limit ?? undefined,
      user_limit: gachaMachine.user_limit ?? undefined,
      play_button_type: gachaMachine.play_button_type ?? [],
      description: gachaMachine.description ?? "",
    },
  });

    const { upload: uploadMain, remove: removeMain } = useImageUploaderField(methods, "main_image_url", "machine/main", false);

  const router = useRouter();

  const { trigger, isMutating } = useUpdateGachaMachine();

  const submit = async (data: GachaMachineUpdateFields) => {
    try {
      await trigger({ id: gachaMachine.id, data });
      toast.success("更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <GachaMachineForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      onUploadMain={uploadMain}
      onDeleteMain={removeMain}
      submitLabel="更新"
      processingLabel="更新中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
