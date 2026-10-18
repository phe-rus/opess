import { cn } from "@/lib/utils";
import { Progress, ProgressLabel, ProgressValue } from "../ui/progress";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSystemOptions } from "@/hooks/use-system";
import { formatSize } from "@/lib/format";
import type { ReactNode } from "react";
import type { DiskInfo } from "@/lib/storage";

/** Clean display name for a disk, e.g. "System (/)" or "Backup (/media/backup)". */
const getDiskName = (disk: DiskInfo): string => {
    let baseName = disk.label;
    if (!baseName) {
        if (disk.mount === "/" || disk.mount === "C:") {
            baseName = "System";
        } else if (disk.mount === "/home") {
            baseName = "Home";
        } else if (/^\/(media|run\/media|mnt|Volumes)\b/.test(disk.mount)) {
            // Use the folder name it is mounted to
            const parts = disk.mount.split("/").filter(Boolean);
            baseName = parts.length > 0 ? parts[parts.length - 1] : "Drive";
        } else {
            // Fallback: strip /dev/ and partition numbers (nvme0n1p1 -> nvme0n1)
            baseName =
                disk.filesystem
                    .replace("/dev/", "")
                    .replace(/p\d+$/, "")
                    .replace(/\d+$/, "") || "Drive";
            baseName = baseName.toUpperCase();
        }
    }
    return disk.mount && disk.mount !== "/"
        ? `${baseName} (${disk.mount})`
        : `${baseName} (/)`;
};

const DiskBar = ({ disk }: { disk: DiskInfo }) => {
    const percent =
        disk.sizeGB > 0 ? (disk.usedGB / disk.sizeGB) * 100 : 0;
    const tag = disk.type !== "local" ? ` · ${disk.type}` : "";

    return (
        <Progress value={Math.max(0, Math.min(100, percent))}>
            <ProgressLabel>
                {getDiskName(disk)}
                {tag} · {formatSize(disk.usedGB)} / {formatSize(disk.sizeGB)}
            </ProgressLabel>
            <ProgressValue />
        </Progress>
    );
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
    <p className="border-t border-accent/10 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
    </p>
);

/** Connected disks by name with usage, split into internal and external/network drives. */
export const StorageWidget = () => {
    const { data: metrics } = useSuspenseQuery(useSystemOptions);

    const internal = metrics.disks.filter((disk) => disk.type === "local");
    const external = metrics.disks.filter((disk) => disk.type !== "local");
    // Only draw section headers when there is something to separate.
    const showHeaders = external.length > 0 && internal.length > 0;

    return (
        <div
            className={cn(
                "p-5 rounded-2xl bg-background/15 backdrop-blur-md border",
                "border-accent/5 pointer-events-auto"
            )}
        >
            <h3>Storage</h3>

            <div className="mt-3 space-y-3">
                {metrics.disks.length === 0 && (
                    <p className="text-xs text-muted-foreground">No disks found.</p>
                )}

                {showHeaders && internal.length > 0 && <SectionTitle>Internal</SectionTitle>}
                {internal.map((disk) => (
                    <DiskBar key={`${disk.mount}-${disk.filesystem}`} disk={disk} />
                ))}

                {external.length > 0 && (
                    <SectionTitle>External &amp; Network</SectionTitle>
                )}
                {external.map((disk) => (
                    <DiskBar key={`${disk.mount}-${disk.filesystem}`} disk={disk} />
                ))}
            </div>
        </div>
    );
};
