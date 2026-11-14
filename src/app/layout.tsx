import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const terminalFont = JetBrains_Mono({
  variable: "--font-terminal",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "P.U.R.R. Command Center",
  description: "Planetary Utility for Regolith Reconnaissance — Earth analogs for Moon and Mars bases.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050a07",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // `lang` is updated on the client by I18nProvider when the user switches language.
  return (
    <html lang="en" className={`${terminalFont.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
