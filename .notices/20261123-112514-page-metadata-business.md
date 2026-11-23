# DOWNSTREAM NOTICE id:20261123-112514-page-metadata-business
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-111526-page-switch-allow-business-import | commit:- (this commit)
date: 2026-11-23T11:25:14+09:00
severity: info
checkpoint: page-metadata-business
resolves: 20261111-070500-page-switch-allow-business-import
change: notice 20261108-202604-business-home step 5 now names the supported way for page metadata built from business values: generateMetadata / metadata in the Screen (with the @/business import), re-exported by the 1-line page.tsx; the page.tsx import check is unchanged (next / @/lib / @/config / its loader only)
why: step 5 told app files to import @/business, and a fork that put it in page.tsx failed pnpm check routes (page.tsx の 1 行スイッチから Screen を解決できない)
required_actions: none
verify: git grep -n '@/business' -- 'src/app/**/page.tsx' prints nothing | pnpm check routes
manual_steps: -
refs: .notices/20261108-202604-business-home.md step 5 | src/lib/screens/README.md (page.tsx row, re-export of metadata / generateMetadata) | src/lib/screens/checks.mjs isAllowedImportSource | order 20261111-070500-page-switch-allow-business-import
notes: a fork that kept a workaround (e.g. a widened import list or an @/business import in page.tsx) may move generateMetadata into its Screen and drop the workaround | no code change upstream (Chair's direction: page.tsx stays a 1-line switch, isAllowedImportSource is not widened)
