import { Suspense, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    ArrowLeft,
    CheckmarkCircle01Icon,
    Copy01Icon,
    CopyCheckIcon,
    Database01Icon,
    EthernetPortIcon,
    Globe,
    HardDrive,
    InformationCircleIcon,
    Laptop,
    Palette,
    Search,
    Wifi,
} from "@hugeicons/core-free-icons"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { configLocationOptions } from "@/hooks/use-store"
import { useNetworkOptions, useSystemOptions } from "@/hooks/use-system"
import { useTheme } from "@/components/theme"
import { useWallpaper, WALLPAPERS } from "@/components/wallpapers"
import { formatSize } from "@/lib/format"
import type { ThemeSetting } from "@/lib/store"
import type { NetworkInterfaceInfo } from "@/lib/storage"

const SECTIONS = [
    {
        id: "network",
        title: "Network",
        subtitle: "Wi-Fi, IP and gateway",
        icon: Wifi,
        tile: "bg-blue-500",
    },
    {
        id: "appearance",
        title: "Appearance",
        subtitle: "Theme and wallpaper",
        icon: Palette,
        tile: "bg-pink-500",
    },
    {
        id: "storage",
        title: "Storage",
        subtitle: "Disks and usage",
        icon: HardDrive,
        tile: "bg-slate-500",
    },
    {
        id: "data",
        title: "Data",
        subtitle: "Config and state",
        icon: Database01Icon,
        tile: "bg-amber-500",
    },
    {
        id: "about",
        title: "About",
        subtitle: "System details",
        icon: InformationCircleIcon,
        tile: "bg-olive-500",
    },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

/* -------------------------------------------------------------------------- */
/* Small shared building blocks                                                */
/* -------------------------------------------------------------------------- */

const SectionFallback = () => (
    <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        Loading…
    </div>
)

const EmptyNote = ({ children }: { children: ReactNode }) => (
    <div className="rounded-xl border border-border/15 bg-background/40 px-3.5 py-4 text-center text-xs text-muted-foreground">
        {children}
    </div>
)

const IconTile = ({
    icon,
    className,
}: {
    icon: (typeof Wifi)
    className?: string
}) => (
    <span
        className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[10px] text-white",
            className
        )}
    >
        <HugeiconsIcon icon={icon} className="size-4" />
    </span>
)

/** Apple-style grouped list of label/value rows. */
const GroupedRows = ({ children }: { children: ReactNode }) => (
    <div className="divide-y divide-border/10 overflow-hidden rounded-xl border border-border/15 bg-background/40">
        {children}
    </div>
)

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className="truncate text-right">{value}</span>
    </div>
)

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

const NetworkSection = () => {
    const { data } = useSuspenseQuery(useNetworkOptions)

    return (
        <div className="space-y-3">
            {/* Connection summary */}
            <div className="rounded-xl border border-border/15 bg-background/40 p-3.5">
                <div className="flex items-center gap-2.5">
                    <IconTile
                        icon={Globe}
                        className={data.gateway ? "bg-emerald-500" : "bg-muted text-muted-foreground"}
                    />
                    <div className="min-w-0">
                        <p className="text-xs font-medium">
                            {data.gateway ? "Connected" : "No default gateway"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                            {data.gateway
                                ? `Gateway ${data.gateway}`
                                : "No default route detected"}
                        </p>
                    </div>
                </div>
                {data.dns.length > 0 && (
                    <p className="mt-2.5 border-t border-border/10 pt-2.5 text-[11px] text-muted-foreground">
                        DNS {data.dns.join(", ")}
                    </p>
                )}
            </div>

            {data.interfaces.length === 0 ? (
                <EmptyNote>No network interfaces found.</EmptyNote>
            ) : (
                data.interfaces.map((iface) => (
                    <InterfaceCard key={`${iface.name}-${iface.mac}`} iface={iface} />
                ))
            )}
        </div>
    )
}

const kindLabel = (kind: NetworkInterfaceInfo["kind"]) =>
    kind === "wifi" ? "Wi-Fi" : kind === "ethernet" ? "Ethernet" : "Network"

/** A human label for the live networkd operational state. */
const linkStateLabel = (iface: NetworkInterfaceInfo) => {
    if (iface.operationalState) {
        const words = iface.operationalState.replace(/-/g, " ")
        return words.charAt(0).toUpperCase() + words.slice(1)
    }
    return iface.isUp ? "Up" : "Down"
}

/** Whether the link is on DHCP, a static address, or unknown. */
const addressingLabel = (iface: NetworkInterfaceInfo) =>
    iface.addressMode === "dhcp"
        ? "DHCP"
        : iface.addressMode === "static"
            ? "Static"
            : iface.dhcp
                ? "DHCP"
                : "Unknown"

const InterfaceCard = ({ iface }: { iface: NetworkInterfaceInfo }) => (
    <div className="rounded-xl border border-border/15 bg-background/40 p-3.5">
        <div className="flex items-center gap-2.5">
            <IconTile
                icon={iface.isWireless ? Wifi : EthernetPortIcon}
                className={iface.isWireless ? "bg-blue-500" : "bg-indigo-500"}
            />
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="truncate">{iface.label || iface.name}</span>
                    {iface.isDefault && (
                        <span className="shrink-0 rounded bg-primary/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
                            default
                        </span>
                    )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                    {kindLabel(iface.kind)}
                    {iface.virtual ? " · virtual" : ""}
                    {iface.label && iface.label !== iface.name ? ` · ${iface.name}` : ""}
                </p>
            </div>
            <span
                className={cn(
                    "flex shrink-0 items-center gap-1 text-[10px]",
                    iface.isUp ? "text-emerald-500" : "text-muted-foreground"
                )}
            >
                <span
                    className={cn(
                        "size-1.5 rounded-full",
                        iface.isUp ? "bg-emerald-500" : "bg-muted-foreground/50"
                    )}
                />
                {linkStateLabel(iface)}
            </span>
        </div>

        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border/10 pt-2.5 text-[11px]">
            <dt className="text-muted-foreground">IPv4</dt>
            <dd className="truncate text-right tabular-nums">
                {iface.ip4
                    ? `${iface.ip4}${iface.ip4subnet ? ` / ${iface.ip4subnet}` : ""}`
                    : "—"}
            </dd>

            {iface.ip6 && (
                <>
                    <dt className="text-muted-foreground">IPv6</dt>
                    <dd className="truncate text-right tabular-nums">{iface.ip6}</dd>
                </>
            )}

            <dt className="text-muted-foreground">MAC</dt>
            <dd className="truncate text-right tabular-nums">{iface.mac}</dd>

            {iface.gateway && (
                <>
                    <dt className="text-muted-foreground">Gateway</dt>
                    <dd className="truncate text-right tabular-nums">{iface.gateway}</dd>
                </>
            )}

            {typeof iface.speed === "number" && iface.speed > 0 && (
                <>
                    <dt className="text-muted-foreground">Speed</dt>
                    <dd className="text-right tabular-nums">
                        {iface.speed >= 1000
                            ? `${iface.speed / 1000} Gb/s`
                            : `${iface.speed} Mb/s`}
                    </dd>
                </>
            )}

            <dt className="text-muted-foreground">Addressing</dt>
            <dd className="text-right">{addressingLabel(iface)}</dd>

            {iface.ssid && (
                <>
                    <dt className="text-muted-foreground">Network</dt>
                    <dd className="truncate text-right">{iface.ssid}</dd>
                </>
            )}

            {iface.dns.length > 0 && (
                <>
                    <dt className="text-muted-foreground">DNS</dt>
                    <dd className="truncate text-right tabular-nums">{iface.dns.join(", ")}</dd>
                </>
            )}

            {iface.model && (
                <>
                    <dt className="text-muted-foreground">Adapter</dt>
                    <dd className="truncate text-right">
                        {[iface.vendor, iface.model].filter(Boolean).join(" ")}
                    </dd>
                </>
            )}
        </dl>
    </div>
)

const THEME_OPTIONS: { id: ThemeSetting; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "Auto" },
]

/**
 * A miniature of the opess desktop, the current wallpaper with the taskbar
 * pill. Light and Dark show it dimmed or not; Auto splits it, the same way
 * macOS previews Appearance.
 */
const ThemePreview = ({ variant, wallpaper }: { variant: ThemeSetting; wallpaper: string }) => {
    const isDark = variant === "dark"

    return (
        <span className="relative block aspect-video w-full overflow-hidden">
            <img
                src={wallpaper}
                alt=""
                className={cn(
                    "absolute inset-0 size-full object-cover",
                    isDark && "brightness-[0.45]"
                )}
            />
            {variant === "system" && (
                <span className="absolute inset-y-0 right-0 w-1/2 bg-black/45" />
            )}
            <span className="absolute inset-x-0 bottom-1 flex justify-center">
                <span
                    className={cn(
                        "flex items-center gap-0.5 rounded-md border border-white/10 px-1 py-1 backdrop-blur-sm",
                        isDark ? "bg-black/40" : "bg-white/60"
                    )}
                >
                    {[0, 1, 2, 3].map((i) => (
                        <span
                            key={i}
                            className={cn(
                                "size-1 rounded-[2px]",
                                isDark ? "bg-white/70" : "bg-black/45"
                            )}
                        />
                    ))}
                </span>
            </span>
        </span>
    )
}

const ThemeCard = ({ wallpaper }: { wallpaper: string }) => {
    const { theme, setTheme, isSaving } = useTheme()

    return (
        <div className="rounded-xl border border-border/15 bg-background/40 p-3.5">
            <div className="grid grid-cols-3 gap-2.5">
                {THEME_OPTIONS.map((option) => {
                    const isSelected = theme === option.id
                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={isSaving}
                            onClick={() => setTheme(option.id)}
                            aria-pressed={isSelected}
                            aria-label={option.label}
                            className="group flex flex-col items-center gap-1.5 outline-none disabled:opacity-60"
                        >
                            <span
                                className={cn(
                                    "w-full overflow-hidden rounded-lg transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring/40",
                                    isSelected
                                        ? "ring-2 ring-primary"
                                        : "ring-1 ring-inset ring-border/20"
                                )}
                            >
                                <ThemePreview variant={option.id} wallpaper={wallpaper} />
                            </span>
                            <span
                                className={cn(
                                    "text-[11px] font-medium",
                                    isSelected ? "text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {option.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

const AppearanceSection = () => {
    const { current, setWallpaper } = useWallpaper()

    return (
        <div className="space-y-3">
            <ThemeCard wallpaper={current} />

            <div className="rounded-xl border border-border/15 bg-background/40 p-3.5">
                <p className="text-xs font-medium">Wallpaper</p>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                    {WALLPAPERS.map((src, index) => {
                        const isSelected = current === src
                        return (
                            <button
                                key={src}
                                onClick={() => setWallpaper(src)}
                                aria-pressed={isSelected}
                                aria-label={`Wallpaper ${index + 1}`}
                                className={cn(
                                    "relative aspect-video overflow-hidden rounded-lg border transition-all",
                                    isSelected
                                        ? "border-primary ring-2 ring-primary"
                                        : "border-border/15 hover:border-border/40"
                                )}
                            >
                                <img
                                    src={src}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                                <span
                                    className={cn(
                                        "absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-opacity",
                                        isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                >
                                    <HugeiconsIcon
                                        icon={CheckmarkCircle01Icon}
                                        className="size-3.5"
                                    />
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const StorageSection = () => {
    const { data: metrics } = useSuspenseQuery(useSystemOptions)

    if (metrics.disks.length === 0) {
        return <EmptyNote>No disks found.</EmptyNote>
    }

    return (
        <div className="space-y-3">
            {metrics.disks.map((disk) => {
                const percent =
                    disk.sizeGB > 0
                        ? Math.max(0, Math.min(100, (disk.usedGB / disk.sizeGB) * 100))
                        : 0
                const typeTag = disk.type !== "local" ? ` · ${disk.type}` : ""

                return (
                    <div
                        key={`${disk.mount}-${disk.filesystem}`}
                        className="rounded-xl border border-border/15 bg-background/40 p-3.5"
                    >
                        <div className="flex items-center gap-2.5">
                            <IconTile icon={HardDrive} className="bg-slate-500" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                    {disk.label || disk.mount}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {disk.mount} · {disk.filesystem}
                                </p>
                            </div>
                        </div>
                        <Progress value={percent} className="mt-2.5">
                            <ProgressLabel>
                                {formatSize(disk.usedGB)} / {formatSize(disk.sizeGB)}
                                {typeTag}
                            </ProgressLabel>
                            <ProgressValue />
                        </Progress>
                    </div>
                )
            })}
        </div>
    )
}

const CopyButton = ({ value }: { value: string }) => {
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        const done = () => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        }
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(value)
                done()
                return
            }
            // Non secure contexts (for example the LAN URL over http) expose no
            // clipboard API, so fall back to a temporary selection.
            const area = document.createElement("textarea")
            area.value = value
            area.setAttribute("readonly", "")
            area.style.position = "fixed"
            area.style.opacity = "0"
            document.body.appendChild(area)
            try {
                area.select()
                document.execCommand("copy")
                done()
            } finally {
                area.remove()
            }
        } catch {
            // Clipboard access refused; leave the button unchanged.
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon-xs"
            aria-label={copied ? "Copied" : "Copy path"}
            onClick={copy}
            className={cn("shrink-0 text-muted-foreground", copied && "text-emerald-500")}
        >
            <HugeiconsIcon icon={copied ? CopyCheckIcon : Copy01Icon} />
        </Button>
    )
}

const PathRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-2 px-3.5 py-2.5">
        <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="mt-0.5 break-all font-mono text-[11px]">{value}</p>
        </div>
        <CopyButton value={value} />
    </div>
)

const DataSection = () => {
    const { data } = useSuspenseQuery(configLocationOptions)

    if (!data.ok) {
        return <EmptyNote>Could not resolve the config directory.</EmptyNote>
    }

    return (
        <div className="space-y-3">
            <GroupedRows>
                <PathRow label="Config directory" value={data.data.configDir} />
                <PathRow label="Key file" value={data.data.keyFile} />
            </GroupedRows>

            {data.warning && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[11px] text-destructive">
                    {data.warning.message}
                </div>
            )}
        </div>
    )
}

/** Seconds of uptime → "3d 4h", "5h 12m" or "42m". */
const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

const AboutSection = () => {
    const { data: metrics } = useSuspenseQuery(useSystemOptions)

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-border/15 bg-background/40 p-4 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-olive-500 text-white">
                    <HugeiconsIcon icon={Laptop} className="size-6" />
                </span>
                <p className="mt-2 text-sm font-semibold">{metrics.hostname}</p>
                <p className="text-[11px] text-muted-foreground">
                    {metrics.platform} · opess
                </p>
            </div>

            <GroupedRows>
                <Row label="Processor" value={metrics.cpu.model} />
                <Row
                    label="CPU"
                    value={`${metrics.cpu.cores} cores · ${metrics.cpu.usage}%`}
                />
                <Row
                    label="Memory"
                    value={`${formatSize(metrics.memory.usedGB)} used / ${formatSize(metrics.memory.totalGB)}`}
                />
                <Row label="Uptime" value={formatUptime(metrics.uptime)} />
                <Row
                    label="Load average"
                    value={metrics.cpu.loadAverage.map((n) => n.toFixed(2)).join(" · ")}
                />
            </GroupedRows>
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/* App                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Apple System Settings inspired app: grouped icon sidebar on the left,
 * detail pane on the right. Below md the two become stacked panes with a
 * back button, like iOS Settings.
 */
export const AppSetting = () => {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [active, setActive] = useState<SectionId | null>("network")
    const [search, setSearch] = useState("")

    const query = search.trim().toLowerCase()
    const visibleSections = SECTIONS.filter((section) =>
        `${section.title} ${section.subtitle}`.toLowerCase().includes(query)
    )
    const activeSection = SECTIONS.find((section) => section.id === active)
    // Mobile shows one pane at a time; desktop keeps the sidebar pinned.
    const showList = isDesktop || active === null

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/15 bg-background/40">
            {/* Mobile detail header with back navigation */}
            {!isDesktop && activeSection && (
                <header className="flex shrink-0 items-center gap-1 border-b border-border/15 px-2 py-1.5">
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Back to settings list"
                        onClick={() => setActive(null)}
                    >
                        <HugeiconsIcon icon={ArrowLeft} className="size-4" />
                    </Button>
                    <span className="text-xs font-semibold">{activeSection.title}</span>
                </header>
            )}

            <div className="flex min-h-0 flex-1">
                {showList && (
                    <nav
                        className={cn(
                            "min-h-0 shrink-0 overflow-y-auto p-2.5",
                            isDesktop ? "w-52 border-r border-border/15" : "w-full"
                        )}
                    >
                        <div className="relative mb-2.5">
                            <HugeiconsIcon
                                icon={Search}
                                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search"
                                className="w-full rounded-lg bg-muted/60 py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <ul className="space-y-0.5">
                            {visibleSections.map((section) => {
                                const isActive = active === section.id
                                return (
                                    <li key={section.id}>
                                        <button
                                            onClick={() => setActive(section.id)}
                                            className={cn(
                                                "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                                                isActive
                                                    ? "bg-olive-500/25"
                                                    : "hover:bg-muted/60"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex size-7 shrink-0 items-center justify-center rounded-[7px] text-white",
                                                    section.tile
                                                )}
                                            >
                                                <HugeiconsIcon
                                                    icon={section.icon}
                                                    className="size-4"
                                                />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-xs font-medium">
                                                    {section.title}
                                                </span>
                                                <span className="block truncate text-[10px] text-muted-foreground">
                                                    {section.subtitle}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                            {visibleSections.length === 0 && (
                                <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                    No results
                                </li>
                            )}
                        </ul>
                    </nav>
                )}

                {activeSection && (
                    <main className="min-h-0 flex-1 overflow-y-auto p-4">
                        <h2 className="mb-3 text-sm font-semibold">
                            {activeSection.title}
                        </h2>
                        <Suspense fallback={<SectionFallback />}>
                            {activeSection.id === "network" && <NetworkSection />}
                            {activeSection.id === "appearance" && <AppearanceSection />}
                            {activeSection.id === "storage" && <StorageSection />}
                            {activeSection.id === "data" && <DataSection />}
                            {activeSection.id === "about" && <AboutSection />}
                        </Suspense>
                    </main>
                )}
            </div>
        </div>
    )
}
