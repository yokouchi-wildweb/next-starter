# DOWNSTREAM NOTICE id:20261024-183852-edit-profile-props
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:38:52+09:00
severity: info
checkpoint: edit-profile-props
change: EditProfile (src/features/core/user/components/EditProfile.tsx) takes three new optional props: `showHeader` (default true; false hides the "プロフィール編集" title and back button), `afterSaveHref` (default "/mypage/account"; where to go after saving), `backHref` (default = afterSaveHref; the back button target). Omitting them keeps the previous behavior.
why: Forks that reuse the profile form elsewhere (post-signup profile step, modal, own header) had to copy EditProfile or edit it in core because the header and the redirect targets were hard-coded.
required_actions:
1. Merge upstream up to this checkpoint. If the fork edited EditProfile.tsx only to hide the header or change the redirect (find: `git diff upstream/main -- src/features/core/user/components/EditProfile.tsx`), take upstream on conflict and pass the new props from the fork's Screen instead.
2. Fork copies of EditProfile made for the same reason (find: `grep -rln "useUpdateMyProfile" src | grep -v src/features/core/user`) may switch back to `<EditProfile showHeader={false} afterSaveHref="..." />`. Optional.
verify: `pnpm typecheck` | /mypage/account/profile looks and behaves as before (header shown, save → /mypage/account)
manual_steps: -
refs: src/features/core/user/components/EditProfile.tsx | order 20261019-122328-fork-extension-points-bundle item (22)
notes: No DB change, no db:push. | Section-container top-level props are contract: the new props are optional and will stay backward compatible.
