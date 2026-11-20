// .notices/20261120-160000-shelf-s2.shelf.test.mjs
// codemod shelf-s2 shelf: 分けるモジュール(残る名前あり / なし)・深いファイルの名前の分割・名前空間(Manual.X)・相対の指定・型だけ・
// default → 名前付き・止める所・手で直す所・fork のファイルの移動と重なり・何度走らせても同じ
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { apply, emitSpecifier, mapModule, plan, resolveSpecifier, rewriteSource } from "./20261120-160000-shelf-s2.shelf.mjs";

const repo = (files) => {
  const root = mkdtempSync(path.join(tmpdir(), "shelf-s2-shelf-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
};

test("道: 動いたモジュールと、相対は同じ分類の中だけ相対", () => {
  assert.deepEqual(resolveSpecifier("src/components/Form/Field/x.tsx", "../Input/Manual/Select"), { mod: "src/components/Form/Input/Manual/Select", suffix: "" });
  assert.equal(mapModule("src/components/Form/Button/button-variants").to, "src/components/Button/variants");
  assert.equal(mapModule("src/components/Form/Button/LinkButton").to, "src/components/Button/LinkButton");
  assert.equal(mapModule("src/components/Form/Input/Manual/AsyncOptionSource/popoverSide").to, "src/components/Input/AsyncOptionSource/popoverSide");
  assert.equal(mapModule("src/components/Form/Label").to, "src/components/Input/Label");
  assert.equal(mapModule("src/components/Form/AppForm").to, "src/lib/formSuite");
  assert.equal(mapModule("src/components/Form/Field/Configured/ConfiguredField").to, "src/lib/formSuite");
  assert.equal(mapModule("src/components/Form/MediaHandler/useMediaUploaderField").to, "src/lib/mediaInputSuite");
  assert.equal(mapModule("src/components/Layout/Block"), null);
  assert.equal(emitSpecifier("../Select", "src/components/Input/MultiSelectInput/index.tsx", "src/components/Input/Select"), "../Select");
  assert.equal(emitSpecifier("../Input/Manual/Select", "src/components/Form/Field/x.tsx", "src/components/Input/Select"), "@/components/Input/Select");
});

test("Form の入口: 名前ごとに行き先へ分け、残りは @/lib/formSuite の入口へ", () => {
  const src = 'import { AppForm, Label, type Options, Button, buttonVariants, ControlledField } from "@/components/Form";';
  const { text, stops } = rewriteSource("src/app/x.tsx", src);
  assert.deepEqual(stops, []);
  assert.equal(
    text,
    [
      'import { AppForm, ControlledField } from "@/lib/formSuite";',
      'import { Label } from "@/components/Input/Label";',
      'import { type Options } from "@/components/Input/options";',
      'import { Button } from "@/components/Button/Button";',
      'import { buttonVariants } from "@/components/Button/variants";',
    ].join("\n"),
  );
  const multi = 'import {\n  AppForm,\n  ControlledMediaInput,\n} from "@/components/Form";';
  assert.equal(
    rewriteSource("src/app/x.tsx", multi).text,
    'import { AppForm } from "@/lib/formSuite";\nimport { ControlledMediaInput } from "@/lib/mediaInputSuite";',
    "MediaHandler の名前は mediaInputSuite へ",
  );
});

test("深いファイルの名前の分割: Button の buttonVariants・TabletButton の tabletButtonVariants は variants へ、ほかは単位へ", () => {
  const src = [
    'import { Button, buttonVariants, type ButtonProps } from "@/components/Form/Button/Button";',
    'import { TabletButton, tabletButtonVariants } from "@/components/Form/Button/TabletButton";',
    'import { tabletButtonVariants as tv } from "@/components/Form/Button/tablet-button-variants";',
  ].join("\n");
  const { text } = rewriteSource("src/app/x.tsx", src);
  assert.equal(
    text,
    [
      'import { Button, type ButtonProps } from "@/components/Button/Button";',
      'import { buttonVariants } from "@/components/Button/variants";',
      'import { TabletButton } from "@/components/Button/TabletButton";',
      'import { tabletButtonVariants } from "@/components/Button/variants";',
      'import { tabletButtonVariants as tv } from "@/components/Button/variants";',
    ].join("\n"),
  );
});

test("Manual の入口と default の部品: StepperInput は default の import、型だけの文はそのまま型だけ", () => {
  const src = [
    'import { Input, StepperInput, SelectInput } from "@/components/Form/Input/Manual";',
    'import type { SwitchInputProps, NumberInputProps } from "@/components/Form/Input/Manual";',
  ].join("\n");
  const { text } = rewriteSource("src/app/x.tsx", src);
  assert.equal(
    text,
    [
      'import { Input } from "@/components/Input/Input";',
      'import StepperInput from "@/components/Input/StepperInput";',
      'import { SelectInput } from "@/components/Input/Select";',
      'import type { SwitchInputProps } from "@/components/Input/SwitchInput";',
      'import type { NumberInputProps } from "@/components/Input/NumberInput";',
    ].join("\n"),
  );
});

test("名前空間: { Manual } の Manual.X(JSX の開き・閉じ・式)を X に、Controlled.X は formSuite の ControlledX に直す", () => {
  const src = [
    'import { Controlled, Manual } from "@/components/Form/Input";',
    "export const A = () => <Manual.Textarea rows={2}>{Manual.Input.name}</Manual.Textarea>;",
    "export const B = () => <Controlled.TextInput />;",
  ].join("\n");
  const { text, stops } = rewriteSource("src/app/x.tsx", src);
  assert.deepEqual(stops, []);
  assert.equal(
    text,
    [
      'import { ControlledTextInput } from "@/lib/formSuite";',
      'import { Textarea } from "@/components/Input/Textarea";',
      'import { Input } from "@/components/Input/Input";',
      "export const A = () => <Textarea rows={2}>{Input.name}</Textarea>;",
      "export const B = () => <ControlledTextInput />;",
    ].join("\n"),
  );
});

test("名前空間: import * as M も直す。外すと名前が重なるなら書かずに止める", () => {
  const star = rewriteSource("src/components/Form/x.test.tsx", 'import * as M from "@/components/Form/Input/Manual";\nconst x = [M.SwitchInput, M.DateInput];');
  assert.equal(star.text, 'import { SwitchInput } from "@/components/Input/SwitchInput";\nimport { DateInput } from "@/components/Input/DateInput";\nconst x = [SwitchInput, DateInput];');
  const src = 'import { Manual } from "@/components/Form/Input";\nimport { Input } from "./MyInput";\nexport const A = () => <Manual.Input />;';
  const { text, stops } = rewriteSource("src/app/x.tsx", src);
  assert.equal(text, src);
  assert.equal(stops.length, 1);
  assert.match(stops[0], /^1: Input がこのファイルで既に使われている/);
});

test("相対の指定: 分類の中は相対のまま、分類の外へ出たら @/。BookmarkTag の default は名前付きに", () => {
  const field = rewriteSource("src/components/Form/Field/X.tsx", 'import { SelectInput } from "../Input/Manual/Select";\nimport type { Options } from "../types";');
  assert.equal(field.text, 'import { SelectInput } from "@/components/Input/Select";\nimport type { Options } from "@/components/Input/options";');
  const tag = rewriteSource("src/app/x.tsx", 'import Tag from "@/components/Form/Button/BookmarkTag";');
  assert.equal(tag.text, 'import { BookmarkTag as Tag } from "@/components/Button/BookmarkTag";');
});

test("止める・手で: 表にない名前・default の無い入口は止め、mock.module・export * は hand", () => {
  const src = [
    'import { NotThere } from "@/components/Form/Input/Manual";',
    'import Form from "@/components/Form/Button";',
    'mock.module("@/components/Form/Button", { namedExports: {} });',
    'export * from "@/components/Form/utils";',
  ].join("\n");
  const { text, stops, hands } = rewriteSource("src/app/x.test.tsx", src);
  assert.equal(text, src);
  assert.equal(stops.length, 2);
  assert.equal(hands.length, 2);
});

test("formSuite: 深い Field の道・相対の指定は入口 1 本へ、Field/types の入力の型は Input/options へ、MediaHandler は mediaInputSuite へ", () => {
  const deep = rewriteSource(
    "src/features/x/components/X.tsx",
    'import type { FieldConfig, FormControlA11yProps } from "@/components/Form/Field/types";\nimport { ConfiguredField } from "@/components/Form/Field/Configured/ConfiguredField";\nimport { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";',
  );
  assert.equal(
    deep.text,
    [
      'import type { FieldConfig } from "@/lib/formSuite";',
      'import type { FormControlA11yProps } from "@/components/Input/options";',
      'import { ConfiguredField } from "@/lib/formSuite";',
      'import { useMediaUploaderField } from "@/lib/mediaInputSuite";',
    ].join("\n"),
  );
  const rel = rewriteSource("src/components/Form/Field/Manual/X.tsx", 'import { submitLock } from "../../submitLock";');
  assert.equal(rel.text, 'import { submitLock } from "@/lib/formSuite";');
});

test("Controlled の入力: 名前付きの import は使う所ごと ControlledX に、同じ名前が既にあれば as で元の名前", () => {
  const src = [
    'import { TextInput, type ControlledSelectInputProps } from "@/components/Form/Input/Controlled";',
    "export const A = () => <TextInput name=\"a\" />;",
    "const m = { TextInput: 1 };",
  ].join("\n");
  assert.equal(
    rewriteSource("src/app/x.tsx", src).text,
    [
      'import { ControlledTextInput, type ControlledSelectInputProps } from "@/lib/formSuite";',
      "export const A = () => <ControlledTextInput name=\"a\" />;",
      "const m = { TextInput: 1 };",
    ].join("\n"),
  );
  const clash = rewriteSource("src/app/x.tsx", 'import { SelectInput } from "@/components/Form/Input/Controlled/SelectInput";\nconst ControlledSelectInput = 1;\nexport const A = () => <SelectInput />;');
  assert.ok(clash.text.startsWith('import { ControlledSelectInput as SelectInput } from "@/lib/formSuite";'), clash.text);
  assert.ok(clash.text.includes("<SelectInput />"));
});

test("行き先の入口が出していない名前は書かずに STOP(入口がこの木にあるときだけ確かめる)", () => {
  const exportsOf = (mod) => (mod === "src/lib/formSuite" ? new Set(["AppForm"]) : null);
  const src = 'import { AppForm, Missing } from "@/components/Form";\nimport { Gone } from "@/components/Form/AutoSave";';
  const { text, stops } = rewriteSource("src/app/x.tsx", src, { exportsOf });
  assert.equal(text, src);
  assert.equal(stops.length, 2);
  assert.match(stops[0], /Missing が無い/);
  assert.match(stops[1], /Gone が無い/);
});

test("plan と apply: 書き換え・fork のファイルの移動(相対を引き直す)・文書は一覧だけ、2 回目は変えるものなし", () => {
  const root = repo({
    "src/app/page.tsx": 'import { Button } from "@/components/Form/Button";\nimport { Manual } from "@/components/Form/Input";\nexport const P = () => <Manual.Input />;\n',
    "src/components/Form/Input/Manual/RangeInput.tsx": 'import { Input } from "./Input";\nimport { toggleOptionValue } from "../../utils";\nexport const RangeInput = Input;\n',
    "src/components/Input/Input.tsx": "export const Input = 1;\n",
    "src/components/Input/options/index.ts": "export const toggleOptionValue = 1;\n",
    "src/features/shop/README.md": "`@/components/Form/Button/Button` を使う\n",
  });
  const first = plan(root);
  assert.deepEqual(first.stops, []);
  assert.deepEqual(first.moves, [{ from: "src/components/Form/Input/Manual/RangeInput.tsx", to: "src/components/Input/RangeInput.tsx" }]);
  assert.deepEqual(first.hands.map((h) => `${h.file}:${h.line}`), ["src/features/shop/README.md:1"]);
  apply(root, first);
  assert.equal(
    readFileSync(path.join(root, "src/app/page.tsx"), "utf8"),
    'import { Button } from "@/components/Button/Button";\nimport { Input } from "@/components/Input/Input";\nexport const P = () => <Input />;\n',
  );
  const range = readFileSync(path.join(root, "src/components/Input/RangeInput.tsx"), "utf8");
  assert.ok(range.includes('from "./Input"'), range);
  assert.ok(range.includes('from "./options"'), range);
  assert.ok(!existsSync(path.join(root, "src/components/Form/Input/Manual/RangeInput.tsx")));
  const second = plan(root);
  assert.equal(second.rewrites.length + second.moves.length + second.stops.length, 0);
});

test("止める: Form に残った fork のファイル(行き先が閉じた lib)", () => {
  const root = repo({ "src/components/Form/SaveControl.tsx": "export const SaveControl = 1;\n" });
  const result = plan(root);
  assert.deepEqual(result.stops.map((s) => s.file), ["src/components/Form/SaveControl.tsx"]);
});

test("止める: 行き先に同じ名がある fork のファイルは動かさない", () => {
  const root = repo({
    "src/components/Form/Button/SaveButton.tsx": "export const SaveButton = 'fork';\n",
    "src/components/Button/SaveButton.tsx": "export const SaveButton = 'upstream';\n",
  });
  const result = plan(root);
  assert.deepEqual(result.moves, []);
  assert.deepEqual(result.stops.map((s) => s.file), ["src/components/Form/Button/SaveButton.tsx"]);
});
