---
paths:
  - "src/components/Animation/**"
---
# components/Animation
what: motion parts, props only: CountUp (@/components/Animation/CountUp, counts a number up) and PageTransition (@/components/Animation/PageTransition, the depth-based slide between pages, wrapped around children in a layout)
use: always
change: none → /order <direct parent>
rules:
using:
- fixed_inside: a range whose pages hold position: fixed overlays → PageTransition contain={false} (the default containment makes the wrapper their containing block) | never copy PageTransition or read its inner FrozenRouter
editing:
- entry_only: PageTransition's inner parts (FrozenRouter) stay out of its entry | a caller's need = a value prop on PageTransition
read:
- PageTransition: use, contain → src/components/Animation/PageTransition/README.md Usage | props → src/components/Animation/PageTransition/README.md API | FrozenRouter, transform → src/components/Animation/PageTransition/README.md Internals
