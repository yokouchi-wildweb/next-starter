// src/domains/core/deviceFingerprint/services/server/drizzleBase.ts

import { DeviceFingerprintTable } from "@/domains/core/deviceFingerprint/entities/drizzle";
import {
  DeviceFingerprintCreateSchema,
  type DeviceFingerprintCreateInput,
} from "@/domains/core/deviceFingerprint/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

// 高ボリュームのテレメトリ性データのため audit は付けない
// (書き込み主経路 recordDeviceFingerprint は本人由来の自己申告データであり、
//  監査すべき「管理者の意思決定」を含まない)。
const deviceFingerprintOptions: CrudServiceOptions<DeviceFingerprintCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["lastSeenAt", "DESC"]],
  parseCreate: (data) => DeviceFingerprintCreateSchema.parse(data),
};

export const deviceFingerprintBase = createCrudService(
  DeviceFingerprintTable,
  deviceFingerprintOptions,
);
