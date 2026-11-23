# DOWNSTREAM NOTICE id:20261123-040750-currency-icon-override
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-23T04:07:50Z
severity: info
checkpoint: currency-icon-override
resolves: 20261123-130541-wallet-currency-icon-override
change: wallet currency icons can come from the Icons shelf: src/domains/core/wallet/config.ui.ts overrideImports = ["lucide-react", "@/components/Icons"] (the user frame's precedent), currencyIcons typed IconComponent | the override src/config/domains/wallet.ui.config.ts may import a shelf icon, incl. a fork's own image icon unit
- card items/components/Icons.md icon_define_place: upstream defines icons in definitions.ts; a fork defines its own icons in its own unit file directly under src/components/Icons/ (a line in its section of src/components/CATALOG.md), never in definitions.ts (key unchanged, content widened; `change:` names the fork's add)
why: the override allowed only lucide-react, so lint config-overrides/literal-only rejected a fork's image icons (e.g. pandora's coin / ticket icons) and a fork could not show its currencies with its own art without editing core
required_actions: none
verify: pnpm test eslint-rules/config-overrides.test.mjs | pnpm typecheck | pnpm workflow ownership check
manual_steps: -
refs: src/domains/core/wallet/config.ui.ts | src/config/domains/wallet.ui.config.ts | src/components/Icons/README.md (fork が自分のアイコンを足す) | .claude/rules/items/components/Icons.md | order 20261123-130541-wallet-currency-icon-override
notes: fork steps for image currency icons (e.g. pandora: PandoraCoinIcon / SpTicketIcon from @/lib/pandoraIcons): 1 move each icon to its own unit src/components/Icons/<Name>.tsx (createImageIcon + iconPath, images in public/assets/icons/) | 2 add its line to your section of src/components/CATALOG.md | 3 in src/config/domains/wallet.ui.config.ts `import { PandoraCoinIcon } from "@/components/Icons/<Name>";` and `export default { currencyIcons: { <walletType>: PandoraCoinIcon } } satisfies WalletUiOverride;` | 4 the other readers (HeaderCoinDisplay etc.) import the same unit; drop the old module | literal-only forks need nothing | no DB change
