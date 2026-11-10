"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

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
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
