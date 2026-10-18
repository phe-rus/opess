import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { settingsOptions, updateSettings } from "@/hooks/use-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ThemeSetting } from "@/lib/store";

type ThemeContextValue = {
  /** The saved preference: `light`, `dark`, or `system`. */
  theme: ThemeSetting;
  /** Whether the resolved theme is dark right now. */
  isDark: boolean;
  /** True while a new theme is being written to the store. */
  isSaving: boolean;
  /** Persist a new theme preference through the store. */
  setTheme: (theme: ThemeSetting) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads the `appearance.theme` setting from the data & config store and turns it
 * into the concrete theme. `system` follows the OS preference (SSR safe: it
 * starts light and syncs after mount). Writing a theme persists it through the
 * store, so it survives a reload and a server restart (spec AC-2).
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(settingsOptions);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const theme: ThemeSetting = data.ok ? data.data["appearance.theme"] : "light";
  const isDark = theme === "dark" || (theme === "system" && prefersDark);

  const mutation = useMutation({
    mutationFn: (next: ThemeSetting) => updateSettings({ data: { "appearance.theme": next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store", "settings"] }),
  });

  const setTheme = useCallback((next: ThemeSetting) => mutation.mutate(next), [mutation]);

  const value = useMemo(
    () => ({ theme, isDark, isSaving: mutation.isPending, setTheme }),
    [theme, isDark, mutation.isPending, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
