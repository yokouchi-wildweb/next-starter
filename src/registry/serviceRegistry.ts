// src/config/serviceRegistry.ts

// --- Core imports ---
import { userService } from "@/features/user/services/server/userService";
import { settingService } from "@/features/setting/services/server/settingService";
import { walletService } from "@/features/wallet/services/server/walletService";
import { walletHistoryService } from "@/features/walletHistory/services/server/walletHistoryService";
import { purchaseRequestService } from "@/features/purchaseRequest/services/server/purchaseRequestService";
import { couponService } from "@/features/coupon/services/server/couponService";
import { couponHistoryService } from "@/features/couponHistory/services/server/couponHistoryService";
import { userTagService } from "@/features/userTag/services/server/userTagService";
import { referralService } from "@/features/referral/services/server/referralService";
import { referralRewardService } from "@/features/referralReward/services/server/referralRewardService";
import { milestoneService } from "@/features/milestone/services/server/milestoneService";
import { notificationService } from "@/features/notification/services/server/notificationService";
import { notificationTemplateService } from "@/features/notificationTemplate/services/server/notificationTemplateService";

// --- Auto-generated imports ---
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";

export const serviceRegistry: Record<string, any> = {

  // --- CORE DOMAINS (手動管理) ---
  user: userService,
  setting: settingService,
  wallet: walletService,
  walletHistory: walletHistoryService,
  purchaseRequest: purchaseRequestService,
  coupon: couponService,
  couponHistory: couponHistoryService,
  userTag: userTagService,
  referral: referralService,
  referralReward: referralRewardService,
  milestone: milestoneService,
  notification: notificationService,
  notificationTemplate: notificationTemplateService,
  chatRoom: chatRoomService,

  // --- AUTO-GENERATED-START ---
  sample: sampleService,
  sampleCategory: sampleCategoryService,
  sampleTag: sampleTagService,
  // --- AUTO-GENERATED-END ---

};
