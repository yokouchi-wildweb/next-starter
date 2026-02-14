// src/features/referral/entities/model.ts

export type Referral = {
  id: string;
  coupon_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: 'active' | 'cancelled';
  createdAt: Date | null;
  updatedAt: Date | null;
};
