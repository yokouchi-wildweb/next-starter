// src/features/notification/services/client/notificationClient.ts

import axios from "axios";
import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import { normalizeHttpError } from "@/lib/errors";
import type { Notification } from "@/features/notification/entities";
import type {
  NotificationCreateFields,
  NotificationUpdateFields,
} from "@/features/notification/entities/form";

const baseClient: ApiClient<
  Notification,
  NotificationCreateFields,
  NotificationUpdateFields
> = createApiClient<
  Notification,
  NotificationCreateFields,
  NotificationUpdateFields
>("/api/notification");

// ============================================================================
// 既読ユーザー一覧（管理画面の詳細モーダル用）
// ============================================================================

/** 既読ユーザー1件分のレスポンス */
export type NotificationReaderRow = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  /** JSON 経由のため ISO 文字列で返る */
  readAt: string;
};

export type GetReadersResponse = {
  readers: NotificationReaderRow[];
  total: number;
};

export type GetReadersParams = {
  page?: number;
  limit?: number;
};

async function getReaders(
  notificationId: string,
  params: GetReadersParams = {},
): Promise<GetReadersResponse> {
  try {
    const res = await axios.get<GetReadersResponse>(
      `/api/notification/${notificationId}/readers`,
      { params },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "既読ユーザーの取得に失敗しました");
  }
}

export const notificationClient = {
  ...baseClient,
  getReaders,
};
