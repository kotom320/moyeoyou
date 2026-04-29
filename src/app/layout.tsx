import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모여유",
  description: "친구들과 일정을 맞춰봐요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
