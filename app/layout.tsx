import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "The Matrix | Humor Flavor Lab",
  description: "Crackd internal experimentation platform for humor flavors."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans"
        style={
          {
            "--font-sans":
              '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif'
          } as CSSProperties
        }
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="mesh-overlay" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
