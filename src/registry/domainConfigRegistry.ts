// src/registry/domainConfigRegistry.ts

// --- Core imports ---
import userConfig from "@/features/user/domain.json";
import couponConfig from "@/features/coupon/domain.json";
import couponHistoryConfig from "@/features/couponHistory/domain.json";
import rateLimitConfig from "@/features/rateLimit/domain.json";
import userLineProfileConfig from "@/features/userLineProfile/domain.json";
import userTagConfig from "@/features/userTag/domain.json";
import referralConfig from "@/features/referral/domain.json";
import referralRewardConfig from "@/features/referralReward/domain.json";
import milestoneConfig from "@/features/milestone/domain.json";
import notificationConfig from "@/features/notification/domain.json";
import notificationTemplateConfig from "@/features/notificationTemplate/domain.json";

// --- Auto-generated imports ---
import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import chatRoomConfig from "@/features/core/chatRoom/domain.json";

export const domainConfigMap = {

  // --- CORE DOMAINS (手動管理) ---
  user: userConfig,
  coupon: couponConfig,
  coupon_history: couponHistoryConfig,
  rate_limit: rateLimitConfig,
  user_line_profile: userLineProfileConfig,
  user_tag: userTagConfig,
  referral: referralConfig,
  referral_reward: referralRewardConfig,
  milestone: milestoneConfig,
  notification: notificationConfig,
  notification_template: notificationTemplateConfig,
  chat_room: chatRoomConfig,

  // --- AUTO-GENERATED-START ---
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
  // --- AUTO-GENERATED-END ---

} as const;

export type DomainKey = keyof typeof domainConfigMap;

/**
 * domain.json でオプショナル（⚪ No）なフィールド。
 * union 型では省略されたメンバーのプロパティにアクセスできないため、
 * intersection で付与して型安全にアクセス可能にする。
 *
 * ⚠️ domain.json スキーマにオプショナルフィールドを追加した場合、ここにも追加すること。
 *    追加漏れ → searchFields がないドメインが存在するだけでビルドエラーになる。
 *    スキーマ定義: src/features/README.md「トップレベルプロパティ」
 */
type DomainConfigOptionals = {
  useSoftDelete?: boolean;
  searchFields?: string[];
  defaultOrderBy?: string[][];
  tableFields?: string[];
  useDetailModal?: boolean;
  addToAdminDataMenu?: boolean;
  useDuplicateButton?: boolean;
  useImportExport?: boolean;
  useAutoSave?: boolean;
  compositeUniques?: string[][];
  // 正規の型は src/components/Form/FieldRenderer/types.ts の FieldGroup を参照。
  // JSON インポートの型推論と相性を保つためインラインで再宣言している。
  fieldGroups?: Array<{
    key: string;
    label: string;
    fields: string[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    bgColor?: string;
  }>;
  indexes?: Array<{
    fields: string[];
    where?: string;
    name?: string;
  }>;
  sortOrderField?: string | null;
  // systemUpdate / systemBulkUpdateByQuery（特権書き込み）の allowlist（Neon のみ）。
  // 詳細は src/lib/crud/README.md を参照。
  systemColumns?: string[];
  // JSON インポートの型推論（string）と相性を保つため、リテラル union ではなく緩い型で宣言する。
  // 厳密な型は src/lib/domain/types/apiAccess.ts の DomainApiAccessConfig を参照。
  apiAccess?: {
    read?: string | { roles?: string[]; roleCategories?: string[] };
    write?: string | { roles?: string[]; roleCategories?: string[] };
    operations?: Record<string, string | { roles?: string[]; roleCategories?: string[] }>;
  };
};

export type DomainConfig = (typeof domainConfigMap)[DomainKey] & DomainConfigOptionals;
