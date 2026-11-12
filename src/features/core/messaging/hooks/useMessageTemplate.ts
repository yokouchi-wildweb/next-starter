"use client";

// src/features/core/messaging/hooks/useMessageTemplate.ts
//
// 管理: テンプレート 1 件と画面の選択肢(SWR)。保存・公開・取り下げ(useMessageTemplateForm)が 1 件を再検証する

import useSWR from "swr";

import {
  getMessageTemplate,
  getMessageTemplateOptions,
  type AdminTemplateDetail,
  type AdminTemplateOptions,
} from "../services/client/templateClient";

import { MESSAGE_TEMPLATE_OPTIONS_KEY, messageTemplateKey } from "./templateKeys";

export function useMessageTemplate(id: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<AdminTemplateDetail>(id ? messageTemplateKey(id) : null, () =>
    getMessageTemplate(id!),
  );
  return { template: data ?? null, error, isLoading, revalidate: () => mutate() };
}

/** 画面の選択肢(使える経路・種類・変数の前から使える {{鍵}}) */
export function useMessageTemplateOptions() {
  const { data, error, isLoading } = useSWR<AdminTemplateOptions>(MESSAGE_TEMPLATE_OPTIONS_KEY, () =>
    getMessageTemplateOptions(),
  );
  return { options: data ?? null, error, isLoading };
}
