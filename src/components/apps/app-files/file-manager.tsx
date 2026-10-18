import { Fragment, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Eye,
    EyeOff,
    File as FileIcon,
    Folder as FolderIcon,
    GridViewIcon,
    HardDrive,
    House,
    ListViewIcon,
    Search,
    Settings,
    SidebarLeftIcon,
    X,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { directoryOptions, filePreviewOptions } from "@/hooks/use-files"
import { formatBytes } from "@/lib/format"
import type { FileEntry } from "@/lib/files"

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

type SortKey = "name" | "size" | "date"
type ViewMode = "list" | "grid" | "columns"

/** Remembers the chosen view between visits (the file manager is not part of the store yet). */
const VIEW_STORAGE_KEY = "opess.file-manager.view"

const isViewMode = (value: unknown): value is ViewMode =>
    value === "list" || value === "grid" || value === "columns"

const VIEW_OPTIONS = [
    { mode: "list", label: "List view", icon: ListViewIcon },
    { mode: "grid", label: "Grid view", icon: GridViewIcon },
    { mode: "columns", label: "Column view", icon: SidebarLeftIcon },
] as const

/** Hides dotfiles unless asked, applies the search text, then sorts folders first. */
const sortEntries = (
    entries: FileEntry[],
    query: string,
    showHidden: boolean,
    sort: { key: SortKey; dir: "asc" | "desc" },
): FileEntry[] => {
    const needle = query.trim().toLowerCase()
    return entries
        .filter(
            (entry) =>
                (showHidden || !entry.name.startsWith(".")) &&
                (!needle || entry.name.toLowerCase().includes(needle)),
        )
        .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
            const dirMul = sort.dir === "asc" ? 1 : -1
            if (sort.key === "size") return (a.size - b.size) * dirMul
            if (sort.key === "date") return (a.mtimeMs - b.mtimeMs) * dirMul
            return (
                a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) *
                dirMul
            )
        })
}

/** File type labels derived from the extension (used in tooltips + previews). */
const KINDS: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", mjs: "JavaScript", jsx: "JavaScript",
    json: "JSON", md: "Markdown", html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS",
    yml: "YAML", yaml: "YAML", toml: "TOML", ini: "Config", conf: "Config", cfg: "Config",
    sh: "Shell script", bash: "Shell script", zsh: "Shell script", py: "Python", rb: "Ruby",
    rs: "Rust", go: "Go", java: "Java", c: "C source", h: "Header", cpp: "C++ source",
    log: "Log", txt: "Plain text", xml: "XML", svg: "Image", png: "Image", jpg: "Image",
    jpeg: "Image", gif: "Image", webp: "Image", ico: "Image", bmp: "Image",
    pdf: "PDF document", zip: "Archive", gz: "Archive", tar: "Archive", xz: "Archive",
    deb: "Package", rpm: "Package", db: "Database", sqlite: "Database", lock: "Lock file",
}

const kindOf = (entry: FileEntry): string => {
    if (entry.isDirectory) return "Folder"
    const dot = entry.name.lastIndexOf(".")
    if (dot > 0) {
        const kind = KINDS[entry.name.slice(dot + 1).toLowerCase()]
        if (kind) return kind
    }
    return "File"
}

const formatDate = (ms: number) =>
    ms
        ? new Date(ms).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—"

/** Splits a path into clickable segments, aliasing the home directory as "~". */
const buildPathSegments = (
    displayPath: string,
    home: string,
): Array<{ label: string; path: string }> => {
    if (!displayPath) return [{ label: "~", path: "" }]
    if (home && (displayPath === home || displayPath.startsWith(`${home}/`))) {
        const rest =
            displayPath === home
                ? []
                : displayPath.slice(home.length + 1).split("/").filter(Boolean)
        let acc = ""
        return [
            { label: "~", path: "" },
            ...rest.map((label) => {
                acc += `/${label}`
                return { label, path: `${home}${acc}` }
            }),
        ]
    }
    let acc = ""
    return displayPath
        .split("/")
        .filter(Boolean)
        .map((label) => {
            acc += `/${label}`
            return { label, path: acc }
        })
}

const leafNameOf = (displayPath: string) => {
    if (!displayPath) return "Home"
    if (displayPath === "/") return "/"
    return displayPath.slice(displayPath.lastIndexOf("/") + 1)
}

/* -------------------------------------------------------------------------- */
/* Sidebar locations (a "Containers" group joins these later)                  */
/* -------------------------------------------------------------------------- */

const LOCATIONS = [
    {
        label: "Favorites",
        items: [
            { label: "Home", path: "", icon: House },
            { label: "Filesystem", path: "/", icon: HardDrive },
        ],
    },
    {
        label: "System",
        items: [
            { label: "/etc", path: "/etc", icon: Settings },
            { label: "/tmp", path: "/tmp", icon: FolderIcon },
        ],
    },
] as const

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                       */
/* -------------------------------------------------------------------------- */

const ListNote = ({ children }: { children: ReactNode }) => (
    <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        {children}
    </div>
)

const GRID = "grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_72px_148px]"

/** Finder-style "Quick Look" overlay for text files. */
const QuickLook = ({ path, onClose }: { path: string; onClose: () => void }) => {
    const { data, isPending, isError } = useQuery(filePreviewOptions(path))

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return (
        <div
            className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-2xl border border-border/15 bg-background/95 backdrop-blur-sm"
            role="dialog"
            aria-label="File preview"
        >
            <header className="flex shrink-0 items-center gap-2 border-b border-border/15 px-3 py-2">
                <HugeiconsIcon icon={FileIcon} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {data?.name ?? path.slice(path.lastIndexOf("/") + 1)}
                </span>
                {data && !isPending && !data.error && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatBytes(data.size)}
                        {data.truncated ? " · partial" : ""}
                    </span>
                )}
                <Button variant="ghost" size="icon-xs" aria-label="Close preview" onClick={onClose}>
                    <HugeiconsIcon icon={X} className="size-4" />
                </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-3">
                {isPending ? (
                    <ListNote>Loading…</ListNote>
                ) : isError ? (
                    <ListNote>Could not load this file.</ListNote>
                ) : data?.error ? (
                    <ListNote>{data.error}</ListNote>
                ) : data && data.content === null ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <HugeiconsIcon icon={FileIcon} className="size-8 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                            No preview available for this file type.
                        </p>
                    </div>
                ) : data ? (
                    <>
                        <pre
                            data-native-context
                            className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed"
                        >
                            {data.content}
                        </pre>
                        {data.truncated && (
                            <p className="mt-3 border-t border-border/15 pt-2 text-[10px] text-muted-foreground">
                                Preview truncated — showing the first 512 KB.
                            </p>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/* Miller columns (the column view)                                            */
/* -------------------------------------------------------------------------- */

/**
 * One column of the column view. Each column loads its own directory, so
 * opening a folder simply adds another column beside it.
 */
const Column = ({
    path,
    query,
    showHidden,
    sort,
    selectedFolder,
    selectedFile,
    isCoarse,
    onOpenFolder,
    onSelectFile,
    onOpenFile,
}: {
    path: string
    query: string
    showHidden: boolean
    sort: { key: SortKey; dir: "asc" | "desc" }
    selectedFolder: string | null
    selectedFile: string | null
    isCoarse: boolean
    onOpenFolder: (path: string) => void
    onSelectFile: (path: string) => void
    onOpenFile: (path: string) => void
}) => {
    const { data, isPending, isError } = useQuery({
        ...directoryOptions(path),
        placeholderData: keepPreviousData,
    })
    const entries = useMemo(
        () => sortEntries(data?.entries ?? [], query, showHidden, sort),
        [data, query, showHidden, sort],
    )

    return (
        <div className="min-h-0 w-52 shrink-0 overflow-y-auto border-r border-border/15 py-1">
            {isPending && !data ? (
                <ListNote>Loading…</ListNote>
            ) : isError ? (
                <ListNote>Could not reach the file service.</ListNote>
            ) : data?.error ? (
                <ListNote>{data.error}</ListNote>
            ) : entries.length === 0 ? (
                <ListNote>{query ? "No matches." : "Empty."}</ListNote>
            ) : (
                entries.map((entry) => {
                    const isSelected = entry.isDirectory
                        ? selectedFolder === entry.path
                        : selectedFile === entry.path
                    return (
                        <button
                            key={entry.path}
                            type="button"
                            onClick={() => {
                                if (entry.isDirectory) onOpenFolder(entry.path)
                                else if (isCoarse) onOpenFile(entry.path)
                                else onSelectFile(entry.path)
                            }}
                            onDoubleClick={
                                entry.isDirectory || isCoarse
                                    ? undefined
                                    : () => onOpenFile(entry.path)
                            }
                            aria-pressed={isSelected}
                            title={entry.path}
                            className={cn(
                                "flex w-full items-center gap-2 px-3 py-1 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                isSelected
                                    ? "bg-primary/15"
                                    : "hover:bg-muted/60 focus-visible:bg-muted/60",
                            )}
                        >
                            <HugeiconsIcon
                                icon={entry.isDirectory ? FolderIcon : FileIcon}
                                className={cn(
                                    "size-4 shrink-0",
                                    entry.isDirectory ? "text-primary" : "text-muted-foreground",
                                )}
                            />
                            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                            {entry.isDirectory && (
                                <span className="shrink-0 text-muted-foreground" aria-hidden>
                                    ›
                                </span>
                            )}
                        </button>
                    )
                })
            )}
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/* File Manager                                                                */
/* -------------------------------------------------------------------------- */

export const AppFileManager = () => {
    const isWide = useMediaQuery("(min-width: 768px)")
    const isCoarse = useMediaQuery("(pointer: coarse)")

    const [currentPath, setCurrentPath] = useState("")
    const [backStack, setBackStack] = useState<string[]>([])
    const [forwardStack, setForwardStack] = useState<string[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [showHidden, setShowHidden] = useState(false)
    const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
        key: "name",
        dir: "asc",
    })
    const [view, setView] = useState<ViewMode>("list")
    const [viewLoaded, setViewLoaded] = useState(false)
    const [columnPaths, setColumnPaths] = useState<string[]>([currentPath])

    // Load the remembered view after mount so the server and the first client render match.
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
            if (isViewMode(stored)) setView(stored)
        } catch {
            // Storage unavailable: keep the default view.
        }
        setViewLoaded(true)
    }, [])

    // Persist the view. Skipped until the initial load finished so the default never wins.
    useEffect(() => {
        if (!viewLoaded) return
        try {
            window.localStorage.setItem(VIEW_STORAGE_KEY, view)
        } catch {
            // Storage full or blocked: the view simply will not be remembered.
        }
    }, [view, viewLoaded])

    // Column view starts a fresh chain whenever the current folder changes.
    useEffect(() => {
        setColumnPaths([currentPath])
    }, [currentPath])

    const { data, isPending, isPlaceholderData, isError } = useQuery({
        ...directoryOptions(currentPath),
        placeholderData: keepPreviousData,
    })

    const home = data?.home ?? ""
    // While a navigation is in flight, show the path we are heading to.
    const settled = Boolean(data) && !isPending && !isPlaceholderData
    const displayPath = settled && data ? data.path : currentPath
    const parentPath = settled && data ? data.parent : null
    const segments = useMemo(() => buildPathSegments(displayPath, home), [displayPath, home])

    const navigate = (path: string) => {
        if (path === currentPath) return
        setBackStack((stack) => [...stack, currentPath])
        setForwardStack([])
        setCurrentPath(path)
        setSelected(null)
        setSearch("")
    }

    const goBack = () => {
        const previous = backStack[backStack.length - 1]
        if (previous === undefined) return
        setBackStack((stack) => stack.slice(0, -1))
        setForwardStack((stack) => [currentPath, ...stack])
        setCurrentPath(previous)
        setSelected(null)
        setSearch("")
    }

    const goForward = () => {
        const [next, ...rest] = forwardStack
        if (next === undefined) return
        setForwardStack(rest)
        setBackStack((stack) => [...stack, currentPath])
        setCurrentPath(next)
        setSelected(null)
        setSearch("")
    }

    const openEntry = (entry: FileEntry) => {
        if (entry.isDirectory) navigate(entry.path)
        else setPreview(entry.path)
    }

    const query = search.trim().toLowerCase()
    const visibleEntries = useMemo(
        () => sortEntries(data?.entries ?? [], query, showHidden, sort),
        [data, query, showHidden, sort],
    )

    const sortButton = (key: SortKey, label: string, align: "left" | "right") => (
        <button
            type="button"
            onClick={() =>
                setSort((current) =>
                    current.key === key
                        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
                        : { key, dir: "asc" },
                )
            }
            className={cn(
                "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:text-foreground",
                sort.key === key ? "text-foreground" : "text-muted-foreground",
                align === "right" ? "ml-auto justify-end" : "",
            )}
        >
            {label}
            {sort.key === key && <span aria-hidden>{sort.dir === "asc" ? "↑" : "↓"}</span>}
        </button>
    )

    const listBody = isPending && !data ? (
        <ListNote>Loading…</ListNote>
    ) : isError ? (
        <ListNote>Could not reach the file service.</ListNote>
    ) : data?.error ? (
        <ListNote>{data.error}</ListNote>
    ) : visibleEntries.length === 0 ? (
        <ListNote>{query ? "No matching files." : "This folder is empty."}</ListNote>
    ) : (
        <>
            {visibleEntries.map((entry) => {
                const isSelected = selected === entry.path
                const kind = kindOf(entry)
                return (
                    <button
                        key={entry.path}
                        type="button"
                        onClick={() => {
                            setSelected(entry.path)
                            if (isCoarse) openEntry(entry)
                        }}
                        onDoubleClick={isCoarse ? undefined : () => openEntry(entry)}
                        aria-pressed={isSelected}
                        className={cn(
                            "w-full px-3 py-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            GRID,
                            isSelected
                                ? "bg-primary/15"
                                : "hover:bg-muted/60 focus-visible:bg-muted/60",
                            isPlaceholderData && "opacity-60",
                        )}
                    >
                        <span
                            className="flex min-w-0 items-center gap-2 text-xs"
                            title={`${entry.path}\n${kind}${entry.isSymlink ? " (symlink)" : ""}`}
                        >
                            <HugeiconsIcon
                                icon={entry.isDirectory ? FolderIcon : FileIcon}
                                className={cn(
                                    "size-4 shrink-0",
                                    entry.isDirectory ? "text-primary" : "text-muted-foreground",
                                )}
                            />
                            <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="hidden truncate text-right text-xs tabular-nums text-muted-foreground sm:block">
                            {entry.isDirectory ? "—" : formatBytes(entry.size)}
                        </span>
                        <span className="hidden truncate text-xs tabular-nums text-muted-foreground sm:block">
                            {formatDate(entry.mtimeMs)}
                        </span>
                    </button>
                )
            })}
            {data?.truncated && (
                <ListNote>This folder has more items — showing the first 1,000.</ListNote>
            )}
        </>
    )

    const gridBody = isPending && !data ? (
        <ListNote>Loading…</ListNote>
    ) : isError ? (
        <ListNote>Could not reach the file service.</ListNote>
    ) : data?.error ? (
        <ListNote>{data.error}</ListNote>
    ) : visibleEntries.length === 0 ? (
        <ListNote>{query ? "No matching files." : "This folder is empty."}</ListNote>
    ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1 p-2">
            {visibleEntries.map((entry) => {
                const isSelected = selected === entry.path
                const kind = kindOf(entry)
                return (
                    <button
                        key={entry.path}
                        type="button"
                        onClick={() => {
                            setSelected(entry.path)
                            if (isCoarse) openEntry(entry)
                        }}
                        onDoubleClick={isCoarse ? undefined : () => openEntry(entry)}
                        aria-pressed={isSelected}
                        title={`${entry.path}\n${kind}${entry.isSymlink ? " (symlink)" : ""}`}
                        className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            isSelected
                                ? "bg-primary/15"
                                : "hover:bg-muted/60 focus-visible:bg-muted/60",
                            isPlaceholderData && "opacity-60",
                        )}
                    >
                        <HugeiconsIcon
                            icon={entry.isDirectory ? FolderIcon : FileIcon}
                            className={cn(
                                "size-8 shrink-0",
                                entry.isDirectory ? "text-primary" : "text-muted-foreground",
                            )}
                        />
                        <span className="line-clamp-2 w-full break-words text-center text-[11px] leading-tight">
                            {entry.name}
                        </span>
                    </button>
                )
            })}
            {data?.truncated && (
                <p className="col-span-full px-2 py-1 text-center text-[10px] text-muted-foreground">
                    This folder has more items — showing the first 1,000.
                </p>
            )}
        </div>
    )

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/15 bg-background/40">
            <div className="flex min-h-0 flex-1">
                {/* Sidebar */}
                <nav
                    className={cn(
                        "min-h-0 shrink-0 overflow-y-auto p-2.5",
                        isWide ? "w-44 border-r border-border/15" : "hidden",
                    )}
                    aria-label="Locations"
                >
                    {LOCATIONS.map((group) => {
                        const currentAbsolute = currentPath || home || "~"
                        return (
                            <div key={group.label} className="mb-3">
                                <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {group.label}
                                </div>
                                <ul className="space-y-0.5">
                                    {group.items.map((item) => {
                                        const itemAbsolute = item.path || home || "~"
                                        const isActive = itemAbsolute === currentAbsolute
                                        return (
                                            <li key={item.path}>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(item.path)}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
                                                        isActive
                                                            ? "bg-primary/15 font-medium text-primary"
                                                            : "hover:bg-muted/60",
                                                    )}
                                                >
                                                    <HugeiconsIcon
                                                        icon={item.icon}
                                                        className="size-4 shrink-0"
                                                    />
                                                    <span className="truncate">{item.label}</span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        )
                    })}
                </nav>

                {/* Main pane */}
                <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <header className="flex shrink-0 items-center gap-1.5 border-b border-border/15 px-2.5 py-2">
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Go back"
                            disabled={backStack.length === 0}
                            onClick={goBack}
                        >
                            <HugeiconsIcon icon={ArrowLeft} className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Go forward"
                            disabled={forwardStack.length === 0}
                            onClick={goForward}
                        >
                            <HugeiconsIcon icon={ArrowRight} className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Go to parent folder"
                            disabled={!parentPath}
                            onClick={() => parentPath && navigate(parentPath)}
                        >
                            <HugeiconsIcon icon={ArrowUp} className="size-4" />
                        </Button>
                        <span
                            className="ml-1 min-w-0 flex-1 truncate text-xs font-semibold"
                            title={displayPath || home || "~"}
                        >
                            {leafNameOf(displayPath)}
                        </span>
                        <div className="flex shrink-0 items-center rounded-lg bg-muted/60 p-0.5">
                            {VIEW_OPTIONS.map((option) => (
                                <button
                                    key={option.mode}
                                    type="button"
                                    aria-label={option.label}
                                    aria-pressed={view === option.mode}
                                    onClick={() => setView(option.mode)}
                                    className={cn(
                                        "rounded-md p-1 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                        view === option.mode
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <HugeiconsIcon icon={option.icon} className="size-3.5" />
                                </button>
                            ))}
                        </div>
                        <div className="relative shrink-0">
                            <HugeiconsIcon
                                icon={Search}
                                className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search"
                                className="w-24 rounded-lg bg-muted/60 py-1 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary sm:w-36"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Toggle hidden files"
                            aria-pressed={showHidden}
                            onClick={() => setShowHidden((value) => !value)}
                        >
                            <HugeiconsIcon icon={showHidden ? Eye : EyeOff} className="size-4" />
                        </Button>
                    </header>

                    {/* Path bar (Finder-style clickable segments) */}
                    <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/15 px-3 py-1.5 text-[10px] text-muted-foreground">
                        {segments.map((segment, index) => (
                            <Fragment key={`${segment.path}-${index}`}>
                                {index > 0 && <span className="shrink-0 select-none">/</span>}
                                <button
                                    type="button"
                                    onClick={() => navigate(segment.path)}
                                    className="shrink-0 rounded px-1 py-0.5 hover:bg-muted/60 hover:text-foreground"
                                    title={segment.path || home || "~"}
                                >
                                    {segment.label}
                                </button>
                            </Fragment>
                        ))}
                        <span className="ml-auto shrink-0 pl-3 tabular-nums">
                            {visibleEntries.length}{" "}
                            {visibleEntries.length === 1 ? "item" : "items"}
                        </span>
                    </div>

                    {/* Column headers (list view only) */}
                    {view === "list" && (
                        <div
                            className={cn(
                                "shrink-0 border-b border-border/15 bg-background/60 px-3 py-1",
                                GRID,
                            )}
                        >
                            {sortButton("name", "Name", "left")}
                            <span className="hidden sm:block">
                                {sortButton("size", "Size", "right")}
                            </span>
                            <span className="hidden sm:block">
                                {sortButton("date", "Modified", "left")}
                            </span>
                        </div>
                    )}

                    {/* File list */}
                    {view === "columns" ? (
                        <div className="flex min-h-0 flex-1 overflow-x-auto">
                            {columnPaths.map((path, index) => (
                                <Column
                                    key={`${path}-${index}`}
                                    path={path}
                                    query={query}
                                    showHidden={showHidden}
                                    sort={sort}
                                    selectedFolder={columnPaths[index + 1] ?? null}
                                    selectedFile={selected}
                                    isCoarse={isCoarse}
                                    onOpenFolder={(folder) => {
                                        setColumnPaths((paths) => [
                                            ...paths.slice(0, index + 1),
                                            folder,
                                        ])
                                        setSelected(null)
                                    }}
                                    onSelectFile={setSelected}
                                    onOpenFile={setPreview}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="min-h-0 flex-1 overflow-y-auto py-1">
                            {view === "grid" ? gridBody : listBody}
                        </div>
                    )}
                </main>
            </div>

            {preview && <QuickLook path={preview} onClose={() => setPreview(null)} />}
        </div>
    )
}
