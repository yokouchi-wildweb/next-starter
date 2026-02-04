"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Lock, Mail } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/_shadcn/form";
import { Button } from "@/components/Form/Button/Button";
import {
  BooleanCheckboxInput,
  CheckGroupInput,
  DateInput,
  DatetimeInput,
  EmailInput,
  FileInput,
  MultiSelectInput,
  NumberInput,
  PasswordInput,
  RadioGroupInput,
  SelectInput,
  SwitchInput,
  TextInput,
  Textarea,
  TimeInput,
} from "@/components/Form/Input/Controlled";
import { StepperInput } from "@/components/Form/Input/Manual";
import { ControlledField } from "@/components/Form";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para, SecTitle } from "@/components/TextBlocks";
import type { Options, OptionValue } from "@/components/Form/types";

const textOptions: Options[] = [
  { label: "オプション A", value: "A" },
  { label: "オプション B", value: "B" },
  { label: "オプション C", value: "C" },
];

const fruitOptions: Options[] = [
  { label: "りんご", value: "apple" },
  { label: "みかん", value: "orange" },
  { label: "バナナ", value: "banana" },
];

type DemoFormValues = {
  text: string;
  email: string;
  password: string;
  description: string;
  date: string;
  time: string;
  datetime: string;
  radio: OptionValue;
  radioStandard: OptionValue;
  checkGroupRounded: OptionValue[];
  checkGroupStandard: OptionValue[];
  checkGroupBookmark: OptionValue[];
  checkGroupCheckbox: OptionValue[];
  select: OptionValue;
  multiSelect: OptionValue[];
  number: number | "";
  switch: boolean;
  booleanCheckbox: boolean;
  file: File | string | null;
};

const defaultValues: DemoFormValues = {
  text: "",
  email: "",
  password: "",
  description: "",
  date: "",
  time: "",
  datetime: "",
  radio: textOptions[0]?.value ?? "",
  radioStandard: textOptions[0]?.value ?? "",
  checkGroupRounded: [fruitOptions[0]?.value ?? ""],
  checkGroupStandard: [fruitOptions[0]?.value ?? ""],
  checkGroupBookmark: [fruitOptions[0]?.value ?? ""],
  checkGroupCheckbox: [fruitOptions[0]?.value ?? ""],
  select: "",
  multiSelect: [],
  number: 0,
  switch: true,
  booleanCheckbox: false,
  file: null,
};

type StepperInputValues = {
  small: number;
  medium: number;
  large: number;
};

const formatFileValue = (value: DemoFormValues["file"]): string | null => {
  if (value instanceof File) {
    return value.name;
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
};

type DemoSnapshot = Omit<DemoFormValues, "file"> & {
  file: string | null;
  stepperInput: StepperInputValues;
};

const createStepperDefaults = (): StepperInputValues => ({
  small: 5,
  medium: 10,
  large: 20,
});

export default function FormComponentsDemoPage() {
  const form = useForm<DemoFormValues>({
    defaultValues,
  });
  const [submitted, setSubmitted] = useState<DemoSnapshot | null>(null);
  const [stepperValues, setStepperValues] = useState<StepperInputValues>(createStepperDefaults);

  const currentValues = form.watch();
  const currentSnapshot: DemoSnapshot = {
    ...currentValues,
    file: formatFileValue(currentValues.file),
    stepperInput: stepperValues,
  };

  const handleReset = useCallback(() => {
    form.reset(defaultValues);
    setSubmitted(null);
    setStepperValues(createStepperDefaults());
  }, [form]);

  const handleSubmit = useCallback(
      (values: DemoFormValues) => {
        setSubmitted({
          ...values,
          file: formatFileValue(values.file),
          stepperInput: stepperValues,
        });
      },
      [stepperValues],
  );

  const handleStepperValueChange = useCallback(
      (key: keyof StepperInputValues, value: number) => {
        setStepperValues((prev) => ({ ...prev, [key]: value }));
      },
      [],
  );

  return (
      <Main containerType="wideShowcase">
        <Section>
          <PageTitle size="xxxl" className="font-semibold tracking-tight">
            Form コンポーネント デモ
          </PageTitle>
          <Para tone="muted" size="sm">
            <code>src/components/Form</code> に用意されているコンポーネントの見た目と挙動を確認できます。
          </Para>
        </Section>

        <Section className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
          <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="grid gap-8 rounded-lg border bg-background p-6 shadow-sm"
            >
              <div className="grid gap-6 md:grid-cols-2">
                <ControlledField
                    control={form.control}
                    name="text"
                    label="TextInput"
                    renderInput={(field) => (
                        <TextInput field={field} placeholder="テキストを入力" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="email"
                    label="EmailInput（leftIcon付き）"
                    renderInput={(field) => (
                        <EmailInput
                            field={field}
                            placeholder="例）maile@example.com"
                            leftIcon={<Mail className="size-4" />}
                        />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="password"
                    label="PasswordInput（leftIcon付き）"
                    renderInput={(field) => (
                        <PasswordInput
                            field={field}
                            placeholder="ご登録のパスワード"
                            leftIcon={<Lock className="size-4" />}
                        />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="description"
                    label="Textarea"
                    renderInput={(field) => (
                        <Textarea field={field} rows={4} placeholder="自由入力" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="date"
                    label="DateInput"
                    renderInput={(field) => <DateInput field={field} />}
                />


                <ControlledField
                    control={form.control}
                    name="time"
                    label="TimeInput"
                    renderInput={(field) => <TimeInput field={field} />}
                />

                <ControlledField
                    control={form.control}
                    name="datetime"
                    label="DatetimeInput"
                    renderInput={(field) => <DatetimeInput field={field} />}
                />

                <ControlledField
                    control={form.control}
                    name="radio"
                    label="RadioGroupInput"
                    renderInput={(field) => (
                        <RadioGroupInput field={field} options={textOptions} className="flex flex-col gap-2" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="radioStandard"
                    label="RadioGroupInput（Standard Button）"
                    renderInput={(field) => (
                        <RadioGroupInput
                            field={field}
                            options={textOptions}
                            displayType="standard"
                        />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupRounded"
                    label="CheckGroupInput（Rounded）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="rounded" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupStandard"
                    label="CheckGroupInput（Standard Button）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="standard" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupBookmark"
                    label="CheckGroupInput（Bookmark Tag）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="bookmark" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupCheckbox"
                    label="CheckGroupInput（Checkbox）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="classic" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="select"
                    label="SelectInput"
                    renderInput={(field) => (
                        <SelectInput field={field} options={textOptions} placeholder="選択してください" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="multiSelect"
                    label="MultiSelectInput"
                    renderInput={(field) => (
                        <MultiSelectInput
                            field={field}
                            options={textOptions}
                            placeholder="複数選択してください"
                        />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="file"
                    label="FileInput"
                    description={{ text: "選択中のファイル名とクリアボタンを確認できます。", tone: "muted", size: "xs" }}
                    renderInput={(field) => (
                        <FileInput
                            field={field}
                            accept="image/*"
                            onRemove={() => {
                              field.onChange(null);
                              field.onBlur();
                            }}
                        />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="number"
                    label="NumberInput"
                    renderInput={(field) => (
                        <NumberInput field={field} placeholder="数値を入力" min={0} step={1} />
                    )}
                />

                <FormField
                    control={form.control}
                    name="switch"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>SwitchInput</FormLabel>
                          <FormControl>
                            <SwitchInput
                                field={field}
                                label="スイッチラベル"
                                description="チェックボックスのラッパーです"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="booleanCheckbox"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>BooleanCheckboxInput</FormLabel>
                          <FormControl>
                            <BooleanCheckboxInput field={field} label="チェックボックスラベル" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Stack space={4}>
                  <FormLabel className="text-sm font-medium">StepperInput</FormLabel>
                  <Para tone="muted" size="xs">
                    サイズ違いのバリエーションをまとめて確認できます。
                  </Para>
                  <div className="flex flex-wrap gap-3">
                    <StepperInput
                        label="小"
                        size="s"
                        step={1}
                        value={stepperValues.small}
                        onValueChange={(value) => handleStepperValueChange("small", value)}
                    />
                    <StepperInput
                        label="中"
                        size="m"
                        step={5}
                        value={stepperValues.medium}
                        onValueChange={(value) => handleStepperValueChange("medium", value)}
                    />
                    <StepperInput
                        label="大"
                        size="l"
                        step={10}
                        value={stepperValues.large}
                        onValueChange={(value) => handleStepperValueChange("large", value)}
                    />
                  </div>
                </Stack>

              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="ghost" onClick={handleReset}>
                  リセット
                </Button>
                <Button type="submit">送信</Button>
              </div>
            </form>
          </Form>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <SecTitle tone="muted" size="sm">
                現在の値
              </SecTitle>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-background/80 p-3 text-xs">
              {JSON.stringify(currentSnapshot, null, 2)}
            </pre>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <SecTitle tone="muted" size="sm">
                送信結果
              </SecTitle>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-background/80 p-3 text-xs">
              {submitted ? JSON.stringify(submitted, null, 2) : "未送信"}
            </pre>
            </div>
          </div>
        </Section>
      </Main>
  );
}
