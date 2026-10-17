// src/components/Overlays/CommandPrimitives.tsx
//
// コマンドパレット(検索付きリスト)の低レベル部品。_shadcn/command のプロジェクト向け入口。
// src/components 外(features / lib / app)から _shadcn/command を直接 import せず、ここを経由する
// (見た目の調整や差し替えをこの 1 ファイルで行えるようにするため。DialogPrimitives と同じ位置づけ)。
//
// 用途: 管理コマンドパレット(features/core/adminCommand)など「入力 + 候補リスト」を自前で組む場合。
// フォームの選択入力には使わない(検索付き選択は Form/Input/Manual の ComboboxInput /
// AsyncComboboxInput / MultiSelectInput、大量マスタからの選択は Overlays/AsyncPickerModal)。

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
} from "@/components/_shadcn/command";
