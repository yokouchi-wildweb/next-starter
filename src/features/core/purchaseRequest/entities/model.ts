// src/features/purchaseRequest/entities/model.ts

export type PurchaseRequest = {
  id: string;
  user_id: string;
  wallet_history_id: string | null;
  idempotency_key: string;
  wallet_type: 'regular_point' | 'temporary_point' | 'regular_coin';
  amount: number;
  payment_amount: number;
  payment_method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  payment_provider: string;
  payment_session_id: string | null;
  redirect_url: string | null;
  error_code: string | null;
  error_message: string | null;
  completed_at: Date | null;
  expires_at: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
