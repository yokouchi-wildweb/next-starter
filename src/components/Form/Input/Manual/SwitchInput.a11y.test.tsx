// src/components/Form/Input/Manual/SwitchInput.a11y.test.tsx
// SwitchInput の読み上げ: label の文字は読み上げの対象(aria-hidden の外)に 1 回だけ、input の名前は見える文字から、
// 押す場所のトラック(label)は読み上げから外れていて名前の無い label を残さない。label が無いときも同じ形。
// 実際のスクリーンリーダーではなく、描いた DOM の読み上げの対象を数える。
// 実行: pnpm test src/components/Form/Input/Manual/SwitchInput.a11y.test.tsx
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { SwitchInput } from "./SwitchInput";

const noop = () => {};
const render = (props: Record<string, unknown>) =>
  new JSDOM(`<body>${renderToString(createElement(SwitchInput, { name: "notify", onChange: noop, ...props }))}</body>`).window.document;

/** aria-hidden="true" の祖先(自分を含む)があるか */
const hidden = (node: Node | null): boolean => {
  for (let el = node?.nodeType === 1 ? (node as Element) : node?.parentElement; el; el = el.parentElement) {
    if (el.getAttribute("aria-hidden") === "true") return true;
  }
  return false;
};

/** 読み上げの対象の文字(aria-hidden の外の文字の節を順に) */
const exposedText = (doc: Document) => {
  const walker = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!hidden(n) && n.textContent?.trim()) parts.push(n.textContent.trim());
  return parts;
};

test("label あり: 文字は読み上げの対象に 1 回だけ、input の名前は見える文字、トラックは読み上げの外", () => {
  const doc = render({ label: "通知を受け取る", description: "メールで届きます" });
  assert.deepEqual(exposedText(doc).filter((t) => t === "通知を受け取る"), ["通知を受け取る"]);

  const input = doc.querySelector("input")!;
  const names = (input.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => doc.getElementById(id)?.textContent);
  assert.deepEqual(names, ["通知を受け取る"]);
  assert.equal(doc.getElementById(input.getAttribute("aria-describedby")!)?.textContent, "メールで届きます");

  const labels = [...doc.querySelectorAll("label")];
  assert.equal(labels.length, 1);
  assert.equal(labels[0].getAttribute("for"), input.id, "トラックは押すと input が切り替わる");
  assert.ok(hidden(labels[0]), "トラックは読み上げの外");
  // aria-hidden は押せることを変えない: トラックを押すと input が切り替わる
  const before = input.checked;
  labels[0].click();
  assert.equal(input.checked, !before);
});

test("label なし: 読み上げの対象に名前の無い label を残さず、渡した aria-labelledby はそのまま", () => {
  const doc = render({ "aria-labelledby": "outer-title" });
  assert.deepEqual(exposedText(doc), []);
  assert.equal(doc.querySelector("input")!.getAttribute("aria-labelledby"), "outer-title");
  for (const label of doc.querySelectorAll("label")) assert.ok(hidden(label));
});
