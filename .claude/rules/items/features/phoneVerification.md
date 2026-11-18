---
paths:
  - "src/features/core/phoneVerification/**"
---
# features/phoneVerification
what: SMS verification of a user's phone number with Firebase Phone Auth (no table: the mark goes to users.phoneNumber / phoneVerifiedAt), parts PhoneVerification / PhoneVerificationModal, hook usePhoneVerificationModal, API /api/phone-verification/{check,verify}
use: phoneVerification
change: none → /order <direct parent>
rules:
using:
- pv_gate_check: a file outside this folder that imports it by value checks the gate itself (gate dependency check)
- pv_recaptcha_slot: the reCAPTCHA slot (`id="phone-verification-recaptcha"`) stays in the root layout, outside any modal
editing:
- pv_write_via_user: writes go through user's updatePhoneVerified (duplicate check + base.update audit), never a direct update here
- pv_phone_format: phone formats (E164_PHONE_REGEX, formatToE164, formatForDisplay) come from user utils/phoneNumber, never redefined here
- pv_index_client: index.ts exports client-safe values only (constants, schemas, checks)
- pv_page_independent: the phone page (/mypage/account/phone) never dependsOn this feature: a phone number can be saved without SMS
read: build the flow or a gate before an action → src/features/core/phoneVerification/components/PhoneVerification/README.md Usage | gate, readers, API → Overview | server check, writes → Internals | tests → Verification
