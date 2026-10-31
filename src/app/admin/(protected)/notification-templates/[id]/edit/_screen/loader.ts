// src/app/admin/(protected)/notification-templates/[id]/edit/_screen/loader.ts
// /admin/notification-templates/[id]/edit の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(編集)を渡す 1 行。
// access = notificationTemplate の serviceRegistry の get(汎用 API と同じ解き方)。上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminEditParts } from "@/wiring/adminScreenParts";

export const loadAdminNotificationTemplateEditScreen = createLoader(adminEditParts<NotificationTemplate>("notificationTemplate", { fallbackPath: "/admin/notification-templates" }));
