import { createServerFn } from "@tanstack/react-start"
import { GetSystemMetrics, GetNetworkInfo } from "@/lib/storage"
import { queryOptions } from "@tanstack/react-query";

export const getSystemMetrics = createServerFn({ method: 'GET' })
    .handler(async () => {
        const metrics = await GetSystemMetrics();
        return metrics;
    });

export const getNetworkInfo = createServerFn({ method: 'GET' })
    .handler(async () => {
        const info = await GetNetworkInfo();
        return info;
    });

export const useSystemOptions = queryOptions({
    queryKey: ['system'],
    queryFn: getSystemMetrics,
    refetchInterval: 5000, // 5 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0, // 5 seconds
    refetchIntervalInBackground: true
})

export const useNetworkOptions = queryOptions({
    queryKey: ['network'],
    queryFn: getNetworkInfo,
    refetchInterval: 15000, // 15 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    refetchIntervalInBackground: true
})