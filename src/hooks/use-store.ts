import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import {
  getAccount as readAccount,
  getConfigLocation as readConfigLocation,
  getDesktop as readDesktop,
  getSettings as readSettings,
  listApps as readApps,
  removeApp as deleteApp,
  updateDesktop as saveDesktop,
  updateSettings as saveSettings,
  upsertApp as saveApp,
} from "@/lib/store";

/**
 * Server functions over the data & config store (spec 0001). The browser never
 * touches disk: every read and write goes through one of these, and no client
 * module imports the server only store directly (AC-9).
 */

export const getSettings = createServerFn({ method: "GET" }).handler(() => readSettings());

export const updateSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as Record<string, unknown>)
  .handler(({ data }) => saveSettings(data));

export const getDesktop = createServerFn({ method: "GET" }).handler(() => readDesktop());

export const updateDesktop = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(({ data }) => saveDesktop(data));

export const listApps = createServerFn({ method: "GET" }).handler(() => readApps());

export const upsertApp = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(({ data }) => saveApp(data));

export const removeApp = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as string)
  .handler(({ data }) => deleteApp(data));

export const getAccount = createServerFn({ method: "GET" }).handler(() => readAccount());

export const getConfigLocation = createServerFn({ method: "GET" }).handler(() =>
  readConfigLocation(),
);

export const settingsOptions = queryOptions({
  queryKey: ["store", "settings"],
  queryFn: () => getSettings(),
  staleTime: Infinity,
  refetchOnWindowFocus: false,
});

export const desktopOptions = queryOptions({
  queryKey: ["store", "desktop"],
  queryFn: () => getDesktop(),
  staleTime: Infinity,
  refetchOnWindowFocus: false,
});

export const appsOptions = queryOptions({
  queryKey: ["store", "apps"],
  queryFn: () => listApps(),
  staleTime: Infinity,
  refetchOnWindowFocus: false,
});

export const accountOptions = queryOptions({
  queryKey: ["store", "account"],
  queryFn: () => getAccount(),
  staleTime: Infinity,
  refetchOnWindowFocus: false,
});

export const configLocationOptions = queryOptions({
  queryKey: ["store", "config-location"],
  queryFn: () => getConfigLocation(),
  staleTime: Infinity,
  refetchOnWindowFocus: false,
});
