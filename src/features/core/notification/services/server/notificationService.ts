// src/features/notification/services/server/notificationService.ts

import { base } from "./drizzleBase";
import { create } from "./wrappers/create";
import { update } from "./wrappers/update";
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
import { getMyNotificationsCount } from "./notification/getMyNotificationsCount";
import { getMyNotificationsPage } from "./notification/getMyNotificationsPage";
import { getUnreadCount } from "./notification/getUnreadCount";
import { markAsRead } from "./notification/markAsRead";
import { markAllAsRead } from "./notification/markAllAsRead";
import { getReadCounts } from "./notification/getReadCounts";
import { getReadersWithUsers } from "./notification/getReadersWithUsers";

export const notificationService = {
  ...base,
  create,
  update,
  // remove / bulkDeleteByIds / hardDelete 等の削除系は base が storageCleanupFields を
  // 受け取り Storage クリーンアップまで行うため、個別ラッパーは不要。
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
  getMyNotificationsCount,
  getMyNotificationsPage,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getReadCounts,
  getReadersWithUsers,
};
