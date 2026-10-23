// src/app/api/data-migration/_shared/mediaResolver.ts
//
// dataMigration（lib）に注入するファイル台帳の操作。lib は features を import しないので、ルートがここで組み立てて渡す。
// 実行者（DB と同期した管理者）を固定する:
// - import の putFromServer / copy の所有者 = 実行者（binding の attach が「保存者 = アップロードした本人」を求めるため、
//   routeFactory の AuditContext の actor と同じ利用者になる）
// - export の非公開ファイルは、用途の read を実行者で判定する（admin だからといって全用途を読めるわけではない。暗黙の通過なし）

import "server-only";

import type { SessionUser } from "@/features/core/auth/entities/session";
import {
  storageObjectService,
  type StorageObjectService,
} from "@/features/core/storageObject/services/server/storageObjectService";
import type { DataMigrationMediaResolver } from "@/lib/dataMigration/media";
import { parseStorageRef, resolveStorageSrc } from "@/lib/storage";

export function createDataMigrationMediaResolver(
  actor: SessionUser,
  service: StorageObjectService = storageObjectService,
): DataMigrationMediaResolver {
  return {
    async putAsset({ purpose, body, contentType, scopeId }) {
      const { ref } = await service.putFromServer({ purpose, body, contentType, ownerUserId: actor.userId, scopeId });
      return ref;
    },

    async copy({ source, purpose, scopeId }) {
      const { ref } = await service.copy({ source, purpose, ownerUserId: actor.userId, scopeId });
      return ref;
    },

    async resolveExportUrl(ref) {
      const parsed = parseStorageRef(ref);
      if (!parsed) return null;
      if (parsed.store === "pub") {
        const src = resolveStorageSrc(ref);
        return src && /^https?:\/\//i.test(src) ? src : null;
      }
      const resolution = await service.resolveRead(parsed.ledgerId, { use: "view", loadUser: async () => actor });
      return resolution.kind === "redirect" ? resolution.url : null;
    },
  };
}
