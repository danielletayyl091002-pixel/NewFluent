import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: "Fluent — Your Productivity System",
  description: "Pages, tasks, and finance in one place. Offline-first.",
  manifest: "/manifest.webmanifest",
  applicationName: "Fluent",
  appleWebApp: {
    capable: true,
    title: "Fluent",
    statusBarStyle: "default",
  },
};

// Next 16 moved themeColor to viewport export (Metadata.themeColor is deprecated).
export const viewport: Viewport = {
  themeColor: "#3B82F6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full" style={{ margin: 0 }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
