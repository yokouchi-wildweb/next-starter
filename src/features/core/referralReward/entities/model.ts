// src/features/referralReward/entities/model.ts

export type ReferralReward = {
  id: string;
  referral_id: string;
  reward_key: string;
  recipient_user_id: string;
  status: 'pending' | 'fulfilled' | 'failed';
  fulfilled_at: Date | null;
  metadata: any | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
