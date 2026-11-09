// src/features/core/chatRoom/config.ts
// チャットの設定(既定 + 上書き、設定の議会 D11・D19・D95)。上書きは src/config/features/chatRoom.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。呼び手は chatRoomConfig.<鍵> を読む
// 管理画面の入切(adminConsole.enableChatRoomAdmin)は門番の持ち物で、ここには無い

import override from "@/config/features/chatRoom.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 添付の種別 */
export type ChatAttachmentKind = "image" | "video" | "file";

export type ChatRoomConfig = {
  /**
   * チャット添付で受け付ける Content-Type(送信前の検査 utils/validation.ts と用途 storageObject/purposes/chatRoom.ts が読む)。
   * 「その他ファイル」の既定は種別を絞らない(表示は配信規則で attachment になる)。配列の上書きは丸ごと置き換え
   */
  attachmentContentTypes: Record<ChatAttachmentKind, readonly string[]>;
};

const defaults: ChatRoomConfig = {
  attachmentContentTypes: {
    image: ["image/*"],
    video: ["video/*"],
    file: ["application/*", "text/*", "image/*", "video/*", "audio/*", "font/*", "model/*"],
  },
};

export const chatRoomConfigDef = defineConfig<ChatRoomConfig>(defaults, { label: "chatRoom" });

/** 上書きのファイルの型(`export default { ... } satisfies ChatRoomOverride`) */
export type ChatRoomOverride<E extends object = Record<never, never>> = OverrideOf<typeof chatRoomConfigDef, E>;

/** 合成済みの設定 */
export const chatRoomConfig = chatRoomConfigDef.compose(override);
