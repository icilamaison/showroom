"use client";

import { ADMIN_QUERY_CACHE_KEY } from "@/lib/api-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";

// 새로고침해도 직전 목록을 바로 보여주기 위해 localStorage에 캐시를 보관한다
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 하루 지난 캐시는 버린다

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 렌더마다 새 클라이언트가 생기면 캐시가 사라지므로 한 번만 만든다
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // 401은 재시도해도 같으므로 로그인 이동이 늦어지지 않게 재시도하지 않는다
          // gcTime이 maxAge보다 짧으면 저장 전에 캐시가 지워져 복원되지 않는다
          queries: { retry: false, refetchOnWindowFocus: false, gcTime: CACHE_MAX_AGE },
        },
      }),
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      // 서버 렌더링 중에는 localStorage가 없다
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: ADMIN_QUERY_CACHE_KEY,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
