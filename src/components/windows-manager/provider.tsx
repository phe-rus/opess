import { WindowsContext, type WindowConfig, type WindowInput } from "./context"
import { useCallback, useContext, useEffect, useState } from "react"
import { clampPosition, clampSize, defaultWindowSize, getViewport } from "./viewport"

/**
 * Windows always start above the widget layer (widgets sit at z 10) and below the
 * taskbar (z 1000) and tooltips (z 9999), so the base has to sit between them.
 */
const WINDOW_Z_BASE = 100

const topZIndex = (windows: Record<string, WindowConfig>) =>
    Object.values(windows).reduce((top, win) => Math.max(top, win.zIndex), WINDOW_Z_BASE)

/** Focuses exactly one window and puts it on top, clears focus from every other window. */
const focusOnly = (windows: Record<string, WindowConfig>, id: string, zIndex: number) => {
    const next: Record<string, WindowConfig> = {}
    for (const [key, win] of Object.entries(windows)) {
        next[key] =
            key === id
                ? { ...win, isFocused: true, isMinimized: false, zIndex }
                : { ...win, isFocused: false }
    }
    return next
}

/** Gives focus to the topmost window that is not minimized. */
const promoteTopmost = (windows: Record<string, WindowConfig>) => {
    const candidate = Object.values(windows)
        .filter((win) => !win.isMinimized)
        .reduce<WindowConfig | null>((top, win) => (!top || win.zIndex > top.zIndex ? win : top), null)
    if (!candidate) return windows
    return { ...windows, [candidate.id]: { ...candidate, isFocused: true } }
}

export const WindowsProvider = ({ children }: { children: React.ReactNode }) => {
    const [windows, setWindows] = useState<Record<string, WindowConfig>>({})

    const focusWindow = useCallback((id: string) => {
        setWindows((prev) => {
            const target = prev[id]
            if (!target) return prev
            // Already the focused window: nothing to change, no z-index churn.
            if (target.isFocused && !target.isMinimized) return prev
            return focusOnly(prev, id, topZIndex(prev) + 1)
        })
    }, [])

    const openWindow = useCallback((config: WindowInput) => {
        const viewport = getViewport()
        setWindows((prev) => {
            const existing = prev[config.id]
            if (existing) {
                // Already open: bring it back to the front instead of duplicating it.
                return focusOnly(prev, config.id, topZIndex(prev) + 1)
            }
            const size = config.size ?? defaultWindowSize(viewport)
            const position = clampPosition(
                config.position ?? {
                    x: 48 + Object.keys(prev).length * 24,
                    y: 48 + Object.keys(prev).length * 24,
                },
                size,
                viewport
            )
            return {
                ...prev,
                [config.id]: {
                    ...config,
                    isMinimized: false,
                    isMaximized: false,
                    isFocused: true,
                    zIndex: topZIndex(prev) + 1,
                    position,
                    size,
                    restoreRect: null,
                },
            }
        })
    }, [])

    const closeWindow = useCallback((id: string) => {
        setWindows((prev) => {
            const target = prev[id]
            if (!target) return prev
            const next = { ...prev }
            delete next[id]
            return target.isFocused ? promoteTopmost(next) : next
        })
    }, [])

    const minimizeWindow = useCallback((id: string) => {
        setWindows((prev) => {
            const target = prev[id]
            if (!target) return prev
            const next = { ...prev, [id]: { ...target, isMinimized: true, isFocused: false } }
            return target.isFocused ? promoteTopmost(next) : next
        })
    }, [])

    const maximizeWindow = useCallback((id: string) => {
        const viewport = getViewport()
        setWindows((prev) => {
            const target = prev[id]
            if (!target) return prev
            const focused = focusOnly(prev, id, topZIndex(prev) + 1)
            if (target.isMaximized) {
                const rect = target.restoreRect
                if (!rect) {
                    return { ...focused, [id]: { ...focused[id], isMaximized: false, restoreRect: null } }
                }
                const size = clampSize(rect.size, viewport)
                return {
                    ...focused,
                    [id]: {
                        ...focused[id],
                        isMaximized: false,
                        position: clampPosition(rect.position, size, viewport),
                        size,
                        restoreRect: null,
                    },
                }
            }
            return {
                ...focused,
                [id]: {
                    ...focused[id],
                    isMaximized: true,
                    restoreRect: { position: target.position, size: target.size },
                },
            }
        })
    }, [])

    const updateWindowPosition = useCallback(
        (id: string, position: { x: number; y: number }) => {
            const viewport = getViewport()
            setWindows((prev) => {
                const target = prev[id]
                if (!target || target.isMaximized) return prev
                return { ...prev, [id]: { ...target, position: clampPosition(position, target.size, viewport) } }
            })
        },
        []
    )

    const updateWindowSize = useCallback((id: string, size: { width: number; height: number }) => {
        const viewport = getViewport()
        setWindows((prev) => {
            const target = prev[id]
            if (!target || target.isMaximized) return prev
            const nextSize = clampSize(size, viewport)
            return {
                ...prev,
                [id]: { ...target, size: nextSize, position: clampPosition(target.position, nextSize, viewport) },
            }
        })
    }, [])

    // Keep every window inside the viewport when the screen size or orientation changes.
    useEffect(() => {
        const handleViewportResize = () => {
            const viewport = getViewport()
            setWindows((prev) => {
                let changed = false
                const next = { ...prev }
                for (const [id, win] of Object.entries(prev)) {
                    if (win.isMaximized) continue
                    const size = clampSize(win.size, viewport)
                    const position = clampPosition(win.position, size, viewport)
                    if (
                        size.width !== win.size.width ||
                        size.height !== win.size.height ||
                        position.x !== win.position.x ||
                        position.y !== win.position.y
                    ) {
                        next[id] = { ...win, size, position }
                        changed = true
                    }
                }
                return changed ? next : prev
            })
        }
        window.addEventListener("resize", handleViewportResize)
        return () => window.removeEventListener("resize", handleViewportResize)
    }, [])

    return (
        <WindowsContext.Provider
            value={{
                windows,
                openWindow,
                closeWindow,
                minimizeWindow,
                maximizeWindow,
                focusWindow,
                updateWindowPosition,
                updateWindowSize,
            }}
        >
            {children}
        </WindowsContext.Provider>
    )
}

export const useWindows = () => {
    const context = useContext(WindowsContext)
    if (!context) throw new Error("useWindows must be used within a WindowsProvider")
    return context
}
