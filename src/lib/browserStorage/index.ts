export type { StorageClient, StorageType } from "./types";
export {
  createStorageClient,
  localStorageClient,
  sessionStorageClient,
  saveToLocalStorage,
  loadFromLocalStorage,
  removeFromLocalStorage,
  saveToSessionStorage,
  loadFromSessionStorage,
  removeFromSessionStorage,
} from "./clientService";
export { useBrowserStorage } from "./useBrowserStorage";
export { useLocalStorage } from "./useLocalStorage";
export { useSessionStorage } from "./useSessionStorage";
