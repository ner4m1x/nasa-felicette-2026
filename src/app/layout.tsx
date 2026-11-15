import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const terminalFont = JetBrains_Mono({
  variable: "--font-terminal",
  subsets: ["latin", "latin-ext"],
});

// Icons: app/icon.svg and app/apple-icon.png (Félicette, rendered from FelicetteAvatar) via the
// file conventions; Next adds the <link> tags.
export const metadata: Metadata = {
  title: "P.U.R.R. Command Center – Earth analogs for Moon & Mars bases",
  description:
    "P.U.R.R. Command Center – Earth analogs for Moon & Mars bases. Swipe through places on Earth ranked by planetary similarity (Analog Score) and by fit for your mission.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1116",
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
