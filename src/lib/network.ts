import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"

/**
 * Live network state, read from systemd-networkd through `networkctl`.
 *
 * Server only: this module shells out to host tools, so never import it into a
 * client component. Call it from a `createServerFn` handler instead (see
 * `src/hooks/use-system.ts`); `src/lib/storage.ts` composes it into
 * `GetNetworkInfo`.
 *
 * On a host without `networkctl` (macOS, Windows, or a Linux box with no
 * systemd-networkd) every read resolves to `null` or an empty map, so callers
 * fall back to the `systeminformation` values rather than failing.
 */

export type LinkKind = "ethernet" | "wifi" | "other"

/** Whether a link gets its address from DHCP or has one set statically. */
export type AddressMode = "dhcp" | "static" | "unknown"

export type NetworkLink = {
    name: string
    kind: LinkKind
    /** Raw networkctl link type, e.g. `ether`, `wlan`, `bridge`. */
    type: string
    /** Operational state, e.g. `routable`, `carrier`, `no-carrier`, `off`. */
    operationalState: string
    /** Administrative state, e.g. `configured`, `configuring`, `unmanaged`. */
    administrativeState: string
    /** Whether systemd counts the link as online. */
    online: boolean
    /** Connected wifi network name, or null when not wireless or not associated. */
    ssid: string | null
    /** Per link DNS servers as networkd reports them. */
    dns: string[]
    /** Whether the link gets its address from DHCP or has one set statically. */
    mode: AddressMode
}

/** A networkctl JSON address entry. The address bytes are in network order. */
type RawAddress = {
    Family: number
    Address: number[]
    ConfigSource?: string
}

/** The subset of a networkctl JSON interface this module reads. */
type RawLink = {
    Name: string
    Type?: string
    OperationalState?: string
    AdministrativeState?: string
    OnlineState?: string | null
    SSID?: string | null
    DNS?: RawAddress[] | null
    Addresses?: RawAddress[]
    NetworkFile?: string | null
}

const AF_INET = 2
const AF_INET6 = 10

/** Format a networkctl address byte array into a readable IP string. */
const formatAddress = (family: number, bytes: number[]): string => {
    if (family === AF_INET) return bytes.join(".")
    if (family === AF_INET6) {
        const groups: string[] = []
        for (let i = 0; i + 1 < bytes.length; i += 2) {
            groups.push((((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0)).toString(16))
        }
        return groups.join(":")
    }
    return ""
}

/** Run a host tool and return stdout, or null when it is missing or fails. */
const run = (file: string, args: string[]): Promise<string | null> =>
    new Promise((resolve) => {
        execFile(file, args, { timeout: 3000, windowsHide: true }, (error, stdout) => {
            resolve(error ? null : stdout)
        })
    })

const kindOf = (type: string): LinkKind => {
    if (type === "wlan") return "wifi"
    if (type === "ether") return "ethernet"
    return "other"
}

/**
 * Read the addressing mode netplan resolved for a link.
 *
 * networkd already applied netplan's `match:` rules (an interface like
 * `enP4p65s0` is configured by the `e*` block) and picked the rendered file, so
 * the file is the reliable per link answer and it holds even while the link is
 * down. A `DHCP=` key means DHCP; a bare `Address=` means a static address.
 */
const readConfigMode = async (networkFile: string | null | undefined): Promise<AddressMode> => {
    if (!networkFile) return "unknown"
    let content: string
    try {
        content = await readFile(networkFile, "utf8")
    } catch {
        return "unknown"
    }
    const dhcp = /^DHCP=(.+)$/m.exec(content)?.[1]?.trim().toLowerCase()
    if (dhcp && dhcp !== "no" && dhcp !== "none" && dhcp !== "false") return "dhcp"
    if (/^Address=/m.test(content)) return "static"
    return "unknown"
}

/**
 * Fallback addressing mode from how networkd got each live address, used on a
 * host whose link has no rendered network file.
 */
const modeOf = (addresses: RawAddress[]): AddressMode => {
    const sources = addresses.map((address) => address.ConfigSource ?? "")
    if (sources.some((source) => source.startsWith("DHCP"))) return "dhcp"
    if (sources.some((source) => source === "static" || source === "config")) return "static"
    return "unknown"
}

/** Read every network link from systemd-networkd, keyed by interface name. */
export async function ReadNetworkLinks(): Promise<Map<string, NetworkLink>> {
    const stdout = await run("networkctl", ["--json=short", "list"])
    if (!stdout) return new Map()

    let parsed: { Interfaces?: RawLink[] }
    try {
        parsed = JSON.parse(stdout) as { Interfaces?: RawLink[] }
    } catch {
        return new Map()
    }

    const links = new Map<string, NetworkLink>()
    await Promise.all(
        (parsed.Interfaces ?? []).map(async (raw) => {
            if (!raw?.Name) return
            const type = raw.Type ?? ""
            const addresses = raw.Addresses ?? []
            const configured = await readConfigMode(raw.NetworkFile)
            links.set(raw.Name, {
                name: raw.Name,
                kind: kindOf(type),
                type,
                operationalState: raw.OperationalState ?? "unknown",
                administrativeState: raw.AdministrativeState ?? "unknown",
                online: raw.OnlineState === "online",
                ssid: raw.SSID ?? null,
                dns: [
                    ...new Set(
                        (raw.DNS ?? [])
                            .map((entry) => formatAddress(entry.Family, entry.Address))
                            .filter((address) => address.length > 0),
                    ),
                ],
                mode: configured !== "unknown" ? configured : modeOf(addresses),
            })
        }),
    )
    return links
}
