// src/features/notification/entities/model.ts

import type { NotificationTemplate } from "@/features/notificationTemplate/entities/model";

export type Notification = {
  id: string;
  notification_template_id: string | null;
  title: string | null;
  body: string;
  image: string | null;
  target_type: 'all' | 'role' | 'individual';
  target_user_ids: string[] | null;
  target_roles: string[] | null;
  sender_type: 'admin' | 'system';
  created_by_id: string | null;
  published_at: Date;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * リレーション展開済みの Notification 型。
 * withRelations: true オプション使用時に返される。
 */
export type NotificationWithRelations = Notification & {
  /** belongsTo: テンプレート */
  notification_template?: NotificationTemplate | null;
};
