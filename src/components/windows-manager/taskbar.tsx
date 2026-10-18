import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { useWindows } from './provider'
import { APPS, useAppLauncher } from './apps'

export const Taskbar = () => {
    const { windows } = useWindows()
    const launchApp = useAppLauncher()

    const itemslist = APPS

    return (
        <footer
            data-taskbar
            className={cn(
                "fixed bottom-0 inset-x-0 z-1000 flex justify-center p-2",
                "pb-[calc(0.5rem_+_env(safe-area-inset-bottom))]",
                'md:bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2',
                'pointer-events-none'
            )}
        >
            <section className="flex items-center gap-1 p-1.5 bg-muted/35 backdrop-blur-md rounded-2xl md:rounded-3xl border border-white/10 shadow-lg pointer-events-auto">
                {itemslist.map((item) => {
                    const isOpen = !!windows[item.id]
                    const isFocused = windows[item.id]?.isFocused && !windows[item.id]?.isMinimized

                    return (
                        <Tooltip key={item.id}>
                            <TooltipTrigger
                                render={
                                    <Button
                                        data-taskbar-app={item.id}
                                        size="icon"
                                        variant="ghost"
                                        className={cn(
                                            "relative rounded-2xl transition-all duration-200 size-11 hover:bg-olive-500/20 active:scale-95",
                                            isFocused && "bg-olive-500/30"
                                        )}
                                        onClick={() => launchApp(item)}
                                    />
                                }
                            >
                                <HugeiconsIcon icon={item.icon} className="size-6" />
                                {isOpen && (
                                    <span className={cn("absolute bottom-1 size-1 rounded-full bg-olive-500 transition-all", isFocused && "w-3 bg-primary")} />
                                )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-popover text-popover-foreground border z-[9999]">
                                <p>{item.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </section>
        </footer>
    )
}