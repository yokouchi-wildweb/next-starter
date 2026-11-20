---
paths:
  - "src/components/Overlays/**"
---
# components/Overlays
what: finished overlay parts (dialogs, modals, popovers, tooltips, loading …) and BodyPortal (portal into body after mount, for own overlays), entries @/components/Overlays/<Name>
use: always
change: none → /order <direct parent>
rules:
using:
- dialog_close_path: Dialog with both buttons hidden → showCloseButton
- modal_height: never budget header / footer height into maxHeight | an inner scroll pane = scrollable={false} + its own `min-h-0 overflow-y-auto`
- modal_footer: an always-visible action bar = `footer` prop, never a hand-built sticky bar
- modal_close_guard: a dirty-form guard = confirmOnClose | more than its 4 texts → your own guard in onOpenChange
- open_auto_focus: preventDefault on auto focus → also focus the box or an inner element
- picker_choice: N from a large master → AsyncPickerModal, never Modal + AsyncMultiSelectInput | ChecklistPopover = static options
- primitives_last: Primitives/Dialog only for an overlay Dialog / Modal cannot build | Primitives/Command never for form selects | the general rule = core/components.md primitives_last
- confirm_in_code: useConfirm only where code awaits yes / no, confirmDialog once per screen | notice only → toast
- loading_choice: which loader = core/components.md loading (InlineLoader / ScreenLoader / Button loading) | no hand-built Spinner block, no app-wide route-transition overlay
- checklist_create: after onCreateOption the parent updates `options`
- hint_choice: short hover hint → Tooltip / HelpTip | click or long text → InfoPopover
- portal_choice: an own piece that must escape its ancestors' stacking → BodyPortal, or the container prop of the overlay part that already has one (core/components.md stacking and portal) | never wrap a finished overlay in BodyPortal
- portal_client_only: BodyPortal draws nothing before mount (useIsClient) → never rely on its children in server-rendered markup
- above_floating_presses: a press inside the toast or cover layer is not an outside press: floating parts (Primitives Dialog / Popover, Sheet) check isAboveFloatingTarget before closing
editing:
- confirm_on_close_frozen: confirmOnClose stays 4 texts + the shared Dialog look (no variant / JSX / UI options)
- action_popover_loading: ActionPopover keeps its per-item loading look (not Button's)
- picker_popover_scroll: a popover with its own scrolling list caps its root with PICKER_POPOVER_BODY_CLASS
read: pick a part → Overview | Dialog / Modal / TabbedModal → Usage | props → API | height, focus → Internals | BodyPortal → Usage | popovers → src/components/Overlays/Popover/README.md Usage | other parts → Related
