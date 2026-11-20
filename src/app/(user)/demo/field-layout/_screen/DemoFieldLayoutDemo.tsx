// src/app/(user)/demo/field-layout/_screen/DemoFieldLayoutDemo.tsx
// /demo/field-layout のデモ本体(client)。Screen が描く。
"use client";

import { FormProvider as Form, useForm } from "react-hook-form";
import { ControlledField, ControlledFieldGroup } from "@/lib/formSuite";
import { ManualField } from "@/lib/formSuite";
import { ControlledTextInput, ControlledEmailInput, ControlledSelectInput, ControlledTextarea, ControlledDateInput, ControlledNumberInput } from "@/lib/formSuite";
import { Input } from "@/components/Input/Input";
import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Main } from "@/components/Layout/Main";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import type { Options } from "@/components/Input/options";

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

export function DemoFieldLayoutDemo() {
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
            <Stack gap="lg">
              <ControlledField
                control={form.control}
                name="title"
                label="タイトル"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                required
                renderInput={(field) => (
                  <ControlledTextInput field={field} placeholder="イベント名を入力" />
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
                  <ControlledEmailInput field={field} placeholder="example@mail.com" />
                )}
              />

              <ControlledField
                control={form.control}
                name="category"
                label="カテゴリ"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                renderInput={(field) => (
                  <ControlledSelectInput field={field} options={categoryOptions} placeholder="選択してください" />
                )}
              />

              <ControlledField
                control={form.control}
                name="date"
                label="開催日"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                renderInput={(field) => <ControlledDateInput field={field} />}
              />

              <ControlledField
                control={form.control}
                name="description"
                label="詳細"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                description={{ text: "イベントの詳細を記載してください", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <ControlledTextarea field={field} rows={3} placeholder="自由入力" />
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
            <Stack gap="lg">
              <ControlledField
                control={form.control}
                name="title"
                label="タイトル"
                layout="responsive"
                labelClass={LABEL_CLASS}
                required
                renderInput={(field) => (
                  <ControlledTextInput field={field} placeholder="イベント名を入力" />
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
                  <ControlledEmailInput field={field} placeholder="example@mail.com" />
                )}
              />

              <ControlledField
                control={form.control}
                name="category"
                label="カテゴリ"
                layout="responsive"
                labelClass={LABEL_CLASS}
                renderInput={(field) => (
                  <ControlledSelectInput field={field} options={categoryOptions} placeholder="選択してください" />
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
                  <ControlledTextarea field={field} rows={3} placeholder="自由入力" />
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
            <Stack gap="lg">
              {/* 2個パターン（prefix/suffix あり） */}
              <ControlledFieldGroup
                control={form.control}
                names={["startTime", "endTime"] as const}
                label="開催時間"
                layout="horizontal"
                labelClass={LABEL_CLASS}
                inputLayout="horizontal"
                inputConfigs={[
                  { prefix: <Span inline className="w-8">開始</Span>, suffix: "～" },
                  { prefix: <Span inline className="w-8">終了</Span> },
                ]}
                required
                renderInputs={(fields) => [
                  <ControlledTextInput key="start" field={fields[0]} placeholder="00:00" />,
                  <ControlledTextInput key="end" field={fields[1]} placeholder="00:00" />,
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
                  <ControlledSelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <ControlledSelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <ControlledSelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
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
                  <ControlledSelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <ControlledSelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <ControlledSelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
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
                  <ControlledSelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <ControlledSelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <ControlledSelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
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
            <Stack gap="lg">
              {/* layout="responsive" のみ指定（inputLayout は自動で responsive） */}
              <ControlledFieldGroup
                control={form.control}
                names={["birthYear", "birthMonth", "birthDay"] as const}
                label="生年月日"
                layout="responsive"
                labelClass={LABEL_CLASS}
                required
                renderInputs={(fields) => [
                  <ControlledSelectInput key="year" field={fields[0]} options={yearOptions} placeholder="年" />,
                  <ControlledSelectInput key="month" field={fields[1]} options={monthOptions} placeholder="月" />,
                  <ControlledSelectInput key="day" field={fields[2]} options={dayOptions} placeholder="日" />,
                ]}
              />
            </Stack>
          </form>
        </Form>
      </Section>

      {/* ManualField（エラー表示確認用） */}
      <Section>
        <SecTitle>ManualField（エラー表示確認）</SecTitle>
        <Block className="mt-4 rounded-lg border bg-background p-6">
          <Stack gap="lg">
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
        </Block>
      </Section>
    </Main>
  );
}
