// src/features/notification/services/server/notificationService.ts

import { base } from "./drizzleBase";
import { create } from "./wrappers/create";
import { update } from "./wrappers/update";
import { remove } from "./wrappers/remove";
import { duplicate } from "./wrappers/duplicate";
import { sendDirect } from "./notification/sendDirect";
import {
  sendToUser,
  sendToUsers,
  sendToRole,
  sendToAll,
} from "./notification/sendHelpers";
import {
  sendDirectSafe,
  sendToUserSafe,
  sendToUsersSafe,
  sendToRoleSafe,
  sendToAllSafe,
} from "./notification/sendSafe";
import { getMyNotifications } from "./notification/getMyNotifications";
import { getUnreadCount } from "./notification/getUnreadCount";
import { markAsRead } from "./notification/markAsRead";
import { markAllAsRead } from "./notification/markAllAsRead";
import { getReadCounts } from "./notification/getReadCounts";

export const notificationService = {
  ...base,
  create,
  update,
  remove,
  duplicate,
  sendDirect,
  sendToUser,
  sendToUsers,
  sendToRole,
  sendToAll,
  sendDirectSafe,
  sendToUserSafe,
  sendToUsersSafe,
  sendToRoleSafe,
  sendToAllSafe,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getReadCounts,
};
