import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

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
      <body className={spaceGrotesk.variable}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="mesh-overlay" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
