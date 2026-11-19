---
paths:
  - "src/lib/gradient/**"
  - "src/config/lib/gradient.config.ts"
---
# lib/gradient
what: gradient design tokens with one source for TS and CSS (listGradients / getGradient, generated gradient.css utilities) and the color value model (default / solid / gradient), entry @/lib/gradient
use: always
change: placement → src/config/lib/gradient.config.ts (customGradients), then pnpm generate styles
rules:
using:
- grad_extend_config: a fork adds tokens in src/config/lib/gradient.config.ts, never edits gradient.css or tokens.base.ts
- grad_regenerate: after a token change run pnpm generate styles and commit the generated CSS
- grad_runtime_value: runtime use (picker, inline style, canvas) takes listGradients() cssValue, not a CSS class
- grad_register_rare: registerGradients only for dynamic runtime additions; static additions go to the config
- grad_default_meaning: the meaning of "default" comes from the caller (resolveColorValue ctx.resolveDefault, ColorValueInput props)
editing:
- grad_pure_ts: the lib stays pure TS without React (the picker UI lives in Form/Input)
read: add tokens, regenerate → Usage | registry, color value, helpers → API | picker → Extension | single source and generation → Internals
