import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Manrope, self-hosted through next/font so there is no request to Google at
 * runtime and no layout shift. One family at several weights does all the
 * work: the design leans on weight contrast (400 body, 700 headings, 800
 * figures) rather than a second face.
 */
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Operations Management System",
    template: "%s · OMS",
  },
  description: "Internal operations management for KWI and ICC.",
  // Internal tool — never index, and do not leak URLs via referrer.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={manrope.variable}>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
