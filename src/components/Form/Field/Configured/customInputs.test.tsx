// src/components/Form/Field/Configured/customInputs.test.tsx
// 登録された入力部品の解決と、枠あり / 枠なしの描画のテスト（遅延を解いた後の出力を見る）。
// 実行: pnpm test:form-inputs
import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import { createElement, type ReactNode } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { FormProvider, useForm } from "react-hook-form";

import type { FieldConfig, FormInputItem, FormInputProps } from "../types";
import { ConfiguredField } from "./ConfiguredField";
import { FormInputsProvider, resolveFormInputs } from "./customInputs";

const Part = ({ field, fieldConfig, id }: FormInputProps) => createElement("x-part", { id, "data-name": field.name, "data-label": fieldConfig.label });
const load = async () => ({ default: Part });
const INPUTS: Record<string, FormInputItem> = {
  framed: { name: "framed", load },
  bare: { name: "bare", load, frame: false },
};

/** Suspense を待って HTML を返す */
const renderAll = (node: ReactNode) =>
  new Promise<string>((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk, _encoding, done) {
        html += chunk.toString();
        done();
      },
      final(done) {
        resolve(html);
        done();
      },
    });
    const { pipe } = renderToPipeableStream(node, { onAllReady: () => pipe(sink), onError: reject });
  });

function Form({ formInput }: { formInput: string }) {
  const methods = useForm({ defaultValues: { x: "" } });
  const fieldConfig = { name: "x", label: "見出しX", fieldType: "string", formInput } as unknown as FieldConfig;
  return (
    <FormProvider {...methods}>
      <ConfiguredField control={methods.control} fieldConfig={fieldConfig} />
    </FormProvider>
  );
}
const renderField = (formInput: string) =>
  renderAll(
    <FormInputsProvider inputs={INPUTS}>
      <Form formInput={formInput} />
    </FormInputsProvider>,
  );

test("resolveFormInputs: 項目ごとに部品を持ち、項目の値を保つ", () => {
  const resolved = resolveFormInputs(INPUTS);
  assert.deepEqual(Object.keys(resolved), ["framed", "bare"]);
  assert.equal(resolved.bare.frame, false);
  assert.ok(resolved.framed.Part);
});

test("枠あり: 共通のラベルと部品を描き、FormControl の id が部品へ届く", async () => {
  const html = await renderField("framed");
  assert.match(html, /<x-part[^>]*data-name="x"/);
  assert.match(html, /<label[^>]*>[^<]*(<[^>]*>)*見出しX/);
  const id = /<x-part[^>]*id="([^"]+)"/.exec(html)?.[1];
  assert.ok(id);
  assert.match(html, new RegExp(`<label[^>]*for="${id.replace(/[^\w-]/g, "\\$&")}"`));
});

test("枠なし: ラベルを描かず部品だけ。fieldConfig は部品へ届く", async () => {
  const html = await renderField("bare");
  assert.match(html, /<x-part[^>]*data-label="見出しX"/);
  assert.doesNotMatch(html, /<label/);
});

test("組み込みは今のまま、未知の名前は何も描かない", async () => {
  assert.match(await renderField("textInput"), /<input/);
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.doesNotMatch(await renderField("nobodyInput"), /<input|x-part/);
  } finally {
    console.warn = warn;
  }
});
