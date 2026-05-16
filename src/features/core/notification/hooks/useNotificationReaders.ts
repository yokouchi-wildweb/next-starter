// src/features/core/notification/hooks/useNotificationReaders.ts
// 通知の既読ユーザー一覧をページング取得するフック（管理画面の詳細モーダル用）

"use client";

import useSWR, { type SWRConfiguration } from "swr";

import type { HttpError } from "@/lib/errors";
import {
  notificationClient,
  type GetReadersResponse,
} from "../services/client/notificationClient";

export type UseNotificationReadersParams = {
  page?: number;
  limit?: number;
};

export const useNotificationReaders = (
  notificationId: string | null,
  { page = 1, limit = 20 }: UseNotificationReadersParams = {},
  config?: SWRConfiguration<GetReadersResponse, HttpError>,
) => {
  const key = notificationId
    ? `notification:${notificationId}:readers:page=${page}:limit=${limit}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<GetReadersResponse, HttpError>(
    key,
    () => notificationClient.getReaders(notificationId!, { page, limit }),
    config,
  );

  return {
    readers: data?.readers ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
};
