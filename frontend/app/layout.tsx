import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telentic - Autonomous Talent Acquisition",
  description: "AI-powered multi-agent recruitment platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
