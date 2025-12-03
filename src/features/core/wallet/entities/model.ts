// src/features/wallet/entities/model.ts

export type Wallet = {
  id: string;
  user_id: string;
  type: 'regular_point' | 'temporary_point';
  balance: number;
  locked_balance: number;
  updatedAt: Date | null;
};
