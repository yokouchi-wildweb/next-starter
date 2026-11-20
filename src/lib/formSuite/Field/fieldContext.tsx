// src/lib/formSuite/Field/fieldContext.tsx
// formSuite の Field 内部用。欄の文脈(react-hook-form の Controller と、項目の id・エラーの状態)を持つ部品。
// Field の外へは出さない(画面は ControlledField・ConfiguredField・ManualField を使う)

"use client";

import * as React from "react";
import {
  Controller,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Label } from "@/components/Input/Label";
import { cn } from "@/lib/cn";

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

/** Controller を包み、中の部品が欄の名前を読めるようにする */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

/** 欄の名前・エラーの状態と、項目の id(入力・説明文・エラーの id)。FormField と FormItem の中で使う */
export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const { id } = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

/** 1 つの項目の入れ物。中の部品の id の元になる */
export function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

/** 項目のラベル。エラーのときは色が変わり、入力の id を指す */
export function FormLabel({ className, ...props }: Omit<React.ComponentProps<typeof Label>, "slot">) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive-text", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

/** 項目のエラー文(エラーが無く children も無ければ描かない) */
export function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : props.children;

  if (!body) {
    return null;
  }

  return (
    <p data-slot="form-message" id={formMessageId} className={cn("text-destructive-text text-sm", className)} {...props}>
      {body}
    </p>
  );
}
