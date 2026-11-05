// src/components/Form/Field/Configured/customInputs.test.tsx
// 登録された入力部品の解決と、枠あり / 枠なしの描画、枠が描く説明文(helperText)のテスト（遅延を解いた後の出力を見る）。
// 実行: pnpm test:form-inputs
import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import { createElement, type ReactNode } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { FormProvider, useForm } from "react-hook-form";

import type { FieldConfig, FormInputItem, FormInputProps } from "../types";
import { ConfiguredField } from "./ConfiguredField";
import { ConfiguredMediaField } from "./ConfiguredMediaField";
import { ConfiguredMediaMultiField } from "./ConfiguredMediaMultiField";
import { FormInputsProvider, resolveFormInputs } from "./customInputs";

const Part = ({ field, fieldConfig, id, "aria-describedby": describedBy }: FormInputProps) =>
  createElement("x-part", { id, "aria-describedby": describedBy, "data-name": field.name, "data-label": fieldConfig.label });
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

type FormProps = { formInput: string; extra?: Partial<FieldConfig>; description?: { text: string } };

function Form({ formInput, extra, description }: FormProps) {
  const methods = useForm({ defaultValues: { x: "" } });
  const fieldConfig = { name: "x", label: "見出しX", fieldType: "string", formInput, ...extra } as unknown as FieldConfig;
  const props = { control: methods.control, fieldConfig, description };
  return (
    <FormProvider {...methods}>
      {formInput === "mediaUploader" ? (
        <ConfiguredMediaField {...props} methods={methods} onHandleChange={() => {}} />
      ) : formInput === "mediaUploaderMulti" ? (
        <ConfiguredMediaMultiField {...props} methods={methods} onHandleChange={() => {}} />
      ) : (
        <ConfiguredField {...props} />
      )}
    </FormProvider>
  );
}
const renderField = (formInput: string, extra?: Partial<FieldConfig>, description?: { text: string }) =>
  renderAll(
    <FormInputsProvider inputs={INPUTS}>
      <Form formInput={formInput} extra={extra} description={description} />
    </FormInputsProvider>,
  );

/** 説明文の要素の id(無ければ undefined) */
const descriptionId = (html: string, text: string) => new RegExp(`<p[^>]*id="([^"]+)"[^>]*>${text}</p>`).exec(html)?.[1];

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

test("helperText: 組み込みも登録部品(枠あり)も、枠が説明文を描き入力の aria-describedby が指す", async () => {
  for (const formInput of ["textInput", "framed"]) {
    const html = await renderField(formInput, { helperText: "説明あいう" });
    const id = descriptionId(html, "説明あいう");
    assert.ok(id, `${formInput}: 説明文が無い`);
    assert.match(html, new RegExp(`aria-describedby="${id.replace(/[^\w-]/g, "\\$&")}"`), `${formInput}: aria-describedby が説明文を指さない`);
  }
});

test("helperText: props の description があればそちらが優先", async () => {
  const html = await renderField("textInput", { helperText: "設定の説明" }, { text: "画面の説明" });
  assert.ok(descriptionId(html, "画面の説明"));
  assert.doesNotMatch(html, /設定の説明/);
});

test("helperText: 無ければ説明文を描かず、aria-describedby も付けない", async () => {
  const html = await renderField("textInput");
  assert.doesNotMatch(html, /aria-describedby/);
});

test("helperText: メディア(単数・複数)も枠が 1 回だけ描く(uploader の中には描かない)", async () => {
  for (const formInput of ["mediaUploader", "mediaUploaderMulti"]) {
    const html = await renderField(formInput, { helperText: "画像の説明", purpose: "sample.image" });
    assert.ok(descriptionId(html, "画像の説明"), `${formInput}: 枠の説明文が無い`);
    assert.equal(html.split("画像の説明").length - 1, 1, `${formInput}: 説明文が 1 回でない`);
  }
});
