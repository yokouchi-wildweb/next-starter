// 1 行スイッチ: AppProviders の一番内側の fork の口。上流の既定 = ./ForkProviders.default(空の素通し)。fork の丸ごとの差し替え = ./ForkProviders.replace(この行をそちらへ向ける)
export { ForkProviders, type ForkProvidersProps } from "./ForkProviders.default";
