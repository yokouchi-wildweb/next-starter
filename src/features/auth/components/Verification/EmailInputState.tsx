"use client";

import { useForm } from "react-hook-form";

import { Form } from "@/components/Shadcn/form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/controlled";
import { Button } from "@/components/Form/button/Button";

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

  const handleSubmit = form.handleSubmit(({ email }) => {
    onSubmit?.(email);
  });

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormFieldItem
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
      </form>
    </Form>
  );
}
