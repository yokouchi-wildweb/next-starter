// src/features/core/userGroup/services/server/writes/index.ts
// 本物の静的グループへ書く口(db・設定・門 userGroups)

import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";

import { userGroupConfig } from "../../../config";
import { createStaticMemberWriter } from "./staticMembers";

export const staticMemberWriter = createStaticMemberWriter({
  db,
  config: userGroupConfig,
  gateEnabled: () => gate.enabled("userGroups"),
});

export {
  createStaticMemberWriter,
  type AddMembersResult,
  type RemoveMembersResult,
  type ReplaceMembersOptions,
  type ReplaceMembersResult,
  type StaticMemberWriter,
  type StaticMemberWriterDeps,
} from "./staticMembers";
export type { UserIdSupplier } from "./versionWriter";
