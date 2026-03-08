// src/features/notification/services/server/notificationService.ts

import { base } from "./drizzleBase";
import { create } from "./wrappers/create";
import { update } from "./wrappers/update";
import { remove } from "./wrappers/remove";
import { duplicate } from "./wrappers/duplicate";
import { sendDirect } from "./notification/sendDirect";
import { getMyNotifications } from "./notification/getMyNotifications";
import { getUnreadCount } from "./notification/getUnreadCount";
import { markAsRead } from "./notification/markAsRead";
import { markAllAsRead } from "./notification/markAllAsRead";

export const notificationService = {
  ...base,
  create,
  update,
  remove,
  duplicate,
  sendDirect,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
