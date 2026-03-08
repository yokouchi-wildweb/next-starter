// src/lib/drizzle/schemaRegistry.ts

// example
// export * from "@/features/xxx/entities/drizzle";

// --- CORE DOMAINS (手動管理) ---
export * from "@/features/userActionLog/entities/drizzle";
export * from "@/features/analytics/entities/drizzle";
export * from "@/registry/profileTableRegistry";
export * from "@/features/user/entities/drizzle";
export * from "@/features/setting/entities/drizzle";
export * from "@/features/wallet/entities/drizzle";
export * from "@/features/walletHistory/entities/drizzle";
export * from "@/features/purchaseRequest/entities/drizzle";
export * from "@/features/coupon/entities/drizzle";
export * from "@/features/couponHistory/entities/drizzle";
export * from "@/features/rateLimit/entities/drizzle";
export * from "@/features/userTag/entities/drizzle";
export * from "@/features/referral/entities/drizzle";
export * from "@/features/referralReward/entities/drizzle";
export * from "@/features/milestone/entities/drizzle";
export * from "@/features/notification/entities/drizzle";
export * from "@/features/notification/entities/notificationRead";
export * from "@/features/notificationTemplate/entities/drizzle";

// --- AUTO-GENERATED-START ---
export * from "@/features/sample/entities/drizzle";
export * from "@/features/sampleCategory/entities/drizzle";
export * from "@/features/sampleTag/entities/drizzle";
// --- AUTO-GENERATED-END ---

export {};
