// src/features/core/notification/services/server/notification/getReadersWithUsers.ts
// 指定通知の既読ユーザー一覧をユーザー情報付きでページング取得する。
// 管理画面の詳細モーダル（誰が既読にしたかを表示するセクション）で利用する。

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";
import { UserTable } from "@/features/core/user/entities/drizzle";

export type NotificationReader = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  readAt: Date;
};

export type GetReadersWithUsersResult = {
  readers: NotificationReader[];
  total: number;
};

export type GetReadersWithUsersOptions = {
  page?: number;
  limit?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getReadersWithUsers(
  notificationId: string,
  options: GetReadersWithUsersOptions = {},
): Promise<GetReadersWithUsersResult> {
  const page = Math.max(1, Math.floor(options.page ?? DEFAULT_PAGE));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)));
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(NotificationReadTable)
    .where(eq(NotificationReadTable.notificationId, notificationId));

  const total = countRow?.count ?? 0;
  if (total === 0) {
    return { readers: [], total: 0 };
  }

  const rows = await db
    .select({
      userId: UserTable.id,
      userName: UserTable.name,
      userEmail: UserTable.email,
      readAt: NotificationReadTable.readAt,
    })
    .from(NotificationReadTable)
    .innerJoin(UserTable, eq(NotificationReadTable.userId, UserTable.id))
    .where(eq(NotificationReadTable.notificationId, notificationId))
    .orderBy(desc(NotificationReadTable.readAt))
    .limit(limit)
    .offset(offset);

  const readers: NotificationReader[] = rows.map((row) => ({
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
    },
    readAt: row.readAt,
  }));

  return { readers, total };
}
