---
paths:
  - "src/lib/fonts/**"
---
# lib/fonts
what: the web-font setting: fontsConfig (the config values file @lib-config/fonts.ui composed with @/lib/defineConfig; className for <html>), the fixed variable names and the FontsOverride type | entry @/lib/fonts
use: always
change: counterpart = src/config/lib/fonts.ui.config.ts (next/font loaders at top level, literal args) | anything else → /order <direct parent>
rules:
using:
- root_layout_only: fontsConfig is read as a value only by the root layout (next/font in the config values file runs only inside the Next compiler); others read the types
- fixed_variable: a loader's variable is "--font-sans-loaded" (sans) or "--font-mono-loaded" (mono), written as a literal (src/lib/fonts/fonts.test.mjs reads the config values file's text)
editing:
- tests_without_override: tests read settings.ts (buildFontsConfig) and pass config values to it, never config.ui.ts
read: setting up web fonts → src/styles/Extension.md Extension | the tests → src/styles/README.md Verification
