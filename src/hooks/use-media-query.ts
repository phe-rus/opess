import { useEffect, useState } from "react"

/**
 * SSR safe matchMedia subscription: starts as false so the first client render
 * matches the server render, then syncs with the real value after mount.
 */
export const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia(query)
        const handleChange = () => setMatches(mediaQuery.matches)
        handleChange()
        mediaQuery.addEventListener("change", handleChange)
        return () => mediaQuery.removeEventListener("change", handleChange)
    }, [query])

    return matches
}
