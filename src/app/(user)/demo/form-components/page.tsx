"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/Shadcn/form";
import { Button } from "@/components/Form/Button/Button";
import {
  DateInput,
  FileInput,
  FileUrlInput,
  NumberInput,
  PasswordInput,
  SwitchInput,
  TextInput,
  Textarea,
} from "@/components/Form/Controlled";
import {
  BooleanCheckboxInput,
  CheckGroupInput,
  RadioGroupInput,
  SelectInput,
  StepperInput,
} from "src/components/Form/Manual";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para, SecTitle } from "@/components/TextBlocks";
import type { Options } from "@/types/form";

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
  password: string;
  description: string;
  date: string;
  radio: string;
  checkGroupRounded: string[];
  checkGroupStandard: string[];
  checkGroupBookmark: string[];
  checkGroupCheckbox: string[];
  select: string;
  number: number | "";
  switch: boolean;
  booleanCheckbox: boolean;
  file: File | null;
  fileUrl: string;
};

const defaultValues: DemoFormValues = {
  text: "",
  password: "",
  description: "",
  date: "",
  radio: textOptions[0]?.value ?? "",
  checkGroupRounded: [fruitOptions[0]?.value ?? ""],
  checkGroupStandard: [fruitOptions[0]?.value ?? ""],
  checkGroupBookmark: [fruitOptions[0]?.value ?? ""],
  checkGroupCheckbox: [fruitOptions[0]?.value ?? ""],
  select: "",
  number: 0,
  switch: true,
  booleanCheckbox: false,
  file: null,
  fileUrl: "",
};

type SerializableFormValues = Omit<DemoFormValues, "file"> & {
  file: null | {
    name: string;
    size: number;
    type: string;
  };
};

type StepperInputValues = {
  small: number;
  medium: number;
  large: number;
};

type DemoSnapshot = SerializableFormValues & {
  stepperInput: StepperInputValues;
};

const createStepperDefaults = (): StepperInputValues => ({
  small: 5,
  medium: 10,
  large: 20,
});

function serializeValues(values: DemoFormValues): SerializableFormValues {
  return {
    ...values,
    file: values.file
        ? {
          name: values.file.name,
          size: values.file.size,
          type: values.file.type,
        }
        : null,
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (event) => reject(event?.target?.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function FormComponentsDemoPage() {
  const form = useForm<DemoFormValues>({
    defaultValues,
  });
  const [submitted, setSubmitted] = useState<DemoSnapshot | null>(null);
  const [fileUrlPending, setFileUrlPending] = useState(false);
  const [stepperValues, setStepperValues] = useState<StepperInputValues>(createStepperDefaults);

  const currentValues = form.watch();
  const serializedCurrent = serializeValues(currentValues);
  const currentSnapshot: DemoSnapshot = {
    ...serializedCurrent,
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
          ...serializeValues(values),
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

  const handleUpload = useCallback(async (file: File) => {
    const url = await readFileAsDataUrl(file);
    return url;
  }, []);

  const handleDelete = useCallback(async (url: string) => {
    console.info("Delete request", url);
  }, []);

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
                <FormFieldItem
                    control={form.control}
                    name="text"
                    label="TextInput"
                    renderInput={(field) => (
                        <TextInput field={field} placeholder="テキストを入力" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="password"
                    label="PasswordInput"
                    renderInput={(field) => (
                        <PasswordInput field={field} placeholder="パスワード" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="description"
                    label="Textarea"
                    renderInput={(field) => (
                        <Textarea field={field} rows={4} placeholder="自由入力" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="date"
                    label="DateInput"
                    renderInput={(field) => <DateInput field={field} />}
                />

                <FormFieldItem
                    control={form.control}
                    name="radio"
                    label="RadioGroupInput"
                    renderInput={(field) => (
                        <RadioGroupInput field={field} options={textOptions} className="space-y-2" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="checkGroupRounded"
                    label="CheckGroupInput（Rounded）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="rounded" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="checkGroupStandard"
                    label="CheckGroupInput（Standard Button）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="standard" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="checkGroupBookmark"
                    label="CheckGroupInput（Bookmark Tag）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="bookmark" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="checkGroupCheckbox"
                    label="CheckGroupInput（Checkbox）"
                    renderInput={(field) => (
                        <CheckGroupInput field={field} options={fruitOptions} displayType="checkbox" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="select"
                    label="SelectInput"
                    renderInput={(field) => (
                        <SelectInput field={field} options={textOptions} placeholder="選択してください" />
                    )}
                />

                <FormFieldItem
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
                <FormFieldItem
                    control={form.control}
                    name="file"
                    label="FileInput"
                    renderInput={(field) => (
                        <FileInput field={field} accept="image/*" />
                    )}
                />

                <FormFieldItem
                    control={form.control}
                    name="fileUrl"
                    label="FileUrlInput"
                    renderInput={(field) => (
                        <FileUrlInput
                            field={field}
                            accept="image/*"
                            onUpload={handleUpload}
                            onDelete={handleDelete}
                            onPendingChange={setFileUrlPending}
                        />
                    )}
                />

                <Block space="sm">
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
                </Block>

                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <Para size="sm">ImageUploaderField について</Para>
                  <Para className="mt-1">
                    ImageUploaderField は FileUrlInput を組み合わせたコンポーネントです。
                    Firebase Storage 連携が必要なため、このデモでは FileUrlInput を利用した挙動のみ確認できます。
                  </Para>
                </div>
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
              {fileUrlPending && (
                  <Para tone="notice" size="xs" className="mt-3">
                    FileUrlInput のアップロード/削除処理を実行中です…
                  </Para>
              )}
            </div>
          </div>
        </Section>
      </Main>
  );
}
