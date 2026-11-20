// src/app/(user)/demo/form-components/_screen/DemoFormComponentsDemo.tsx
// /demo/form-components のデモ本体(client)。Screen が描く。
"use client";

import { useCallback, useState } from "react";
import { FormProvider as Form, useForm } from "react-hook-form";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/Button/Button";
import { ControlledBooleanCheckboxInput, ControlledCheckGroupInput, ControlledDateInput, ControlledDatetimeInput, ControlledEmailInput, ControlledFileInput, ControlledMultiSelectInput, ControlledNumberInput, ControlledPasswordInput, ControlledRadioGroupInput, ControlledSelectInput, ControlledSwitchInput, ControlledTextInput, ControlledTextarea, ControlledTimeInput } from "@/lib/formSuite";
import StepperInput from "@/components/Input/StepperInput";
import { Label } from "@/components/Input/Label";
import { ControlledField } from "@/lib/formSuite";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/Layout/Main";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import type { Options, OptionValue } from "@/components/Input/options";

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

export function DemoFormComponentsDemo() {
  const form = useForm<DemoFormValues>({
    defaultValues,
  });
  const [submitted, setSubmitted] = useState<DemoSnapshot | null>(null);
  const [stepperValues, setStepperValues] = useState<StepperInputValues>(createStepperDefaults);

  // フォーム全体の現在値を表示するデモ。useWatch だと型が DeepPartial になるため watch() のまま使う
  // (React Compiler の最適化対象から外れるだけで動作は変わらない)
  // eslint-disable-next-line react-hooks/incompatible-library
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
            <code>src/lib/formSuite</code> に用意されているコンポーネントの見た目と挙動を確認できます。
          </Para>
        </Section>

        <Section className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
          <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="grid gap-8 rounded-lg border bg-background p-6 shadow-sm"
            >
              <Grid gap="lg" className="md:grid-cols-2">
                <ControlledField
                    control={form.control}
                    name="text"
                    label="TextInput"
                    renderInput={(field) => (
                        <ControlledTextInput field={field} placeholder="テキストを入力" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="email"
                    label="EmailInput（leftIcon付き）"
                    renderInput={(field) => (
                        <ControlledEmailInput
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
                        <ControlledPasswordInput
                            field={field}
                            autoComplete="current-password"
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
                        <ControlledTextarea field={field} rows={4} placeholder="自由入力" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="date"
                    label="DateInput"
                    renderInput={(field) => <ControlledDateInput field={field} />}
                />


                <ControlledField
                    control={form.control}
                    name="time"
                    label="TimeInput"
                    renderInput={(field) => <ControlledTimeInput field={field} />}
                />

                <ControlledField
                    control={form.control}
                    name="datetime"
                    label="DatetimeInput"
                    renderInput={(field) => <ControlledDatetimeInput field={field} />}
                />

                <ControlledField
                    control={form.control}
                    name="radio"
                    label="RadioGroupInput"
                    renderInput={(field) => (
                        <ControlledRadioGroupInput field={field} options={textOptions} className="flex flex-col gap-2" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="radioStandard"
                    label="RadioGroupInput（Standard Button）"
                    renderInput={(field) => (
                        <ControlledRadioGroupInput
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
                        <ControlledCheckGroupInput field={field} options={fruitOptions} displayType="rounded" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupStandard"
                    label="CheckGroupInput（Standard Button）"
                    renderInput={(field) => (
                        <ControlledCheckGroupInput field={field} options={fruitOptions} displayType="standard" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupBookmark"
                    label="CheckGroupInput（Bookmark Tag）"
                    renderInput={(field) => (
                        <ControlledCheckGroupInput field={field} options={fruitOptions} displayType="bookmark" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="checkGroupCheckbox"
                    label="CheckGroupInput（Checkbox）"
                    renderInput={(field) => (
                        <ControlledCheckGroupInput field={field} options={fruitOptions} displayType="classic" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="select"
                    label="SelectInput"
                    renderInput={(field) => (
                        <ControlledSelectInput field={field} options={textOptions} placeholder="選択してください" />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="multiSelect"
                    label="MultiSelectInput"
                    renderInput={(field) => (
                        <ControlledMultiSelectInput
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
                        <ControlledFileInput
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
                        <ControlledNumberInput field={field} placeholder="数値を入力" min={0} step={1} />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="switch"
                    label="SwitchInput"
                    renderInput={(field) => (
                        <ControlledSwitchInput
                            field={field}
                            label="スイッチラベル"
                            description="チェックボックスのラッパーです"
                        />
                    )}
                />

                <ControlledField
                    control={form.control}
                    name="booleanCheckbox"
                    label="BooleanCheckboxInput"
                    renderInput={(field) => (
                        <ControlledBooleanCheckboxInput field={field} label="チェックボックスラベル" />
                    )}
                />
              </Grid>

              <Grid gap="lg" className="md:grid-cols-2">
                <Stack gap="md">
                  <Label className="text-sm font-medium">StepperInput</Label>
                  <Para tone="muted" size="xs">
                    サイズ違いのバリエーションをまとめて確認できます。
                  </Para>
                  <Flex wrap="wrap" gap="sm">
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
                  </Flex>
                </Stack>

              </Grid>

              <Flex wrap="wrap" align="center" justify="end" gap="sm">
                <Button type="button" variant="ghost" onClick={handleReset}>
                  リセット
                </Button>
                <Button type="submit">送信</Button>
              </Flex>
            </form>
          </Form>

          <Flex direction="column" gap="md">
            <Block className="rounded-lg border bg-muted/40 p-4">
              <SecTitle tone="muted" size="sm">
                現在の値
              </SecTitle>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-background/80 p-3 text-xs">
              {JSON.stringify(currentSnapshot, null, 2)}
            </pre>
            </Block>
            <Block className="rounded-lg border bg-muted/40 p-4">
              <SecTitle tone="muted" size="sm">
                送信結果
              </SecTitle>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-background/80 p-3 text-xs">
              {submitted ? JSON.stringify(submitted, null, 2) : "未送信"}
            </pre>
            </Block>
          </Flex>
        </Section>
      </Main>
  );
}
