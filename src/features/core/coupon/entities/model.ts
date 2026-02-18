// src/features/coupon/entities/model.ts

export type Coupon = {
  id: string;
  category: string | null;
  code: string;
  type: 'official' | 'affiliate' | 'invite';
  status: 'active' | 'inactive';
  name: string;
  description: string | null;
  image_url: string | null;
  admin_label: string | null;
  admin_note: string | null;
  valid_from: Date | null;
  valid_until: Date | null;
  max_total_uses: number | null;
  max_uses_per_redeemer: number | null;
  current_total_uses: number;
  attribution_user_id: string | null;
  settings: Record<string, unknown>;
  createdAt: Date | null;
  updatedAt: Date | null;
};
