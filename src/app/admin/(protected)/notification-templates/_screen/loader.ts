// src/app/admin/(protected)/notification-templates/_screen/loader.ts
// /admin/notification-templates の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(一覧)を渡す 1 行。
// access = notificationTemplate の serviceRegistry の search(汎用 API と同じ解き方)。上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminListParts } from "@/wiring/adminScreenParts";

export const loadAdminNotificationTemplateListScreen = createLoader(adminListParts<NotificationTemplate>("notificationTemplate"));
