// src/config/app/auth-lockout.config.ts

/**
 * アカウントロックアウト設定
 *
 * 連続ログイン失敗に対する 2 段階防御:
 * - 短期ロック: shortLockThreshold 回失敗で shortLockDurationSeconds 秒間ロック (時間経過で自動解除)
 * - 永続ロック: permanentLockThreshold 回失敗で status=security_locked (管理者解除のみ)
 *
 * 失敗カウントは下記契機でリセット:
 * - ログイン成功
 * - パスワードリセット完了
 * - 管理者による security_locked 解除
 * - 直近失敗から countResetWindowSeconds 秒以上経過後の新たな失敗 (時間窓ベース)
 *
 * 短期ロック中は認証処理ごと即ブロックし、カウントは増分しない
 * (攻撃者が永続ロックへの到達を意図的に早められないため)。
 */
export const AUTH_LOCKOUT_CONFIG = {
  /** 短期ロック発動の累積失敗回数 */
  shortLockThreshold: 5,

  /** 永続ロック発動の累積失敗回数 (status=security_locked へ遷移) */
  permanentLockThreshold: 15,

  /** 短期ロックの継続時間 (秒) */
  shortLockDurationSeconds: 30 * 60,

  /** 直近失敗からの経過時間がこれを超えると累積カウントを 0 にリセット (秒) */
  countResetWindowSeconds: 24 * 60 * 60,
} as const;
