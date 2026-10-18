import { createServerFn } from "@tanstack/react-start"
import { queryOptions } from "@tanstack/react-query"
import { ListDirectory, ReadTextFile } from "@/lib/files"

/** Lists one directory ("" means the home directory). Never throws: failures come back as `error`. */
export const listDirectory = createServerFn({ method: 'POST' })
    .validator((input: unknown) => input as string)
    .handler(({ data }) => ListDirectory(data))

/** Reads the head of a text file for the Quick Look preview. Never throws. */
export const readTextFile = createServerFn({ method: 'POST' })
    .validator((input: unknown) => input as string)
    .handler(({ data }) => ReadTextFile(data))

export const directoryOptions = (path: string) => queryOptions({
    queryKey: ['files', 'directory', path],
    queryFn: () => listDirectory({ data: path }),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
})

export const filePreviewOptions = (path: string) => queryOptions({
    queryKey: ['files', 'preview', path],
    queryFn: () => readTextFile({ data: path }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
})
