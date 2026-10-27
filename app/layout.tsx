import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ui.css";

export const metadata: Metadata = {
  title: "계약서 작성 시스템",
  description: "계약서 작성 및 관리 시스템",
};

// 아이패드 사파리는 글자가 16px보다 작은 입력칸을 누르면 화면을 자동 확대한다.
// 계약서 입력칸은 종이 양식처럼 작게 그려서 매번 확대되므로 막는다(iOS는 두 손가락 확대는 그대로 허용한다)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 안내문 펜 표시가 기기와 상관없이 같은 자리에 겹치도록 안내문 글꼴을 고정한다(NoticeSheet) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
