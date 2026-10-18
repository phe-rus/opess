import React, { createContext } from "react"

export type WindowRect = {
    position: { x: number; y: number }
    size: { width: number; height: number }
}

export type WindowConfig = {
    id: string
    title: string
    icon?: React.ComponentType<{ className?: string }>
    content: React.ReactNode
    isMinimized: boolean
    isMaximized: boolean
    isFocused: boolean
    zIndex: number
    position: { x: number; y: number }
    size: { width: number; height: number }
    /** Geometry to go back to when the window leaves the maximized state. */
    restoreRect: WindowRect | null
}

/** What callers pass to `openWindow`: everything required, geometry optional. */
export type WindowInput = Omit<
    WindowConfig,
    "isMinimized" | "isMaximized" | "isFocused" | "zIndex" | "position" | "size" | "restoreRect"
> &
    Partial<Pick<WindowConfig, "position" | "size">>

export type WindowsContextType = {
    windows: Record<string, WindowConfig>
    openWindow: (config: WindowInput) => void
    closeWindow: (id: string) => void
    minimizeWindow: (id: string) => void
    maximizeWindow: (id: string) => void
    focusWindow: (id: string) => void
    updateWindowPosition: (id: string, position: { x: number; y: number }) => void
    updateWindowSize: (id: string, size: { width: number; height: number }) => void
}

export const WindowsContext = createContext<WindowsContextType | null>(null)
