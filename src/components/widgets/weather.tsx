import { cn } from "@/lib/utils";

export const WeatherWidget = () => {
    return (
        <div className={cn(
            "p-5 rounded-2xl bg-background/15 backdrop-blur-md border",
            "border-accent/5 pointer-events-auto"
        )}>
            <h3>Weather</h3>
            <div className="mt-3 space-y-2">
                <p className="text-3xl font-bold mt-1">72°F</p>
                <p className="text-xs opacity-70">Sunny in San Francisco</p>
            </div>
        </div>
    );
}