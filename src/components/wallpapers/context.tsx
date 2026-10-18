import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export const WALLPAPERS = [
    "https://cdn.prod.website-files.com/5350028b1443eefb41001752/5fa0e9d751a3e73188ac41ea_ChromeOS-06.jpg",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
]

type WallpaperContextValue = {
    /** Currently applied wallpaper URL. */
    current: string
    /** Apply a specific wallpaper. */
    setWallpaper: (src: string) => void
    /** Cycle to the next wallpaper in the list (desktop menu action). */
    nextWallpaper: () => void
}

const WallpaperContext = createContext<WallpaperContextValue | null>(null)

export const WallpaperProvider = ({ children }: { children: ReactNode }) => {
    const [current, setCurrent] = useState(WALLPAPERS[0])

    const setWallpaper = useCallback((src: string) => setCurrent(src), [])

    const nextWallpaper = useCallback(
        () =>
            setCurrent((prev) => {
                const index = WALLPAPERS.indexOf(prev)
                return WALLPAPERS[(index + 1) % WALLPAPERS.length]
            }),
        []
    )

    const value = useMemo(
        () => ({ current, setWallpaper, nextWallpaper }),
        [current, setWallpaper, nextWallpaper]
    )

    return <WallpaperContext.Provider value={value}>{children}</WallpaperContext.Provider>
}

export const useWallpaper = () => {
    const context = useContext(WallpaperContext)
    if (!context) throw new Error('useWallpaper must be used within WallpaperProvider')
    return context
}
