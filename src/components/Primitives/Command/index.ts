// src/components/Primitives/Command/index.ts
// 入口(re-export だけ): コマンドパレット(検索付きリスト)の低レベル部品(cmdk。旧 _shadcn/command + Overlays/CommandPrimitives)。
// フォームの検索付き選択は Form/Input/Manual の ComboboxInput など、大量マスタからの選択は Overlays/AsyncPickerModal
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./Command";
