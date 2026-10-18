import { Taskbar } from '@/components/windows-manager/taskbar'
import { Wallpaper, WallpaperProvider, useWallpaper } from '@/components/wallpapers'
import { ThemeProvider, useTheme } from '@/components/theme'
import { WindowsProvider } from '@/components/windows-manager/provider'
import { SETTINGS_APP, useAppLauncher } from '@/components/windows-manager/apps'
import { useFullscreen } from '@/hooks/use-fullscreen'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from "react"
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/(container)')({
    component: RouteComponent,
})

/** Approximate size of the context menu, used to keep it inside the viewport. */
const MENU_WIDTH = 192
const MENU_HEIGHT = 132

function RouteComponent() {
    return (
        <ThemeProvider>
            <WallpaperProvider>
                <WindowsProvider>
                    <Desktop />
                </WindowsProvider>
            </WallpaperProvider>
        </ThemeProvider>
    )
}

function Desktop() {
    const { current, nextWallpaper } = useWallpaper()
    const { isDark } = useTheme()
    const { isFullscreen, toggleFullscreen } = useFullscreen()
    const launchApp = useAppLauncher()
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F11') {
                e.preventDefault()
                toggleFullscreen()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleFullscreen])

    // One window level listener (capture phase) so right click always opens the
    // desktop menu, no matter where the event starts: wallpaper, widgets or windows.
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target instanceof HTMLElement ? e.target : null
            // Text fields and areas that opt out keep the native browser menu.
            if (target?.closest('input, textarea, select, [contenteditable="true"], [data-native-context]')) {
                return
            }
            e.preventDefault() // Prevents default web menu
            // Clamp so the menu never opens past the bottom or right edge of the screen.
            const x = Math.max(8, Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8))
            const y = Math.max(8, Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8))
            setContextMenu({ x, y })
        }
        window.addEventListener('contextmenu', handleContextMenu, true)
        return () => window.removeEventListener('contextmenu', handleContextMenu, true)
    }, [])

    const changeWallpaper = () => {
        nextWallpaper()
        setContextMenu(null)
    }

    return (
        <div
            className={cn("relative w-full h-svh overflow-hidden", isDark && "dark")}
            onClick={() => contextMenu && setContextMenu(null)}
        >
            <Wallpaper src={current} />

            <Outlet />

            <Taskbar />

            {/* Custom Context Menu */}
            {contextMenu && (
                <div
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="fixed z-9999 w-48 p-1 rounded-lg bg-popover border border-border shadow-xl text-sm"
                >
                    <button
                        onClick={changeWallpaper}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    >
                        Change Wallpaper
                    </button>
                    <button
                        onClick={() => {
                            toggleFullscreen()
                            setContextMenu(null)
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    >
                        {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                    </button>
                    <button
                        onClick={() => {
                            launchApp(SETTINGS_APP, false)
                            setContextMenu(null)
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    >
                        Display Settings
                    </button>
                </div>
            )}
        </div>
    )
}
