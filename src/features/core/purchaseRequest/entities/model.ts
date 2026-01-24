// src/features/purchaseRequest/entities/model.ts

import type { WalletType } from "@/config/app/currency.config";

export type PurchaseRequest = {
  id: string;
  user_id: string;
  wallet_history_id: string | null;
  idempotency_key: string;
  wallet_type: WalletType;
  amount: number;
  payment_amount: number;
  payment_method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  payment_provider: string;
  payment_session_id: string | null;
  transaction_id: string | null;
  redirect_url: string | null;
  error_code: string | null;
  error_message: string | null;
  webhook_signature: string | null;
  completed_at: Date | null;
  paid_at: Date | null;
  expires_at: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
