# DOWNSTREAM NOTICE id:20261125-054509-wallet-adjustment-plain-amount
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261125-054332-wallet-adjustment-plain-amount-var | commit:- (this commit)
date: 2026-11-25T05:45:09+09:00
severity: info
checkpoint: wallet-adjustment-plain-amount
resolves: 20261125-054311-wallet-adjustment-plain-amount-var
change: the message wallet.adjustmentNotice (src/domains/core/wallet/plugs/messages/adjustmentNotice.ts) has two more vars filled by adjustmentNoticeVars: `amount` (unsigned amount with unit, the same formatAmount as balance, e.g. "1,000 コイン"; alias 額) and `reason` (the reason only, no heading and no leading newline, "" when none; alias 理由). The existing vars (currencyLabel, methodLabel, delta, balance, reasonLine) and the default text are unchanged.
why: a fork rewording the notice with adjustmentNotice.override.ts (e.g. "『1,000 コイン』が付与されました。" + blank line + "理由: …") had only the signed `delta` and the newline-led `reasonLine`
required_actions: none. To use them: in your `src/domains/core/wallet/plugs/messages/adjustmentNotice.override.ts` write `{{amount}}` / `{{reason}}` (or `{{額}}` / `{{理由}}`) in the overridden text; `reason` is empty when the admin gave none, so keep any "理由:" line conditional the way your text needs
verify: an admin INCREMENT with a reason sends the inbox notice whose overridden text shows the unsigned amount and the bare reason; without an override the notice reads as before
manual_steps: -
refs: src/domains/core/wallet/plugs/messages/adjustmentNotice.ts, src/domains/core/wallet/services/server/notification/sendAdjustmentNotification.ts (adjustmentNoticeVars), src/domains/core/wallet/README.md
notes: the amount keeps the existing unit format of formatAmount (a space before the unit); a fork that wants "1,000コイン" without the space builds it in its own text from the unit it shows
