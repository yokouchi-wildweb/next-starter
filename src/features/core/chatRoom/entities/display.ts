// 生成物・編集不可: pnpm generate registry が src/features/core/chatRoom/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "chat_room",
  "plural": "chat_rooms",
  "label": "チャットルーム",
  "fields": [
    {
      "name": "type",
      "label": "種別",
      "fieldType": "string",
      "formInput": "select",
      "options": [
        {
          "value": "direct",
          "label": "ダイレクト"
        },
        {
          "value": "group",
          "label": "グループ"
        }
      ],
      "required": true
    },
    {
      "name": "name",
      "label": "ルーム名",
      "fieldType": "string",
      "formInput": "textInput",
      "required": false
    },
    {
      "name": "participants",
      "label": "参加者",
      "fieldType": "array",
      "formInput": "none"
    },
    {
      "name": "participantPair",
      "label": "参加者ペアキー",
      "fieldType": "string",
      "formInput": "none"
    },
    {
      "name": "readAt",
      "label": "既読時刻",
      "fieldType": "map",
      "formInput": "none"
    },
    {
      "name": "lastMessageSnapshot",
      "label": "最新メッセージ",
      "fieldType": "map",
      "formInput": "none"
    }
  ],
  "relations": [],
  "searchFields": [
    "name"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": true,
  "tableFields": [
    "type",
    "name",
    "participants",
    "updatedAt"
  ]
};
