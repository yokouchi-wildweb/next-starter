// src/wiring/screen.tsx
// 画面の作り手の設定済み版: lib/screens の createScreenMaker に既定の待つ間の表示(src/app/_layout/ScreenWait の 1 行スイッチ、fork は .replace で替える)を結ぶ。
// 画面(_screen/<Name>Screen.tsx・fork の _components/<X>Screen.tsx)はここの createScreen で書く。データに届かない。手順: src/lib/screens/README.md

import { createScreenMaker } from "@/lib/screens";
import { ScreenWait } from "@/app/_layout/ScreenWait";

export const createScreen = createScreenMaker({ defaultFallback: <ScreenWait /> });
