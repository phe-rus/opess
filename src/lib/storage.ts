import si from 'systeminformation';
import os from 'os';
import { readFile } from 'node:fs/promises';
import { ReadNetworkLinks } from './network';
import type { AddressMode, LinkKind } from './network';

export type DiskType = 'local' | 'removable' | 'network' | 'cdrom' | 'other';

export type DiskInfo = {
    filesystem: string;
    sizeGB: number;
    usedGB: number;
    availGB: number;
    mount: string;
    type: DiskType;
    label?: string;
};

export type SystemMetrics = {
    platform: string;
    hostname: string;
    uptime: number;
    cpu: {
        model: string;
        cores: number;
        usage: number;
        /** Load per logical core, 0 to 100. */
        perCoreUsage: number[];
        loadAverage: number[];
    };
    memory: {
        totalGB: number;
        usedGB: number;
        freeGB: number;
    };
    disks: DiskInfo[];
};

export async function GetSystemMetrics(): Promise<SystemMetrics> {
    // Fetch all hardware data concurrently. `currentLoad` is fetched on its own
    // because it reads shared module state inside systeminformation and can throw
    // intermittently when several requests overlap; a metrics read must never take
    // down the whole call, so it degrades to an idle value instead.
    const [cpuInfo, mem, fsSize, osInfo, blockDevices, diskLayout] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.blockDevices(),
        si.diskLayout()
    ]);

    const currentLoad = await si.currentLoad().catch(() => null);

    const disks: DiskInfo[] = fsSize!!.map((disk) => {
        const devName = disk.fs.replace('/dev/', '');
        const blockDevice = blockDevices!!.find(b => b.name === devName);

        let label: string | undefined = undefined;

        // Try to get the best possible name
        if (blockDevice?.label) {
            label = blockDevice.label;
        } else if (blockDevice?.model) {
            label = blockDevice.model;
        } else {
            // Fallback to physical hardware name if it exists
            const parentDevName = blockDevice?.device || devName;
            const physicalDisk = diskLayout!!.find(d => d.device === `/dev/${parentDevName}`);

            if (physicalDisk?.name) {
                label = physicalDisk.name;
            } else if (disk.mount === '/' || disk.mount === 'C:') {
                label = 'System';
            } else if (disk.mount === '/home') {
                label = 'Home';
            } else if (disk.mount.startsWith('/media') || disk.mount.startsWith('/mnt') || disk.mount.startsWith('/Volumes')) {
                const parts = disk.mount.split('/').filter(Boolean);
                label = parts.length > 0 ? parts[parts.length - 1] : 'Drive';
            } else {
                label = disk.mount; // Last resort
            }
        }

        let type: DiskType = 'local';
        if (
            disk.fs.includes('smb') ||
            disk.fs.includes('nfs') ||
            disk.fs.includes('cifs') ||
            disk.fs.includes('sshfs') ||
            disk.fs.includes('afp') ||
            disk.fs.startsWith('//')
        ) {
            type = 'network';
        } else if (
            disk.mount.startsWith('/media') ||
            disk.mount.startsWith('/run/media') ||
            disk.mount.startsWith('/mnt') ||
            disk.mount.startsWith('/Volumes')
        ) {
            type = 'removable';
        } else if (blockDevice?.removable) {
            type = 'removable';
        }

        return {
            filesystem: disk.fs,
            sizeGB: disk.size / (1024 ** 3),
            usedGB: disk.used / (1024 ** 3),
            availGB: disk.available / (1024 ** 3),
            mount: disk.mount,
            type,
            label,
        };
    });

    // Boards (e.g. ARM SBCs) often leave `brand` empty, fall back through the fields.
    const cpuName =
        [cpuInfo.manufacturer, cpuInfo.brand, cpuInfo.model].filter(Boolean).join(' ').trim() ||
        'Unknown CPU';

    return {
        platform: osInfo.platform,
        hostname: osInfo.hostname,
        uptime: os.uptime(),
        cpu: {
            model: cpuName,
            cores: cpuInfo.cores,
            usage: Math.round(currentLoad?.currentLoad ?? 0),
            perCoreUsage: (currentLoad?.cpus ?? []).map((core) => Math.round(core.load)),
            loadAverage: os.loadavg(),
        },
        memory: {
            totalGB: mem.total / (1024 ** 3),
            usedGB: mem.active / (1024 ** 3), // 'active' is much more accurate than 'used' on Linux
            freeGB: mem.available / (1024 ** 3), // 'available' is the true free memory
        },
        disks,
    };
}

export type NetworkInterfaceInfo = {
    name: string;
    label: string;
    type: string;
    /** Link kind from the live host, or derived from the adapter otherwise. */
    kind: LinkKind;
    isWireless: boolean;
    ip4: string;
    ip4subnet: string;
    ip6: string;
    mac: string;
    gateway: string;
    isDefault: boolean;
    isUp: boolean;
    /** Operational state from networkd, e.g. `routable`, `no-carrier`, `off`. */
    operationalState?: string;
    virtual: boolean;
    dhcp: boolean;
    /** Whether the link is on DHCP or a static address, from the live host. */
    addressMode: AddressMode;
    /** Connected wifi network name, or null when not wireless or not associated. */
    ssid: string | null;
    /** Per link DNS servers, when networkd reports them. */
    dns: string[];
    speed: number | null;
    vendor: string;
    model: string;
};

export type NetworkInfo = {
    gateway: string | null;
    dns: string[];
    interfaces: NetworkInterfaceInfo[];
};

/** DNS servers as reported by the system resolver (Linux: /etc/resolv.conf). */
const readDnsServers = async (): Promise<string[]> => {
    try {
        const content = await readFile('/etc/resolv.conf', 'utf8');
        const servers = content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('nameserver'))
            .map((line) => line.split(/\s+/)[1])
            .filter((server): server is string => !!server);
        return [...new Set(servers)];
    } catch {
        return [];
    }
};

/** networkd operational states that mean the link is usable. */
const UP_OPERATIONAL_STATES = new Set([
    'routable',
    'carrier',
    'degraded-carrier',
    'enslaved',
    'dormant',
]);

export async function GetNetworkInfo(): Promise<NetworkInfo> {
    const [interfaces, gateway, dns, links] = await Promise.all([
        si.networkInterfaces(),
        si.networkGatewayDefault(),
        readDnsServers(),
        ReadNetworkLinks(),
    ]);

    return {
        gateway,
        dns,
        interfaces: (interfaces ?? [])
            .filter((iface) => !iface.internal)
            .map((iface) => {
                const link = links.get(iface.iface);
                const isWireless =
                    link ? link.kind === 'wifi' : iface.type === 'wireless' || /^wl/i.test(iface.iface);
                const kind: LinkKind =
                    link?.kind ??
                    (isWireless ? 'wifi' : iface.type === 'wired' || /^(en|eth)/i.test(iface.iface) ? 'ethernet' : 'other');

                return {
                    name: iface.iface,
                    label: iface.ifaceName,
                    type: iface.type,
                    kind,
                    isWireless,
                    ip4: iface.ip4,
                    ip4subnet: iface.ip4subnet,
                    ip6: iface.ip6,
                    mac: iface.mac,
                    gateway: iface.gateway,
                    isDefault: iface.default,
                    isUp: link
                        ? UP_OPERATIONAL_STATES.has(link.operationalState)
                        : iface.operstate === 'up',
                    operationalState: link?.operationalState,
                    virtual: iface.virtual,
                    dhcp: iface.dhcp,
                    addressMode: link?.mode ?? (iface.dhcp ? 'dhcp' : 'unknown'),
                    ssid: link?.ssid ?? null,
                    dns: link?.dns ?? [],
                    speed: iface.speed,
                    vendor: iface.vendor,
                    model: iface.model,
                };
            }),
    };
}