import type { Metadata } from "next";
import "./globals.css";
import "./ui.css";

export const metadata: Metadata = {
  title: "계약서 작성 시스템",
  description: "계약서 작성 및 관리 시스템",
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
