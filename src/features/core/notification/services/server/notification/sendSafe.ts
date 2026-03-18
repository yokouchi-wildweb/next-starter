// src/features/core/notification/services/server/notification/sendSafe.ts
// 全 send 関数の Safe 版（失敗時に例外を投げず null を返す）

import { sendDirect } from "./sendDirect";
import { sendToUser, sendToUsers, sendToRole, sendToAll } from "./sendHelpers";
import type { SendDirectInput } from "./sendDirect";
import type { NotificationContent } from "./sendHelpers";
import type { Notification } from "@/features/core/notification/entities/model";

function logError(method: string, error: unknown): void {
  console.error(`[Notification] ${method} failed:`, error);
}

/** sendDirect の Safe 版 */
export async function sendDirectSafe(
  input: SendDirectInput
): Promise<Notification | null> {
  try {
    return await sendDirect(input);
  } catch (error) {
    logError("sendDirect", error);
    return null;
  }
}

/** sendToUser の Safe 版 */
export async function sendToUserSafe(
  userId: string,
  content: NotificationContent
): Promise<Notification | null> {
  try {
    return await sendToUser(userId, content);
  } catch (error) {
    logError("sendToUser", error);
    return null;
  }
}

/** sendToUsers の Safe 版 */
export async function sendToUsersSafe(
  userIds: string[],
  content: NotificationContent
): Promise<Notification | null> {
  try {
    return await sendToUsers(userIds, content);
  } catch (error) {
    logError("sendToUsers", error);
    return null;
  }
}

/** sendToRole の Safe 版 */
export async function sendToRoleSafe(
  roles: string | string[],
  content: NotificationContent
): Promise<Notification | null> {
  try {
    return await sendToRole(roles, content);
  } catch (error) {
    logError("sendToRole", error);
    return null;
  }
}

/** sendToAll の Safe 版 */
export async function sendToAllSafe(
  content: NotificationContent
): Promise<Notification | null> {
  try {
    return await sendToAll(content);
  } catch (error) {
    logError("sendToAll", error);
    return null;
  }
}
