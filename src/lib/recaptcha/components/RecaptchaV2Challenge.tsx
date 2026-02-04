// src/lib/recaptcha/components/RecaptchaV2Challenge.tsx

"use client";

import { useRef, useCallback, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

import { Button } from "@/components/Form/Button";
import { Dialog } from "@/components/Overlays/Dialog";
import { Flex } from "@/components/Layout";
import { Para } from "@/components/TextBlocks";

type RecaptchaV2ChallengeProps = {
  /** モーダルを表示するか */
  open: boolean;
  /** モーダルを閉じる */
  onClose: () => void;
  /** v2認証成功時のコールバック */
  onVerify: (token: string) => void;
  /** reCAPTCHA v2 サイトキー */
  siteKey: string;
};

/**
 * reCAPTCHA v2 チャレンジモーダル
 *
 * v3で中間スコアの場合に表示され、ユーザーに手動認証を求める。
 */
export function RecaptchaV2Challenge({
  open,
  onClose,
  onVerify,
  siteKey,
}: RecaptchaV2ChallengeProps) {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((token: string | null) => {
    if (token) {
      setError(null);
      onVerify(token);
    }
  }, [onVerify]);

  const handleExpired = useCallback(() => {
    setError("認証の有効期限が切れました。再度お試しください。");
    recaptchaRef.current?.reset();
  }, []);

  const handleError = useCallback(() => {
    setError("認証中にエラーが発生しました。再度お試しください。");
  }, []);

  const handleClose = () => {
    setError(null);
    recaptchaRef.current?.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
      title="追加の認証が必要です"
      description="セキュリティ確認のため、以下の認証を完了してください。"
      showCancelButton={false}
      showConfirmButton={false}
    >
      <Flex direction="column" align="center" gap="sm" className="py-4">
        {error && (
          <Para size="sm" tone="error">{error}</Para>
        )}

        {open && (
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={siteKey}
            onChange={handleChange}
            onExpired={handleExpired}
            onErrored={handleError}
          />
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={handleClose}
        >
          キャンセル
        </Button>
      </Flex>
    </Dialog>
  );
}
