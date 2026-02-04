"use client";

import { useForm } from "react-hook-form";
import { Form } from "@/components/_shadcn/form";
import { ControlledField, ControlledFieldGroup } from "@/components/Form";
import { ManualField } from "@/components/Form/Field/Manual";
import {
  TextInput,
  EmailInput,
  SelectInput,
  Textarea,
  DateInput,
  NumberInput,
} from "@/components/Form/Input/Controlled";
import { Input } from "@/components/Form/Input/Manual";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Main, PageTitle, SecTitle } from "@/components/TextBlocks";
import type { Options } from "@/components/Form/types";

const categoryOptions: Options[] = [
  { label: "技術", value: "tech" },
  { label: "デザイン", value: "design" },
  { label: "マーケティング", value: "marketing" },
];

const yearOptions: Options[] = Array.from({ length: 50 }, (_, i) => ({
  label: `${2024 - i}年`,
  value: String(2024 - i),
}));

const monthOptions: Options[] = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: String(i + 1),
}));

const dayOptions: Options[] = Array.from({ length: 31 }, (_, i) => ({
  label: `${i + 1}日`,
  value: String(i + 1),
}));

type DemoFormValues = {
  title: string;
  email: string;
  category: string;
  date: string;
  description: string;
  startTime: string;
  endTime: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
};

const LABEL_CLASS = "w-[120px]";

export default function FieldLayoutDemoPage() {
  const form = useForm<DemoFormValues>({
    defaultValues: {
      title: "",
      email: "",
      category: "",
      date: "",
      description: "",
      startTime: "",
      endTime: "",
      birthYear: "",
      birthMonth: "",
      birthDay: "",
    },
  });

  return (
    <Main containerType="contentShell">
      <Section>
        <PageTitle>Field Layout デモ</PageTitle>
      </Section>

      {/* 横並びレイアウト */}
      <Section>
        <SecTitle>横並びレイアウト</SecTitle>
        <Form {...form}>
          <form className="mt-4 rounded-lg border bg-background p-6">
            <Stack space={6}>
              <ControlledField
                control={form.control}
                name="title"
                label="タイトル"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                required
                renderInput={(field) => (
                  <TextInput field={field} placeholder="イベント名を入力" />
                )}
              />

              <ControlledField
                control={form.control}
                name="email"
                label="メール"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                required
                description={{ text: "連絡先として使用します", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <EmailInput field={field} placeholder="example@mail.com" />
                )}
              />

              <ControlledField
                control={form.control}
                name="category"
                label="カテゴリ"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                renderInput={(field) => (
                  <SelectInput field={field} options={categoryOptions} placeholder="選択してください" />
                )}
              />

              <ControlledField
                control={form.control}
                name="date"
                label="開催日"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                renderInput={(field) => <DateInput field={field} />}
              />

              <ControlledField
                control={form.control}
                name="description"
                label="詳細"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                description={{ text: "イベントの詳細を記載してください", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <Textarea field={field} rows={3} placeholder="自由入力" />
                )}
              />
            </Stack>
          </form>
        </Form>
      </Section>

      {/* レスポンシブレイアウト */}
      <Section>
        <SecTitle>レスポンシブレイアウト</SecTitle>
        <Form {...form}>
          <form className="mt-4 rounded-lg border bg-background p-6">
            <Stack space={6}>
              <ControlledField
                control={form.control}
                name="title"
                label="タイトル"
                layout="responsive"
                labelClass={LABEL_CLASS}
                required
                renderInput={(field) => (
                  <TextInput field={field} placeholder="イベント名を入力" />
                )}
              />

              <ControlledField
                control={form.control}
                name="email"
                label="メール"
                layout="responsive"
                labelClass={LABEL_CLASS}
                required
                description={{ text: "連絡先として使用します", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <EmailInput field={field} placeholder="example@mail.com" />
                )}
              />

              <ControlledField
                control={form.control}
                name="category"
                label="カテゴリ"
                layout="responsive"
                labelClass={LABEL_CLASS}
                renderInput={(field) => (
                  <SelectInput field={field} options={categoryOptions} placeholder="選択してください" />
                )}
              />

              <ControlledField
                control={form.control}
                name="description"
                label="詳細"
                layout="responsive"
                labelClass={LABEL_CLASS}
                description={{ text: "イベントの詳細を記載してください", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <Textarea field={field} rows={3} placeholder="自由入力" />
                )}
              />
            </Stack>
          </form>
        </Form>
      </Section>

      {/* ControlledFieldGroup（横並びレイアウト） */}
      <Section>
        <SecTitle>ControlledFieldGroup（横並びレイアウト）</SecTitle>
        <Form {...form}>
          <form className="mt-4 rounded-lg border bg-background p-6">
            <Stack space={6}>
              {/* 2個パターン（prefix/suffix あり） */}
              <ControlledFieldGroup
                control={form.control}
                names={["startTime", "endTime"] as const}
                label="開催時間"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                inputLayout="horizontal"
                inputConfigs={[
                  { prefix: <span className="w-8">開始</span>, suffix: "～" },
                  { prefix: <span className="w-8">終了</span> },
                ]}
                required
                renderInputs={(fields) => [
                  <TextInput key="start" field={fields[0]} placeholder="00:00" />,
                  <TextInput key="end" field={fields[1]} placeholder="00:00" />,
                ]}
              />

              {/* 3個パターン（インプット縦並び） */}
              <ControlledFieldGroup
                control={form.control}
                names={["birthYear", "birthMonth", "birthDay"] as const}
                label="生年月日"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                required
                renderInputs={(fields) => [
                  <SelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <SelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <SelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
                ]}
              />

              {/* 3個パターン（インプット横並び） */}
              <ControlledFieldGroup
                control={form.control}
                names={["birthYear", "birthMonth", "birthDay"] as const}
                label="生年月日（横）"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                inputLayout="horizontal"
                required
                renderInputs={(fields) => [
                  <SelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <SelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <SelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
                ]}
              />

              {/* 3個パターン（レスポンシブ：スマホ縦、PC横） */}
              <ControlledFieldGroup
                control={form.control}
                names={["birthYear", "birthMonth", "birthDay"] as const}
                label="生年月日（レスポンシブ）"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                inputLayout="responsive"
                required
                renderInputs={(fields) => [
                  <SelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <SelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <SelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
                ]}
              />
            </Stack>
          </form>
        </Form>
      </Section>

      {/* ControlledFieldGroup（レスポンシブレイアウト） */}
      <Section>
        <SecTitle>ControlledFieldGroup（レスポンシブレイアウト）</SecTitle>
        <Form {...form}>
          <form className="mt-4 rounded-lg border bg-background p-6">
            <Stack space={6}>
              {/* layout="responsive" のみ指定（inputLayout は自動で responsive） */}
              <ControlledFieldGroup
                control={form.control}
                names={["birthYear", "birthMonth", "birthDay"] as const}
                label="生年月日"
                layout="responsive"
                labelClass={LABEL_CLASS}
                required
                renderInputs={(fields) => [
                  <SelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <SelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <SelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
                ]}
              />
            </Stack>
          </form>
        </Form>
      </Section>

      {/* ManualField（エラー表示確認用） */}
      <Section>
        <SecTitle>ManualField（エラー表示確認）</SecTitle>
        <div className="mt-4 rounded-lg border bg-background p-6">
          <Stack space={6}>
            <ManualField
              label="氏名"
              layout="horizontal"
              labelClass={LABEL_CLASS}
              required
            >
              <Input placeholder="山田 太郎" />
            </ManualField>

            <ManualField
              label="電話番号"
              layout="horizontal"
              labelClass={LABEL_CLASS}
              description={{ text: "ハイフンなしで入力してください", tone: "muted", size: "xs" }}
            >
              <Input placeholder="09012345678" />
            </ManualField>

            <ManualField
              label="備考"
              layout="horizontal"
              labelClass={LABEL_CLASS}
              error="入力内容に誤りがあります"
            >
              <Input placeholder="自由入力" />
            </ManualField>
          </Stack>
        </div>
      </Section>
    </Main>
  );
}
