import { Folder, Message, Settings } from '@hugeicons/core-free-icons'
import { AppFileManager, AppSetting } from '../apps'
import { useWindows } from './provider'
import type { ReactElement } from 'react'

/** A desktop application that can be launched from the taskbar (or menus). */
export type AppEntry = {
    id: string
    name: string
    icon: (typeof Settings)
    content: ReactElement
}

export const MESSAGES_APP: AppEntry = {
    id: "messages",
    name: "Messages",
    icon: Message,
    content: <div className="text-sm">Message inbox content goes here.</div>,
}

export const FILES_APP: AppEntry = {
    id: "files",
    name: "File Manager",
    icon: Folder,
    content: <AppFileManager />,
}

export const SETTINGS_APP: AppEntry = {
    id: "settings",
    name: "Settings",
    icon: Settings,
    content: <AppSetting />,
}

/** Hand-registered app list shown in the taskbar. */
export const APPS: AppEntry[] = [MESSAGES_APP, FILES_APP, SETTINGS_APP]

/**
 * Opens an app window, mirroring the taskbar behaviour:
 * - `toggleFocused` (taskbar): a focused, visible window is minimized on click.
 * - otherwise (context menu): it is simply opened or focused.
 */
export const useAppLauncher = () => {
    const { openWindow, focusWindow, minimizeWindow, windows } = useWindows()

    return (app: AppEntry, toggleFocused = true) => {
        const existing = windows[app.id]
        if (!existing) {
            openWindow({ id: app.id, title: app.name, content: app.content })
        } else if (toggleFocused && existing.isFocused && !existing.isMinimized) {
            minimizeWindow(app.id)
        } else {
            focusWindow(app.id)
        }
    }
}
