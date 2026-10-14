import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/cormorant-garamond";
import "./globals.css";
import { DeskProvider } from "@/components/desk";
import { Shell } from "@/components/shell";
import { GuideProvider } from "@/components/guide";

export const metadata: Metadata = {
  title: "Title Desk",
  description: "Texas title and registration, ready for webDEALER.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f3ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <DeskProvider>
          <GuideProvider>
            <Shell>{children}</Shell>
          </GuideProvider>
        </DeskProvider>
      </body>
    </html>
  );
}
