import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

// Downloaded at build time and served from our own domain: no requests to Google from the phone.
const archivo = Archivo({ subsets: ['latin'], variable: '--f-archivo', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--f-plex', display: 'swap' })

export const metadata: Metadata = {
  title: { template: '%s · CEDIVEP S.R.L.', default: 'CEDIVEP S.R.L.' },
  robots: { index: false, follow: false },
}

// Every page renders per request: the CSP nonce needs it, and nothing per clinic may be cached.
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
