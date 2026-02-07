# PhoneVerification

電話番号SMS認証コンポーネント。Firebase Phone Authenticationを使用。

## コンポーネント

### PhoneVerification

基本コンポーネント。ページ内に直接埋め込む場合に使用。

```tsx
import { PhoneVerification } from "@/features/core/auth/components/PhoneVerification";

// 新規登録
<PhoneVerification
  onComplete={({ phoneNumber, phoneVerifiedAt }) => {
    // 認証完了後の処理
  }}
  onCancel={() => {
    // キャンセル時の処理
  }}
/>

// 電話番号変更
<PhoneVerification
  mode="change"
  currentPhoneNumber={user.phoneNumber}
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

### PhoneVerificationModal

モーダルでラップしたバージョン。特定アクション前の認証要求に使用。

```tsx
import { PhoneVerificationModal } from "@/features/core/auth/components/PhoneVerification/Modal";

<PhoneVerificationModal
  open={isOpen}
  onOpenChange={setIsOpen}
  mode="register"
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

## フック

### usePhoneVerificationModal

モーダル管理用フック。Promise based APIで認証フローを簡単に実装可能。

```tsx
import { PhoneVerificationModal } from "@/features/core/auth/components/PhoneVerification/Modal";
import { usePhoneVerificationModal } from "@/features/core/auth/hooks/usePhoneVerificationModal";

function CoinPurchasePage({ user }) {
  const phoneModal = usePhoneVerificationModal();

  const handlePurchase = async () => {
    // 未認証の場合、モーダルで認証を要求
    if (!user.phoneVerifiedAt) {
      const verified = await phoneModal.requireVerification();
      if (!verified) return; // キャンセル時は中断
    }

    // 認証済み or 認証完了 → 購入処理へ
    await purchaseCoins();
  };

  return (
    <>
      <Button onClick={handlePurchase}>
        {user.phoneVerifiedAt ? "購入する" : "電話番号を認証して購入"}
      </Button>

      <PhoneVerificationModal
        open={phoneModal.isOpen}
        onOpenChange={phoneModal.handleOpenChange}
        mode={phoneModal.mode}
        currentPhoneNumber={phoneModal.currentPhoneNumber}
        onComplete={phoneModal.handleComplete}
        onCancel={phoneModal.handleCancel}
      />
    </>
  );
}
```

#### API

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `requireVerification(options?)` | `Promise<boolean>` | 認証完了で`true`、キャンセルで`false` |
| `requireVerificationWithResult(options?)` | `Promise<Result \| null>` | 認証結果オブジェクトまたは`null` |
| `open(options?)` | `void` | モーダルを開く |
| `close()` | `void` | モーダルを閉じる |

#### Options

```ts
type RequireVerificationOptions = {
  mode?: "register" | "change";  // デフォルト: "register"
  currentPhoneNumber?: string | null;  // 変更モード時の現在番号
};
```

## 使用パターン

### 1. マイページでの埋め込み

ユーザーが自発的に認証する場合。`PhoneVerification`を直接配置。

### 2. アクション前の認証要求

コイン購入など特定アクション前に認証を要求する場合。`usePhoneVerificationModal` + `PhoneVerificationModal`を使用。

```tsx
const verified = await phoneModal.requireVerification();
if (!verified) return;
// 続きの処理...
```

### 3. 電話番号変更

認証済みユーザーが番号を変更する場合。`mode="change"`を指定。

```tsx
await phoneModal.requireVerification({
  mode: "change",
  currentPhoneNumber: user.phoneNumber,
});
```

## 関連ファイル

- `usePhoneVerification.ts` - 認証ロジックのコアフック
- `PhoneNumberStep.tsx` - 電話番号入力ステップ
- `OtpStep.tsx` - OTPコード入力ステップ
- `CompleteStep.tsx` - 完了ステップ
- `Modal.tsx` - モーダルラッパー
