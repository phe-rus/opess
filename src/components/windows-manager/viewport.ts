export const MIN_WINDOW_WIDTH = 280
export const MIN_WINDOW_HEIGHT = 180

/** How much of the titlebar must stay inside the viewport when clamping vertically. */
const TITLEBAR_MARGIN = 44

/** Space the taskbar occupies from the bottom edge, used when the DOM cannot be measured (SSR). */
const FALLBACK_TASKBAR_DESKTOP = 84
const FALLBACK_TASKBAR_MOBILE = 72

export type Viewport = {
    width: number
    height: number
    /** Space the taskbar occupies from the bottom edge of the screen, including the safe area inset. */
    taskbar: number
}

export const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max))

/**
 * Measures the real space the taskbar takes from the bottom of the screen by reading the
 * `[data-taskbar]` element, so the value always matches the layout (breakpoint, safe area).
 */
export const getTaskbarOffset = (): number => {
    if (typeof document === "undefined") return FALLBACK_TASKBAR_DESKTOP
    const taskbar = document.querySelector<HTMLElement>("[data-taskbar]")
    if (taskbar) {
        const occupied = window.innerHeight - taskbar.getBoundingClientRect().top
        if (occupied > 0 && occupied < window.innerHeight / 2) return occupied
    }
    return window.innerWidth >= 768 ? FALLBACK_TASKBAR_DESKTOP : FALLBACK_TASKBAR_MOBILE
}

export const getViewport = (): Viewport => {
    if (typeof window === "undefined") {
        return { width: 1440, height: 900, taskbar: FALLBACK_TASKBAR_DESKTOP }
    }
    return { width: window.innerWidth, height: window.innerHeight, taskbar: getTaskbarOffset() }
}

export const clampSize = (
    size: { width: number; height: number },
    viewport: Viewport
): { width: number; height: number } => ({
    width: clamp(size.width, MIN_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, viewport.width - 8)),
    height: clamp(
        size.height,
        MIN_WINDOW_HEIGHT,
        Math.max(MIN_WINDOW_HEIGHT, viewport.height - viewport.taskbar - 8)
    ),
})

export const clampPosition = (
    position: { x: number; y: number },
    size: { width: number; height: number },
    viewport: Viewport
): { x: number; y: number } => ({
    x: clamp(position.x, 0, Math.max(0, viewport.width - size.width)),
    y: clamp(
        position.y,
        0,
        Math.max(0, viewport.height - viewport.taskbar - TITLEBAR_MARGIN)
    ),
})

/** Sensible opening size: near full screen on small screens, a fixed 600x400 box on desktop. */
export const defaultWindowSize = (viewport: Viewport): { width: number; height: number } => {
    if (viewport.width < 640) {
        return clampSize(
            {
                width: viewport.width - 24,
                height: viewport.height - viewport.taskbar - 48,
            },
            viewport
        )
    }
    return clampSize({ width: 600, height: 400 }, viewport)
}
