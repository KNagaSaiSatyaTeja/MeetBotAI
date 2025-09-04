import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'AI Meeting Bot',
    template: '%s | AI Meeting Bot',
  },
  description: 'AI-powered meeting transcription and summarization platform',
  keywords: ['AI', 'meeting', 'transcription', 'summarization', 'productivity'],
  authors: [{ name: 'AI Meeting Bot Team' }],
  creator: 'AI Meeting Bot',
  publisher: 'AI Meeting Bot',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    title: 'AI Meeting Bot',
    description: 'AI-powered meeting transcription and summarization platform',
    siteName: 'AI Meeting Bot',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Meeting Bot',
    description: 'AI-powered meeting transcription and summarization platform',
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
