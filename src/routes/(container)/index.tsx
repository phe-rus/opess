import { StorageWidget } from '@/components/widgets/storage'
import { SystemUsageWidget } from '@/components/widgets/system-usage'
import { WeatherWidget } from '@/components/widgets/weather'
import { WidgetDock } from '@/components/widgets/widget-dock'
import { useWidgetDock } from '@/hooks/use-widget-dock'
import { useWindows } from '@/components/windows-manager/provider'
import { WindowFrame } from '@/components/windows-manager/windows-frame'
import { cn } from '@/lib/utils'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(container)/')({ component: Home })

function Home() {
  const { windows } = useWindows()
  const { layouts, dock, undock } = useWidgetDock()

  return (
    <>
      {/* Widgets: default is the side strip (small screens) or side column (desktop).
          Each widget can be dragged anywhere on the desktop; the position is remembered. */}
      <div className={cn(
        "absolute z-10 select-none pointer-events-none",
        "top-0 inset-x-0 flex flex-row gap-3 px-3 pb-1",
        "pt-[calc(0.75rem_+_env(safe-area-inset-top))]",
        "overflow-x-auto overflow-y-auto no-scrollbar max-h-[40svh]",
        "md:top-5 md:right-5 md:left-auto md:w-64 md:flex-col md:gap-5 md:p-0",
        "md:overflow-visible md:max-h-none",
        "[&>*]:shrink-0 [&>*]:w-56 md:[&>*]:w-auto"
      )}>
        <WidgetDock id="weather" layout={layouts.weather} onDock={dock} onUndock={undock}>
          <WeatherWidget />
        </WidgetDock>
        <WidgetDock id="system-usage" layout={layouts["system-usage"]} onDock={dock} onUndock={undock}>
          <SystemUsageWidget />
        </WidgetDock>
        <WidgetDock id="storage" layout={layouts.storage} onDock={dock} onUndock={undock}>
          <StorageWidget />
        </WidgetDock>
      </div>

      {/* Render Windows */}
      <article className="relative w-full h-svh overflow-hidden">
        {Object.values(windows).map((win) => (
          <WindowFrame key={win.id} window={win} />
        ))}
      </article>
    </>
  )
}
