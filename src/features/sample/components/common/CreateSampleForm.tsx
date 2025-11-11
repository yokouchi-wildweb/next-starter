// src/features/sample/components/common/CreateSampleForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SampleCreateSchema } from "@/features/sample/entities/schema";
import { SampleCreateFields } from "@/features/sample/entities/form";
import { useCreateSample } from "../../hooks/useCreateSample";
import { SampleForm } from "./SampleForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSampleCategoryList } from "@/features/sampleCategory/hooks/useSampleCategoryList";
import { useImageUploaderField } from "@/hooks/useImageUploaderField";
import { useRouteChangeEffect } from "@/hooks/useRouteChangeEffect";
import { err } from "@/lib/errors";

type Props = {
  redirectPath?: string;
};

export default function CreateSampleForm({ redirectPath = "/" }: Props) {
  const methods = useForm<SampleCreateFields>({
    resolver: zodResolver(SampleCreateSchema) as Resolver<SampleCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      sample_category_id: "",
      name: "",
      number: undefined,
      rich_number: undefined,
      switch: false,
      radio: false,
      select: undefined,
      main_image: "",
      description: "",
    },
  });

    const { data: sampleCategories = [] } = useSampleCategoryList({ suspense: true });

  const sampleCategoryOptions = sampleCategories.map((v) => ({ value: v.id, label: v.name }));

  const { upload: uploadMain, remove: removeMain, markDeleted: markDeletedMain } =
    useImageUploaderField(methods, "main_image", "sample/main");
  useRouteChangeEffect(() => {
    const url = methods.getValues("main_image");
    if (!url) return;
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ pathOrUrl: url })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/storage/delete", blob);
    } else {
      void removeMain(url);
    }
    markDeletedMain();
  });



  const router = useRouter();

  const { trigger, isMutating } = useCreateSample();

  const submit = async (data: SampleCreateFields) => {
    try {
      await trigger(data);
      toast.success("登録しました");
      markDeletedMain();
      methods.setValue("main_image", "");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "登録に失敗しました"));
    }
  };

  return (
    <SampleForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      sampleCategoryOptions={sampleCategoryOptions}
      onUploadMain={uploadMain}
      onDeleteMain={removeMain}
      submitLabel="登録"
      processingLabel="登録中..."
      onCancel={() => router.push(redirectPath)}
    />
  );
}
