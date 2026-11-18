import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import { IBM_Plex_Sans_Thai, Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader, SiteHeaderFallback } from "@/components/layout/site-header"
import { PageSpinner } from "@/components/require-auth"
import { t } from "@/lib/i18n"
import { paletteBootScript } from "@/lib/palette"

// Inter for Latin (design system typeface), IBM Plex Sans Thai for Thai glyphs.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" })
const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.tagline,
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1116" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${inter.variable} ${thai.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies the saved colour palette before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: paletteBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <Suspense fallback={<SiteHeaderFallback />}>
            <SiteHeader />
          </Suspense>
          <main className="flex-1">
            <Suspense fallback={<PageSpinner />}>{children}</Suspense>
          </main>
          <Suspense>
            <SiteFooter />
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}
