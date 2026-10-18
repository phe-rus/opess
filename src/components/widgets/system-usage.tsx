import { cn } from "@/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSystemOptions } from "@/hooks/use-system";
import { formatSize } from "@/lib/format";
import { Progress, ProgressLabel, ProgressValue } from "../ui/progress";

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Live CPU and memory usage, backed by the same system metrics server function
 * as the storage widget (refreshed every 5 seconds).
 */
export const SystemUsageWidget = () => {
    const { data: metrics } = useSuspenseQuery(useSystemOptions);
    const { cpu, memory } = metrics;

    const memoryPercent =
        memory.totalGB > 0 ? (memory.usedGB / memory.totalGB) * 100 : 0;

    return (
        <div
            className={cn(
                "p-5 rounded-2xl bg-background/15 backdrop-blur-md border",
                "border-accent/5 pointer-events-auto"
            )}
        >
            <div className="flex items-baseline justify-between gap-3">
                <h3>System Usage</h3>
                <span
                    className="max-w-[60%] truncate text-[11px] text-muted-foreground"
                    title={cpu.model}
                >
                    {cpu.model}
                </span>
            </div>

            <div className="mt-4 space-y-4">
                <div className="space-y-2">
                    <Progress value={clampPercent(cpu.usage)}>
                        <ProgressLabel>CPU · {cpu.cores} cores</ProgressLabel>
                        <ProgressValue />
                    </Progress>

                    {/* Per core load, Activity Monitor style */}
                    {cpu.perCoreUsage.length > 0 && (
                        <div className="flex h-8 items-end gap-[3px]">
                            {cpu.perCoreUsage.map((load, index) => {
                                const percent = clampPercent(load);
                                return (
                                    <div
                                        key={index}
                                        title={`Core ${index}: ${percent}%`}
                                        className="relative h-full flex-1 overflow-hidden rounded-sm bg-muted/70"
                                    >
                                        <div
                                            className="absolute inset-x-0 bottom-0 rounded-sm bg-primary/80"
                                            style={{ height: `${percent}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <Progress value={clampPercent(memoryPercent)}>
                    <ProgressLabel>
                        Memory · {formatSize(memory.usedGB)} / {formatSize(memory.totalGB)}
                    </ProgressLabel>
                    <ProgressValue />
                </Progress>
            </div>
        </div>
    );
};
