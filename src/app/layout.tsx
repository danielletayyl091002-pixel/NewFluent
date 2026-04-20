import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: "Fluent — Your Productivity System",
  description: "Pages, tasks, and finance in one place. Offline-first.",
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
