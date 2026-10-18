import { cn } from '@/lib/utils'

export const Wallpaper = ({ src }: { src: string }) => {
    return (
        <article className='fixed inset-0 w-full h-full z-[-1] *:select-none'>
            <div className='absolute inset-0 blur-2xl flex-1 h-full w-full opacity-40' />
            <img
                alt='Wallpaper'
                src={src}
                className={cn(
                    'transition-opacity duration-500 pointer-events-none',
                    'absolute inset-0 object-cover md:object-fill w-full h-full',
                )}
            />
        </article>
    )
}