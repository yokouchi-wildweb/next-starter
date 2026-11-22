// src/domains/core/messaging/hooks/useLayoutFieldsForm.ts
// レイアウトの欄の中身のフォーム(D123)。部品 LayoutFields に control と fields を渡して描く。
// - 検査 = lib の layoutValuesSchema(layout, {channels})(知らない鍵・型・必須。送らない送信チャンネルだけの欄は必須にしない)
// - 初めの値 = 渡した values を欄ごとの空の値に重ねた物。レイアウトか values が替わると作り直す(resetTo で呼び手が明示的にも戻せる)
// - readOnly はそのまま返す(システムのテンプレート・固定の文。部品に渡す)
// values は呼び手が安定した参照で渡す(SWR の値・useMemo)。毎回作った object を渡すと替わるたびに入力が戻る

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { layoutValuesSchema, type MessageLayout, type MessageLayoutFields } from "@/lib/messaging";

import { emptyValueOf } from "@/domains/core/messaging/components/common/LayoutFields";

export type LayoutFieldsValues = Record<string, unknown>;

export type UseLayoutFieldsFormOptions = {
  /** レイアウト(欄の宣言を持つ物。無い = 欄なし) */
  layout?: Pick<MessageLayout, "key" | "fields"> | null;
  /** 今の中身(保存した値・送信の values) */
  values?: Readonly<Record<string, unknown>> | null;
  /** 使う送信チャンネルの鍵(渡すと、どれにも使われない送信チャンネルだけの欄は必須でなくなる) */
  channels?: readonly string[];
  readOnly?: boolean;
};

const NO_FIELDS: MessageLayoutFields = {};

/** 欄ごとの空の値に今の中身を重ねる(宣言に無い鍵は捨てる) */
export function layoutFieldsDefaults(fields: MessageLayoutFields, values?: Readonly<Record<string, unknown>> | null): LayoutFieldsValues {
  return Object.fromEntries(
    Object.entries(fields).map(([key, spec]) => [key, values && values[key] !== undefined ? values[key] : emptyValueOf(spec)]),
  );
}

export function useLayoutFieldsForm({ layout, values, channels, readOnly = false }: UseLayoutFieldsFormOptions) {
  const fields = layout?.fields ?? NO_FIELDS;
  const channelsKey = channels?.join(",") ?? "";
  // layoutValuesSchema が読むのは fields だけ(レイアウトの残りは client に来ない)
  const schema = useMemo(
    () => layoutValuesSchema({ fields } as MessageLayout, channelsKey ? { channels: channelsKey.split(",") } : {}),
    [fields, channelsKey],
  );
  const resolver = useMemo(() => zodResolver(schema), [schema]);
  const defaults = useMemo(() => layoutFieldsDefaults(fields, values), [fields, values]);

  const form = useForm<LayoutFieldsValues>({ resolver, mode: "onSubmit", shouldUnregister: false, defaultValues: defaults });

  // レイアウト・中身が替わったら作り直す(form.reset は外の仕組みへの同期。React の state は触らない)
  const { reset } = form;
  useEffect(() => {
    reset(defaults);
  }, [reset, defaults]);

  /** 別のレイアウト・中身に戻す(レイアウトを替えて中身を消す時など) */
  const resetTo = useCallback(
    (nextFields: MessageLayoutFields, nextValues?: Readonly<Record<string, unknown>> | null) => reset(layoutFieldsDefaults(nextFields, nextValues)),
    [reset],
  );

  return { form, control: form.control, fields, channels, readOnly, resetTo };
}
