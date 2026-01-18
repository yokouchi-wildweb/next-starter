"use client";

import { useForm } from "react-hook-form";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldItem } from "@/components/Form";
import { TextInput } from "@/components/Form/Controlled";

type EmailInputFormValues = {
  email: string;
};

type EmailInputStateProps = {
  onSubmit?: (email: string) => void;
};

export function EmailInputState({ onSubmit }: EmailInputStateProps) {
  const form = useForm<EmailInputFormValues>({
    defaultValues: {
      email: "",
    },
  });

  return (
    <AppForm
      methods={form}
      onSubmit={({ email }) => {
        onSubmit?.(email);
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <FieldItem
        control={form.control}
        name="email"
        label="メールアドレス"
        renderInput={(field) => (
          <TextInput
            field={field}
            type="email"
            required
            autoComplete="email"
            placeholder="example@example.com"
          />
        )}
      />

      <Button type="submit" variant="default" className="w-full justify-center">
        メールアドレスを確認
      </Button>
    </AppForm>
  );
}
