import React, { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { clamp, getViewport } from "@/components/windows-manager/viewport"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { WidgetLayout } from "@/hooks/use-widget-dock"

const MIN_WIDGET_WIDTH = 160
const MIN_WIDGET_HEIGHT = 96

/** Movement in pixels before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 4

type DragState = {
    startX: number
    startY: number
    offsetX: number
    offsetY: number
    width: number
    height: number
    moved: boolean
}

type ResizeState = {
    startX: number
    startY: number
    width: number
    height: number
}

type WidgetDockProps = {
    id: string
    layout: WidgetLayout | undefined
    onDock: (id: string, layout: WidgetLayout) => void
    onUndock: (id: string) => void
    children: React.ReactNode
}

/**
 * Makes a widget movable and resizable on the desktop.
 *
 * Without a saved layout the widget flows in the default layout (the side strip
 * or column) at its natural content size. The first drag docks it at a fixed
 * size, the corner handle resizes it, and the layout is remembered.
 * Double click a docked widget to send it back to the default layout.
 * Dragging and resizing only work in the desktop layout (md and up), so small
 * screens keep their scrollable strip.
 */
export const WidgetDock = ({ id, layout, onDock, onUndock, children }: WidgetDockProps) => {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const ref = useRef<HTMLDivElement>(null)
    const dragRef = useRef<DragState | null>(null)
    const resizeRef = useRef<ResizeState | null>(null)

    const docked = isDesktop && layout ? layout : null

    // A resize must never strand a docked widget outside the screen: clamp it back in.
    useEffect(() => {
        if (!docked || !isDesktop) return
        const handleResize = () => {
            const element = ref.current
            if (!element) return
            const viewport = getViewport()
            const rect = element.getBoundingClientRect()
            const x = clamp(docked.x, 0, Math.max(0, viewport.width - rect.width))
            const y = clamp(
                docked.y,
                0,
                Math.max(0, viewport.height - viewport.taskbar - rect.height)
            )
            if (x !== docked.x || y !== docked.y) onDock(id, { ...docked, x, y })
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [docked, isDesktop, id, onDock])

    /* ------------------------------ Drag to move ------------------------------ */

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktop || e.button !== 0) return
        const element = ref.current
        if (!element) return
        const rect = element.getBoundingClientRect()
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            width: rect.width,
            height: rect.height,
            moved: false,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        if (!drag) return
        if (!drag.moved) {
            const past =
                Math.abs(e.clientX - drag.startX) >= DRAG_THRESHOLD ||
                Math.abs(e.clientY - drag.startY) >= DRAG_THRESHOLD
            if (!past) return
            drag.moved = true
        }
        // The offset math makes the widget detach from its slot without jumping.
        // The size captured at pointerdown is written into the layout, so a
        // docked widget stops resizing with its content.
        const viewport = getViewport()
        onDock(id, {
            x: clamp(e.clientX - drag.offsetX, 0, Math.max(0, viewport.width - drag.width)),
            y: clamp(
                e.clientY - drag.offsetY,
                0,
                Math.max(0, viewport.height - viewport.taskbar - drag.height)
            ),
            width: drag.width,
            height: drag.height,
        })
    }

    /* --------------------------- Resize from the corner --------------------------- */

    const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!docked || e.button !== 0) return
        e.stopPropagation()
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            width: docked.width ?? ref.current?.getBoundingClientRect().width ?? 0,
            height: docked.height ?? ref.current?.getBoundingClientRect().height ?? 0,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const resize = resizeRef.current
        if (!resize || !docked) return
        const viewport = getViewport()
        onDock(id, {
            ...docked,
            width: clamp(
                resize.width + (e.clientX - resize.startX),
                MIN_WIDGET_WIDTH,
                Math.max(MIN_WIDGET_WIDTH, viewport.width - docked.x)
            ),
            height: clamp(
                resize.height + (e.clientY - resize.startY),
                MIN_WIDGET_HEIGHT,
                Math.max(MIN_WIDGET_HEIGHT, viewport.height - viewport.taskbar - docked.y)
            ),
        })
    }

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current) {
            dragRef.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
            }
        }
        if (resizeRef.current) {
            resizeRef.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
            }
        }
    }

    return (
        <div
            ref={ref}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onDoubleClick={() => docked && onUndock(id)}
            style={
                docked
                    ? {
                          position: "fixed",
                          left: docked.x,
                          top: docked.y,
                          zIndex: 20,
                          width: docked.width,
                          height: docked.height,
                      }
                    : undefined
            }
            className={cn(
                "pointer-events-auto select-none overflow-hidden rounded-2xl shadow-lg",
                isDesktop && "touch-none cursor-grab active:cursor-grabbing"
            )}
        >
            {/* The widget itself: scrolls when the docked size is smaller than the content */}
            <div className="w-full h-full overflow-auto">{children}</div>

            {/* Resize corner, only available on a docked widget */}
            {docked && (
                <div
                    onPointerDown={handleResizeStart}
                    onPointerMove={handleResizeMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className={cn(
                        "absolute bottom-0 right-0 z-10 size-4 touch-none",
                        "cursor-nwse-resize rounded-bl-md",
                        "bg-olive-500/0 hover:bg-olive-500/40 active:bg-olive-500/60 transition-colors"
                    )}
                />
            )}
        </div>
    )
}
