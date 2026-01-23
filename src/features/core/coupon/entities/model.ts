// src/features/coupon/entities/model.ts

export type Coupon = {
  id: string;
  code: string;
  type: 'invite' | 'affiliate' | 'official';
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
  owner_id: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
