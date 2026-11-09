# DOWNSTREAM NOTICE id:20261109-230221-phone-number-input
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-09T23:02:21+09:00
severity: info
checkpoint: config-phone-number-input
change: a phone number can be registered / changed / removed without SMS: new PATCH /api/me/phone (createMeRoute, body { phoneNumber: E.164 | null }) → updateOwnPhoneNumber (@/features/core/user/services/server/phoneNumber; DB only, phoneVerifiedAt set to null, duplicate → 409, same number = no write, audited through base.update; Firebase phone is linked only by SMS verification) | accepted only when "phone" is in userConfig.account.editableItems AND the feature phoneVerification is closed (isPhoneNumberInputOpen in @/features/core/user/utils/accountItems), else 404 | client: updateMyPhoneNumber (services/client/phoneNumberClient.ts), hook useUpdateMyPhoneNumber, display part components/common/PhoneNumberForm | /mypage/account/phone: the loader checks only the list now (no redirect when phoneVerification is closed); EditPhone shows the SMS steps when phoneVerification is open, else the SMS-less form (saving returns to /mypage/account) | AccountDetails phone row shows when "phone" is listed: number (check mark when verified, "(未認証)" only when SMS is open) / 未登録 | the Screen's sr-only title is now 電話番号
why: no fork lists "phone" today without SMS (default list has no phone; oripa-do lists it with phoneVerification open and keeps the SMS steps), so nothing changes until a fork lists phone with SMS closed
required_actions: none
verify: pnpm test src/features/core/user "src/app/(user)/(protected)/mypage/account/phone" | with "phone" listed and phoneVerification closed, /mypage/account/phone saves a number shown as 未認証
manual_steps: -
refs: src/features/core/user/README.md「マイページのアカウントの項目」, src/features/core/phoneVerification/README.md, council 20261023-175358-config-redesign decisions D122 L1.39, legate:l1 order 41
notes: an admin changing a user's number still sets phoneVerifiedAt to now (existing behavior in user wrappers/update.ts, left for a separate decision). | Replacement phone Screens (boardgame-site EditPhoneScreen) keep their own content; to offer the SMS-less form, compose PhoneNumberForm with useUpdateMyPhoneNumber.
