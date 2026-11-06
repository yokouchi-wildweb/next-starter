// 生成物・編集不可: pnpm generate registry が src/features/core/user/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "user",
  "plural": "users",
  "label": "ユーザー",
  "fields": [
    {
      "name": "provider_type",
      "label": "認証方法",
      "fieldType": "enum",
      "formInput": "select",
      "options": [
        {
          "value": "email",
          "label": "メール"
        },
        {
          "value": "local",
          "label": "ローカル"
        },
        {
          "value": "google.com",
          "label": "Google"
        },
        {
          "value": "yahoo.com",
          "label": "Yahoo"
        },
        {
          "value": "github",
          "label": "GitHub"
        },
        {
          "value": "apple",
          "label": "Apple"
        },
        {
          "value": "microsoft",
          "label": "Microsoft"
        },
        {
          "value": "facebook.com",
          "label": "Facebook"
        },
        {
          "value": "twitter.com",
          "label": "Twitter"
        },
        {
          "value": "line",
          "label": "LINE"
        },
        {
          "value": "oidc",
          "label": "OIDC"
        },
        {
          "value": "saml",
          "label": "SAML"
        },
        {
          "value": "custom",
          "label": "カスタム"
        }
      ],
      "required": true
    },
    {
      "name": "provider_uid",
      "label": "プロバイダーUID",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    },
    {
      "name": "email",
      "label": "メールアドレス",
      "fieldType": "email",
      "formInput": "emailInput",
      "required": false
    },
    {
      "name": "name",
      "label": "表示名",
      "fieldType": "string",
      "formInput": "textInput",
      "required": false
    },
    {
      "name": "role",
      "label": "ロール",
      "fieldType": "enum",
      "formInput": "select",
      "options": [
        {
          "value": "admin",
          "label": "管理者"
        },
        {
          "value": "user",
          "label": "一般ユーザー"
        }
      ],
      "required": true
    },
    {
      "name": "status",
      "label": "ステータス",
      "fieldType": "enum",
      "formInput": "select",
      "options": [
        {
          "value": "pending",
          "label": "仮登録"
        },
        {
          "value": "active",
          "label": "有効"
        },
        {
          "value": "inactive",
          "label": "休会中"
        },
        {
          "value": "suspended",
          "label": "処分保留"
        },
        {
          "value": "banned",
          "label": "永久追放"
        },
        {
          "value": "security_locked",
          "label": "セキュリティロック"
        },
        {
          "value": "withdrawn",
          "label": "退会済み"
        }
      ],
      "required": true,
      "defaultValue": "pending"
    },
    {
      "name": "is_demo",
      "label": "デモユーザー",
      "fieldType": "boolean",
      "formInput": "switchInput",
      "required": true,
      "defaultValue": false
    },
    {
      "name": "last_authenticated_at",
      "label": "最終認証日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none",
      "required": false
    },
    {
      "name": "avatar_url",
      "label": "アバター画像URL",
      "fieldType": "string",
      "formInput": "none",
      "required": false
    },
    {
      "name": "metadata",
      "label": "メタデータ",
      "fieldType": "jsonb",
      "formInput": "none",
      "required": false,
      "defaultValue": {}
    }
  ],
  "relations": [
    {
      "domain": "user_tag",
      "label": "ユーザータグ",
      "fieldName": "user_tag_ids",
      "fieldType": "uuid",
      "relationType": "belongsToMany",
      "required": false,
      "includeRelationTable": false
    }
  ],
  "searchFields": [
    "name",
    "email",
    "phoneNumber",
    "signupIp"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": true,
  "useImportExport": false,
  "tableFields": [
    "status",
    "role",
    "name",
    "email",
    "provider_type",
    "createdAt"
  ]
};
