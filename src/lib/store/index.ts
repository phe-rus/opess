/**
 * The opess data & config store (spec 0001). Server only: the browser reaches
 * it through the server functions in `@/hooks/use-store`, never directly.
 *
 * Never import this module from a client component, and never import
 * `readSecrets` / `writeSecrets` into a client callable server function.
 */
export {
  getAccount,
  getConfigLocation,
  getDesktop,
  getSettings,
  listApps,
  readSecrets,
  removeApp,
  StoreFailure,
  updateDesktop,
  updateSettings,
  upsertApp,
  writeSecrets,
} from "./store";

export { CURRENT_VERSIONS, MIGRATIONS } from "./migrations";
export type { Migration } from "./migrations";
export { defaultSecrets } from "./crypto";
export type { SecretEnvelope } from "./crypto";

export type {
  AccountRecord,
  AppKind,
  AppRecord,
  CollectionName,
  ConfigLocation,
  DesktopDocument,
  JsonValue,
  SecretKey,
  Secrets,
  Settings,
  StoreErrorCode,
  StoreResult,
  StoreWarning,
  ThemeSetting,
} from "./types";
