import { useCallback, useEffect, useState } from "react"

/** Browser fullscreen on the whole document, toggled from the context menu or F11. */
export const useFullscreen = () => {
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
        handleChange()
        document.addEventListener("fullscreenchange", handleChange)
        return () => document.removeEventListener("fullscreenchange", handleChange)
    }, [])

    const toggleFullscreen = useCallback(() => {
        if (typeof document === "undefined" || !document.documentElement.requestFullscreen) return
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
        } else {
            document.documentElement.requestFullscreen().catch(() => {})
        }
    }, [])

    return { isFullscreen, toggleFullscreen }
}
