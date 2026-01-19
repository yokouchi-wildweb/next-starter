"use client";

import { useForm } from "react-hook-form";
import { Form } from "@/components/_shadcn/form";
import { FieldItem } from "@/components/Form";
import { ManualFieldItem } from "@/components/Form/Field/Manual";
import {
  TextInput,
  EmailInput,
  SelectInput,
  Textarea,
  DateInput,
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

type DemoFormValues = {
  title: string;
  email: string;
  category: string;
  date: string;
  description: string;
};

const LABEL_WIDTH = "120px";

export default function FieldLayoutDemoPage() {
  const form = useForm<DemoFormValues>({
    defaultValues: {
      title: "",
      email: "",
      category: "",
      date: "",
      description: "",
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
              <FieldItem
                control={form.control}
                name="title"
                label="タイトル"
                layout="horizontal"
                labelWidth={LABEL_WIDTH}
                required
                renderInput={(field) => (
                  <TextInput field={field} placeholder="イベント名を入力" />
                )}
              />

              <FieldItem
                control={form.control}
                name="email"
                label="メール"
                layout="horizontal"
                labelWidth={LABEL_WIDTH}
                required
                description={{ text: "連絡先として使用します", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <EmailInput field={field} placeholder="example@mail.com" />
                )}
              />

              <FieldItem
                control={form.control}
                name="category"
                label="カテゴリ"
                layout="horizontal"
                labelWidth={LABEL_WIDTH}
                renderInput={(field) => (
                  <SelectInput field={field} options={categoryOptions} placeholder="選択してください" />
                )}
              />

              <FieldItem
                control={form.control}
                name="date"
                label="開催日"
                layout="horizontal"
                labelWidth={LABEL_WIDTH}
                renderInput={(field) => <DateInput field={field} />}
              />

              <FieldItem
                control={form.control}
                name="description"
                label="詳細"
                layout="horizontal"
                labelWidth={LABEL_WIDTH}
                description={{ text: "イベントの詳細を記載してください", tone: "muted", size: "xs" }}
                renderInput={(field) => (
                  <Textarea field={field} rows={3} placeholder="自由入力" />
                )}
              />
            </Stack>
          </form>
        </Form>
      </Section>

      {/* ManualFieldItem（エラー表示確認用） */}
      <Section>
        <SecTitle>ManualFieldItem（エラー表示確認）</SecTitle>
        <div className="mt-4 rounded-lg border bg-background p-6">
          <Stack space={6}>
            <ManualFieldItem
              label="氏名"
              layout="horizontal"
              labelWidth={LABEL_WIDTH}
              required
            >
              <Input placeholder="山田 太郎" />
            </ManualFieldItem>

            <ManualFieldItem
              label="電話番号"
              layout="horizontal"
              labelWidth={LABEL_WIDTH}
              description={{ text: "ハイフンなしで入力してください", tone: "muted", size: "xs" }}
            >
              <Input placeholder="09012345678" />
            </ManualFieldItem>

            <ManualFieldItem
              label="備考"
              layout="horizontal"
              labelWidth={LABEL_WIDTH}
              error="入力内容に誤りがあります"
            >
              <Input placeholder="自由入力" />
            </ManualFieldItem>
          </Stack>
        </div>
      </Section>
    </Main>
  );
}
