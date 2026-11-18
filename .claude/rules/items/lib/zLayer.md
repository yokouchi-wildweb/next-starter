---
paths:
  - "src/lib/zLayer/**"
  - "src/config/lib/zLayer.config.ts"
---
# lib/zLayer
what: the TS side of the stacking layer names (Z_LAYER_NAMES, ZLayerName, PAGE_LAYER_NAMES, zLayerClass, isAboveFloatingTarget); values and classes live in src/styles/core/z-layer.css (own layers: src/styles/z-layer.css, generated); closed lib, entry @/lib/zLayer
use: always
change: placement = src/config/lib/zLayer.config.ts (own layers, then pnpm generate styles)
rules:
using:
- class_via_fn: a layer class comes from zLayerClass(name), never a per-part table of class names
- page_layers_only: page elements, full-screen parts and fork effects pick from PAGE_LAYER_NAMES; floating, toast and cover belong to the parts that own them
- own_layer_scope: a layer of your own is used only for your own page elements and FullScreen's layer, never for floating things
- outside_press: a self-built floating thing on Radix calls isAboveFloatingTarget in onInteractOutside
editing:
- names_with_css: adding or removing a name changes src/styles/core/z-layer.css (@theme inline, :root values, utilities) in the same change; zLayer.test.ts compares them
read: use a layer → Usage | which name for what → API | add your own layer → Extension | scope of a name, outside press → Internals
