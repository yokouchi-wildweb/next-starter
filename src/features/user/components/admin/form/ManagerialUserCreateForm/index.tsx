// src/features/user/components/admin/form/ManagerialUserCreateForm/index.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { PasswordInput, TextInput } from "@/components/Form/controlled";
import { err } from "@/lib/errors";
import { useCreateUser } from "@/features/user/hooks/useCreateUser";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

type Props = {
  redirectPath?: string;
};

export default function ManagerialUserCreateForm({ redirectPath = "/" }: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: DefaultValues,
  });

  const router = useRouter();
  const { trigger, isMutating } = useCreateUser();
  const isRouting = useRouteTransitionPending();

  const submit = async (values: FormValues) => {
    try {
      await trigger(values);
      toast.success("ユーザー登録が完了しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "ユーザー登録に失敗しました"));
    }
  };

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods;

  const loading = isSubmitting || isMutating || isRouting;

  return (
    <Form {...methods}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <FormFieldItem
          control={control}
          name="displayName"
          label="表示名"
          renderInput={(field) => <TextInput field={field} />}
        />
        <FormFieldItem
          control={control}
          name="email"
          label="メールアドレス"
          renderInput={(field) => <TextInput type="email" field={field} />}
        />
        <FormFieldItem
          control={control}
          name="password"
          label="パスワード"
          renderInput={(field) => <PasswordInput field={field} />}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} variant="default">
            {loading ? "登録中..." : "登録"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(redirectPath)}>
            キャンセル
          </Button>
        </div>
      </form>
    </Form>
  );
}
