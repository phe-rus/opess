import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { WindowConfig } from "./context"
import { useWindows } from "./provider"
import {
    clamp,
    clampPosition,
    getViewport,
    MIN_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH,
} from "./viewport"
import { HugeiconsIcon } from "@hugeicons/react"
import { Minus, Square, X } from "@hugeicons/core-free-icons"
import { Button } from "../ui/button"

type DragState = {
    startX: number
    startY: number
    posX: number
    posY: number
    /** Where inside the window width (0 to 1) the pointer grabbed, used when restoring from maximized. */
    grabFraction: number
    /** False while a drag started on a maximized window and the restore has not happened yet. */
    restored: boolean
}

type ResizeState = {
    edge: string
    startX: number
    startY: number
    x: number
    y: number
    width: number
    height: number
}

const RESIZE_HANDLES: Array<{ edge: string; className: string }> = [
    { edge: "n", className: "top-0 inset-x-3 h-2 cursor-ns-resize" },
    { edge: "s", className: "bottom-0 inset-x-3 h-2 cursor-ns-resize" },
    { edge: "e", className: "right-0 inset-y-3 w-2 cursor-ew-resize" },
    { edge: "w", className: "left-0 inset-y-3 w-2 cursor-ew-resize" },
    { edge: "nw", className: "top-0 left-0 size-4 cursor-nwse-resize" },
    { edge: "ne", className: "top-0 right-0 size-4 cursor-nesw-resize" },
    { edge: "sw", className: "bottom-0 left-0 size-4 cursor-nesw-resize" },
    { edge: "se", className: "bottom-0 right-0 size-4 cursor-nwse-resize" },
]

/** Where the restored window sits under the cursor vertically when a drag pulls it out of maximized. */
const RESTORE_GRAB_OFFSET = 16

/** Length of the minimize and restore animation. */
const MINIMIZE_ANIM_MS = 320

/** Width of a taskbar icon, the size a window shrinks down to. */
const TASKBAR_ICON_SIZE = 44

type AnimPhase = "idle" | "anim"

export const WindowFrame = ({ window }: { window: WindowConfig }) => {
    const { focusWindow, closeWindow, minimizeWindow, maximizeWindow, updateWindowPosition, updateWindowSize } =
        useWindows()
    const dragRef = useRef<DragState | null>(null)
    const resizeRef = useRef<ResizeState | null>(null)
    const [animPhase, setAnimPhase] = useState<AnimPhase>("idle")

    // The window stays mounted while minimized so it can animate away. The
    // transition classes linger while it sits in the taskbar, which is what
    // lets the restore animate back out.
    useEffect(() => {
        if (window.isMinimized) {
            setAnimPhase("anim")
            return
        }
        if (animPhase === "idle") return
        const timer = setTimeout(() => setAnimPhase("idle"), MINIMIZE_ANIM_MS + 20)
        return () => clearTimeout(timer)
    }, [window.isMinimized, animPhase])

    /**
     * macOS style minimize: the window shrinks toward its taskbar icon.
     * Computed from the current geometry so it also works from maximized.
     */
    const getMinimizeTransform = (): string => {
        const viewport = getViewport()
        const width = window.isMaximized ? viewport.width : window.size.width
        const height = window.isMaximized ? viewport.height - viewport.taskbar : window.size.height
        const icon =
            typeof document !== "undefined" &&
            document.querySelector<HTMLElement>(`[data-taskbar-app="${window.id}"]`)?.getBoundingClientRect()
        const targetX = icon ? icon.left + icon.width / 2 : viewport.width / 2
        const targetY = icon ? icon.top + icon.height / 2 : viewport.height - viewport.taskbar / 2
        const scale = Math.max(0.04, Math.min(TASKBAR_ICON_SIZE / width, TASKBAR_ICON_SIZE / height))
        return `translate3d(${targetX - width / 2}px, ${targetY - height / 2}px, 0) scale(${scale})`
    }

    const isMinimized = window.isMinimized

    const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        const viewport = getViewport()
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            posX: window.position.x,
            posY: window.position.y,
            grabFraction: window.isMaximized ? clamp(e.clientX / viewport.width, 0, 1) : 0,
            restored: !window.isMaximized,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        if (!drag) return

        // A drag started on a maximized window: restore it under the cursor first.
        if (window.isMaximized && !drag.restored) {
            const viewport = getViewport()
            const restoreSize = window.restoreRect?.size ?? window.size
            const position = clampPosition(
                {
                    x: e.clientX - drag.grabFraction * restoreSize.width,
                    y: e.clientY - RESTORE_GRAB_OFFSET,
                },
                restoreSize,
                viewport
            )
            maximizeWindow(window.id)
            updateWindowPosition(window.id, position)
            dragRef.current = {
                ...drag,
                restored: true,
                startX: e.clientX,
                startY: e.clientY,
                posX: position.x,
                posY: position.y,
            }
            return
        }

        updateWindowPosition(window.id, {
            x: drag.posX + (e.clientX - drag.startX),
            y: drag.posY + (e.clientY - drag.startY),
        })
    }

    const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return
        dragRef.current = null
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
        }
    }

    const handleDragCancel = () => {
        dragRef.current = null
    }

    /* ---------------------------- Resize from edges ---------------------------- */

    const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, edge: string) => {
        if (e.button !== 0) return
        resizeRef.current = {
            edge,
            startX: e.clientX,
            startY: e.clientY,
            x: window.position.x,
            y: window.position.y,
            width: window.size.width,
            height: window.size.height,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const resize = resizeRef.current
        if (!resize) return
        const viewport = getViewport()

        const dx = e.clientX - resize.startX
        const dy = e.clientY - resize.startY
        const growLeft = resize.edge.includes("w")
        const growTop = resize.edge.includes("n")
        const growRight = resize.edge.includes("e")
        const growBottom = resize.edge.includes("s")

        // Each edge may travel as far as the screen allows: the far edge stays fixed.
        const maxWidth = growLeft ? resize.x + resize.width : viewport.width - resize.x
        const maxHeight = growTop
            ? resize.y + resize.height
            : viewport.height - viewport.taskbar - resize.y
        const deltaWidth = growRight ? dx : growLeft ? -dx : 0
        const deltaHeight = growBottom ? dy : growTop ? -dy : 0

        const width = clamp(resize.width + deltaWidth, MIN_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, maxWidth))
        const height = clamp(
            resize.height + deltaHeight,
            MIN_WINDOW_HEIGHT,
            Math.max(MIN_WINDOW_HEIGHT, maxHeight)
        )

        // Size first: the provider clamps the position against the new size, then the new position lands.
        updateWindowSize(window.id, { width, height })
        updateWindowPosition(window.id, {
            x: growLeft ? resize.x + (resize.width - width) : resize.x,
            y: growTop ? resize.y + (resize.height - height) : resize.y,
        })
    }

    const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return
        resizeRef.current = null
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
        }
    }

    const handleResizeCancel = () => {
        resizeRef.current = null
    }

    // Geometry: where the window sits right now. The size always stays applied,
    // even while minimized, so the shrink animation scales the real window.
    const baseStyle: React.CSSProperties = window.isMaximized
        ? {
              top: 0,
              left: 0,
              width: "100%",
              height: "calc(100% - var(--taskbar-offset, 4.5rem))",
          }
        : {
              transform: `translate3d(${window.position.x}px, ${window.position.y}px, 0)`,
              width: `${window.size.width}px`,
              height: `${window.size.height}px`,
          }

    // While minimized the window shrinks toward its taskbar icon and fades out.
    const geometryStyle: React.CSSProperties = isMinimized
        ? {
              ...baseStyle,
              transform: getMinimizeTransform(),
              opacity: 0,
              visibility: "hidden",
              pointerEvents: "none",
          }
        : baseStyle

    // Only carry a transition while an animation is running, otherwise dragging
    // and resizing would lag behind the pointer.
    const shouldAnimate = animPhase === "anim" || isMinimized
    const transitionStyle: React.CSSProperties = shouldAnimate
        ? {
              transitionProperty: "transform, opacity, visibility",
              transitionDuration: `${MINIMIZE_ANIM_MS}ms, ${MINIMIZE_ANIM_MS}ms, 0s`,
              // Minimizing: visibility flips off only after the shrink finished.
              // Restoring: visible right away so the grow out of the taskbar shows.
              transitionDelay: isMinimized
                  ? `0ms, 0ms, ${MINIMIZE_ANIM_MS}ms`
                  : "0ms, 0ms, 0ms",
              transitionTimingFunction: isMinimized ? "ease-in" : "ease-out",
          }
        : {}

    return (
        <div
            onPointerDown={() => focusWindow(window.id)}
            style={{
                zIndex: window.zIndex,
                ...geometryStyle,
                ...transitionStyle,
            }}
            className={cn(
                "absolute top-0 left-0 flex flex-col rounded-3xl border bg-background/55 backdrop-blur-md",
                window.isFocused ? "border-olive-500/15 ring-px ring-olive-500/5" : "border-border/15 opacity-95",
                "shadow-2xl overflow-hidden transition-shadow duration-200",
                window.isMaximized && "rounded-none border-none"
            )}
        >
            {/* Titlebar */}
            <div
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragCancel}
                className={cn(
                    "flex shrink-0 items-center justify-between px-3 py-2 bg-muted/10 border-b border-border/15",
                    "select-none cursor-grab active:cursor-grabbing touch-none"
                )}
            >
                <span className="text-xs font-medium text-muted-foreground">{window.title}</span>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => minimizeWindow(window.id)}
                        className="hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                        <HugeiconsIcon icon={Minus} />
                    </Button>
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => maximizeWindow(window.id)}
                        className="hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                        <HugeiconsIcon icon={Square} className="size-3" />
                    </Button>
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => closeWindow(window.id)}
                        className="hover:bg-destructive/20 hover:text-destructive rounded text-muted-foreground"
                    >
                        <HugeiconsIcon icon={X} className="size-3" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">{window.content}</div>

            {/* Resize handles: 4 edges, 4 corners. Hidden while maximized. */}
            {!window.isMaximized &&
                RESIZE_HANDLES.map(({ edge, className }) => (
                    <div
                        key={edge}
                        className={cn("absolute z-20 touch-none", className)}
                        onPointerDown={(e) => handleResizeStart(e, edge)}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeEnd}
                        onPointerCancel={handleResizeCancel}
                    />
                ))}
        </div>
    )
}
