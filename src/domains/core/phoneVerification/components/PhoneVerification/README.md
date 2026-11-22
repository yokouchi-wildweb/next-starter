# phoneVerification/components/PhoneVerification

## Overview

- 電話番号の SMS 認証の部品。Firebase Phone Authentication を使う
- Firebase 側の設定（Phone プロバイダ有効化・reCAPTCHA 等）は [SMS認証（電話番号認証）のセットアップ方法](../../../../../../docs/setup/SMS認証（電話番号認証）のセットアップ方法.md)。使うかどうかは機能 `phoneVerification` の入切(上流の既定 閉)。ドメイン全体は [phoneVerification README](../../README.md)
- `PhoneVerification` = ページ内に直接埋め込む基本の部品 | `PhoneVerificationModal` = モーダルで包んだ物(特定アクション前の認証要求) | `usePhoneVerificationModal` = モーダルの管理フック(Promise で認証の結果を返す)
- 中は手順ごとの部品(電話番号の入力 `PhoneNumberStep`・OTP の入力 `OtpStep`・完了 `CompleteStep`)と、認証のロジックのフック `usePhoneVerification`

## Usage

### PhoneVerification(埋め込み)

基本コンポーネント。ページ内に直接埋め込む場合に使用。

```tsx
import { PhoneVerification } from "@/domains/phoneVerification/components/PhoneVerification";

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
import { PhoneVerificationModal } from "@/domains/phoneVerification/components/PhoneVerification";

<PhoneVerificationModal
  open={isOpen}
  onOpenChange={setIsOpen}
  mode="register"
  onComplete={handleComplete}
  onCancel={handleCancel}
/>
```

### usePhoneVerificationModal

モーダル管理用フック。Promise based APIで認証フローを簡単に実装可能。

```tsx
import { PhoneVerificationModal } from "@/domains/phoneVerification/components/PhoneVerification";
import { usePhoneVerificationModal } from "@/domains/phoneVerification/hooks/usePhoneVerificationModal";

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

### 使い分け 1: マイページでの埋め込み

ユーザーが自発的に認証する場合。`PhoneVerification`を直接配置。

### 使い分け 2: アクション前の認証要求

コイン購入など特定アクション前に認証を要求する場合。`usePhoneVerificationModal` + `PhoneVerificationModal`を使用。

```tsx
const verified = await phoneModal.requireVerification();
if (!verified) return;
// 続きの処理...
```

### 使い分け 3: 電話番号変更

認証済みユーザーが番号を変更する場合。`mode="change"`を指定。

```tsx
await phoneModal.requireVerification({
  mode: "change",
  currentPhoneNumber: user.phoneNumber,
});
```

## API

### usePhoneVerificationModal の戻り値

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `requireVerification(options?)` | `Promise<boolean>` | 認証完了で`true`、キャンセルで`false` |
| `requireVerificationWithResult(options?)` | `Promise<Result \| null>` | 認証結果オブジェクトまたは`null` |
| `open(options?)` | `void` | モーダルを開く |
| `close()` | `void` | モーダルを閉じる |

### Options

```ts
type RequireVerificationOptions = {
  mode?: "register" | "change";  // デフォルト: "register"
  currentPhoneNumber?: string | null;  // 変更モード時の現在番号
};
```
