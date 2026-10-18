import { useCallback, useEffect, useState } from "react"

/**
 * Where each widget is docked on the desktop, keyed by widget id.
 * `width` and `height` are set once the user resizes (or first drags) the widget,
 * which is what makes the size stick instead of following the content.
 *
 * Persisted in localStorage for now. When the database lands, only the two
 * effects below need to be replaced with API calls; the rest of the API stays.
 */
const STORAGE_KEY = "opess.widget-dock"

export type WidgetLayout = {
    x: number
    y: number
    width?: number
    height?: number
}

const isWidgetLayout = (value: unknown): value is WidgetLayout => {
    if (!value || typeof value !== "object") return false
    const layout = value as WidgetLayout
    if (!Number.isFinite(layout.x) || !Number.isFinite(layout.y)) return false
    if (layout.width !== undefined && !Number.isFinite(layout.width)) return false
    if (layout.height !== undefined && !Number.isFinite(layout.height)) return false
    return true
}

const readStoredLayouts = (): Record<string, WidgetLayout> => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
        const entries = Object.entries(parsed as Record<string, unknown>).filter(
            (entry): entry is [string, WidgetLayout] => isWidgetLayout(entry[1])
        )
        return Object.fromEntries(entries)
    } catch {
        // Corrupted or unavailable storage: fall back to the default layout.
        return {}
    }
}

export const useWidgetDock = () => {
    const [layouts, setLayouts] = useState<Record<string, WidgetLayout>>({})
    const [isLoaded, setIsLoaded] = useState(false)

    // Load after mount so the server render and the first client render match.
    useEffect(() => {
        setLayouts(readStoredLayouts())
        setIsLoaded(true)
    }, [])

    // Persist every change. Skipped until the initial load finished,
    // so the empty first state never wipes what was stored.
    useEffect(() => {
        if (!isLoaded) return
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
        } catch {
            // Storage full or blocked: the layout simply will not be remembered.
        }
    }, [layouts, isLoaded])

    const dock = useCallback((id: string, layout: WidgetLayout) => {
        setLayouts((prev) => ({ ...prev, [id]: layout }))
    }, [])

    const undock = useCallback((id: string) => {
        setLayouts((prev) => {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
        })
    }, [])

    return { layouts, dock, undock }
}
