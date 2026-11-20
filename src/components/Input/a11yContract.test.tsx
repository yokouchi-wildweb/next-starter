// src/components/Input/a11yContract.test.tsx
// 入力部品の約束: id・aria-describedby・aria-invalid(FormControlA11yProps)を受け、フォーカスされる要素へ付ける。
// 1) src/components/Input の入力部品(単位)を全部歩く(表に無い単位が増えると落ちる)
// 2) 組み込みの formInput を全部、枠(ConfiguredField)に入れて歩く(Controlled 版が枠の値を渡すか)
// 3) 部品を包む core の picker(UserAsyncCombobox / UserAsyncMultiSelect)
// 実行: pnpm test src/components/Input/a11yContract.test.tsx
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { FormProvider, useForm, type FieldValues } from "react-hook-form";

import { BUILTIN_FORM_INPUTS } from "@/lib/domain/fields/formInputs.mjs";
import { UserAsyncCombobox } from "@/features/core/user/components/common/UserAsyncCombobox";
import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";
import type { FieldConfig } from "@/components/Form/Field/types";
import { ConfiguredField } from "@/components/Form/Field/Configured/ConfiguredField";
import { AsyncComboboxInput } from "@/components/Input/AsyncComboboxInput";
import { AsyncMultiSelectInput } from "@/components/Input/AsyncMultiSelectInput";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { BooleanRadioGroupInput } from "@/components/Input/BooleanRadioGroupInput";
import { CheckGroupInput } from "@/components/Input/CheckGroupInput";
import { ColorInput } from "@/components/Input/ColorInput";
import { ColorValueInput } from "@/components/Input/ColorValueInput";
import { ComboboxInput } from "@/components/Input/ComboboxInput";
import { DateInput } from "@/components/Input/DateInput";
import { DatetimeInput } from "@/components/Input/DatetimeInput";
import { FileInput } from "@/components/Input/FileInput";
import { Input } from "@/components/Input/Input";
import { MultiSelectInput } from "@/components/Input/MultiSelectInput";
import { NumberInput } from "@/components/Input/NumberInput";
import { OneTimeCodeInput } from "@/components/Input/OneTimeCodeInput";
import { PasswordInput } from "@/components/Input/PasswordInput";
import { RadioGroupInput } from "@/components/Input/RadioGroupInput";
import { SelectInput } from "@/components/Input/Select";
import { SingleCardCheckbox } from "@/components/Input/SingleCardCheckbox";
import { SwitchInput } from "@/components/Input/SwitchInput";
import { Textarea } from "@/components/Input/Textarea";
import { TimeInput } from "@/components/Input/TimeInput";
import StepperInput from "@/components/Input/StepperInput";

const A11Y = { id: "probe-id", "aria-describedby": "probe-desc", "aria-invalid": true } as const;
const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];
const noop = () => {};
const emptySearch = async () => ({ results: [], total: 0 });

/** フォーカスされる要素(または group の入れ物)の開始タグ */
const FOCUSABLE = /^(input|textarea|select|button)$/;
const GROUP_ROLES = /^(group|radiogroup)$/;

type Kind = "control" | "group";
type Case = { kind: Kind; render: () => ReactElement } | { skip: string };

/** 入力部品の単位(ファイル名・フォルダ名)ごとの描き方。単位を足したらここに足す(足さないとテストが落ちる) */
const UNITS: Record<string, Case> = {
  Input: { kind: "control", render: () => createElement(Input, { ...A11Y }) },
  NumberInput: { kind: "control", render: () => createElement(NumberInput, { ...A11Y, value: 0, onChange: noop }) },
  Textarea: { kind: "control", render: () => createElement(Textarea, { ...A11Y }) },
  DateInput: { kind: "control", render: () => createElement(DateInput, { ...A11Y }) },
  TimeInput: { kind: "control", render: () => createElement(TimeInput, { ...A11Y }) },
  DatetimeInput: { kind: "control", render: () => createElement(DatetimeInput, { ...A11Y }) },
  FileInput: { kind: "control", render: () => createElement(FileInput, { ...A11Y }) },
  PasswordInput: { kind: "control", render: () => createElement(PasswordInput, { ...A11Y, autoComplete: "current-password" }) },
  OneTimeCodeInput: { kind: "control", render: () => createElement(OneTimeCodeInput, { ...A11Y, value: "", onChange: noop }) },
  ColorInput: { kind: "control", render: () => createElement(ColorInput, { ...A11Y }) },
  Select: { kind: "control", render: () => createElement(SelectInput, { ...A11Y, options: OPTIONS, onChange: noop }) },
  ComboboxInput: { kind: "control", render: () => createElement(ComboboxInput, { ...A11Y, options: OPTIONS, onChange: noop }) },
  MultiSelectInput: { kind: "control", render: () => createElement(MultiSelectInput, { ...A11Y, options: OPTIONS, value: [], onChange: noop }) },
  AsyncComboboxInput: {
    kind: "control",
    render: () => createElement(AsyncComboboxInput, { ...A11Y, onChange: noop, searchFn: emptySearch, getOptionFromResult: () => OPTIONS[0] }),
  },
  AsyncMultiSelectInput: {
    kind: "control",
    render: () => createElement(AsyncMultiSelectInput, { ...A11Y, value: [], onChange: noop, searchFn: emptySearch, getOptionFromResult: () => OPTIONS[0] }),
  },
  BooleanCheckboxInput: { kind: "control", render: () => createElement(BooleanCheckboxInput, { ...A11Y, onChange: noop }) },
  SingleCardCheckbox: { kind: "control", render: () => createElement(SingleCardCheckbox, { ...A11Y, label: "L", onChange: noop }) },
  SwitchInput: { kind: "control", render: () => createElement(SwitchInput, { ...A11Y, onChange: noop }) },
  StepperInput: { kind: "control", render: () => createElement(StepperInput, { ...A11Y }) },
  RadioGroupInput: { kind: "group", render: () => createElement(RadioGroupInput, { ...A11Y, options: OPTIONS, onChange: noop }) },
  BooleanRadioGroupInput: { kind: "group", render: () => createElement(BooleanRadioGroupInput, { ...A11Y, onChange: noop }) },
  CheckGroupInput: { kind: "group", render: () => createElement(CheckGroupInput, { ...A11Y, options: OPTIONS, onChange: noop }) },
  ColorValueInput: { kind: "group", render: () => createElement(ColorValueInput, { ...A11Y }) },
};

/** id="probe-id" を持つ要素の開始タグを見て、約束を満たすかを返す(満たせば null) */
function checkTriple(html: string, kind: Kind, id: string = A11Y.id): string | null {
  const m = new RegExp(`<([a-z]+)((?:[^>](?!\\bid="))*[^>]*\\bid="${id}"[^>]*)>`).exec(html);
  if (!m) return `id="${id}" の要素が無い`;
  const [, tag, attrs] = m;
  const role = /\brole="([^"]+)"/.exec(attrs)?.[1] ?? "";
  if (kind === "control" && !FOCUSABLE.test(tag) && !/\btabindex="0"/.test(attrs)) return `id がフォーカスされない <${tag}> に付いている`;
  if (kind === "group" && !GROUP_ROLES.test(role) && !FOCUSABLE.test(tag)) return `group の入れ物に role が無い (<${tag} role="${role}">)`;
  if (!/\baria-describedby="[^"]+"/.test(attrs)) return `<${tag}> に aria-describedby が無い`;
  if (!/\baria-invalid="true"/.test(attrs)) return `<${tag}> に aria-invalid が無い`;
  return null;
}

/** src/components/Input にあって入力部品ではない単位(表に載せない理由) */
const NOT_INPUTS: Record<string, string> = {
  Label: "ラベル。入力を持たない",
  FilePickButton: "ボタンの形のファイル選択(枠に入れない)",
  TimeFields: "TimeInput・DatetimeInput の中の部品",
  AsyncOptionSource: "非同期の候補の取得の土台(部品ではない)",
  options: "選択肢の型と関数",
};

/** このフォルダの単位: テストでない .tsx と、_ で始まらないフォルダ */
function listUnits(): string[] {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return readdirSync(here)
    .filter((name) => {
      if (name.startsWith("_")) return false;
      if (statSync(join(here, name)).isDirectory()) return true;
      return name.endsWith(".tsx") && !name.includes(".test.");
    })
    .map((name) => name.replace(/\.tsx$/, ""))
    .sort();
}

test("Input: 単位は全部、表(UNITS)か NOT_INPUTS に載っている", () => {
  const listed = [...Object.keys(UNITS), ...Object.keys(NOT_INPUTS)].sort();
  assert.deepEqual(listed, listUnits(), "単位を足したら UNITS に描き方を足す(入力でなければ NOT_INPUTS に理由を足す)");
});

test("Input: 各部品が id・aria-describedby・aria-invalid をフォーカスされる要素へ付ける", () => {
  const failures: string[] = [];
  for (const [name, c] of Object.entries(UNITS)) {
    if ("skip" in c) continue;
    const problem = checkTriple(renderToString(c.render()), c.kind);
    if (problem) failures.push(`${name}: ${problem}`);
  }
  assert.deepEqual(failures, []);
});

/** 組み込みの formInput ごとの期待。種別を足したらここに足す */
const BUILTIN: Record<string, { kind: Kind } | { skip: string }> = {
  textInput: { kind: "control" },
  numberInput: { kind: "control" },
  textarea: { kind: "control" },
  select: { kind: "control" },
  multiSelect: { kind: "control" },
  combobox: { kind: "control" },
  radio: { kind: "group" },
  checkbox: { kind: "group" },
  dateInput: { kind: "control" },
  timeInput: { kind: "control" },
  datetimeInput: { kind: "control" },
  emailInput: { kind: "control" },
  passwordInput: { kind: "control" },
  colorInput: { kind: "control" },
  colorValueInput: { kind: "group" },
  stepperInput: { skip: "枠を持たない(ラベルを自分で描く)" },
  switchInput: { skip: "枠を持たない(ラベルと説明を自分で描く)" },
  mediaUploader: { skip: "lib/mediaInputSuite の部品。枠の id は uploader の入れ物に付く" },
  mediaUploaderMulti: { skip: "lib/mediaInputSuite の部品。枠の id は uploader の入れ物に付く" },
  hidden: { skip: "画面に出ない" },
  none: { skip: "何も描かない" },
  custom: { skip: "画面ごとの差し込み(登録部品は form-inputs のテスト)" },
  asyncCombobox: { skip: "FieldRenderer 経由だけ。部品は上の AsyncComboboxInput で確かめる" },
  asyncMultiSelect: { skip: "FieldRenderer 経由だけ。部品は上の AsyncMultiSelectInput で確かめる" },
};

function Framed({ formInput }: { formInput: string }) {
  const multi = formInput === "checkbox" || formInput === "multiSelect";
  const methods = useForm<FieldValues>({
    defaultValues: { x: multi ? [] : "" },
    errors: { x: { type: "manual", message: "エラー" } },
  });
  const fieldConfig = { name: "x", label: "L", fieldType: multi ? "array" : "string", formInput, helperText: "説明", options: OPTIONS } as unknown as FieldConfig;
  return (
    <FormProvider {...methods}>
      <ConfiguredField control={methods.control} fieldConfig={fieldConfig} />
    </FormProvider>
  );
}

test("組み込みの formInput: 種別は全部、表に載っている", () => {
  assert.deepEqual(Object.keys(BUILTIN).sort(), [...BUILTIN_FORM_INPUTS].sort(), "種別を足したら BUILTIN に期待を足す");
});

test("組み込みの formInput: 枠の id・説明文・エラーがフォーカスされる要素へ届く", () => {
  const failures: string[] = [];
  for (const [formInput, c] of Object.entries(BUILTIN)) {
    if ("skip" in c) continue;
    const html = renderToString(createElement(Framed, { formInput }));
    const id = /<label[^>]*\bfor="([^"]+)"/.exec(html)?.[1];
    if (!id) {
      failures.push(`${formInput}: ラベルの for が無い`);
      continue;
    }
    const problem = checkTriple(html, c.kind, id);
    if (problem) failures.push(`${formInput}: ${problem}`);
  }
  assert.deepEqual(failures, []);
});

test("core の picker: UserAsyncCombobox / UserAsyncMultiSelect も 3 つを渡す", () => {
  const failures: string[] = [];
  const cases: [string, ReactElement][] = [
    ["UserAsyncCombobox", createElement(UserAsyncCombobox, { ...A11Y, onChange: noop })],
    ["UserAsyncMultiSelect", createElement(UserAsyncMultiSelect, { ...A11Y, value: [], onChange: noop })],
  ];
  for (const [name, element] of cases) {
    const problem = checkTriple(renderToString(element), "control");
    if (problem) failures.push(`${name}: ${problem}`);
  }
  assert.deepEqual(failures, []);
});
