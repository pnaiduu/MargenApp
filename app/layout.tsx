import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Margen | Premium Web Retainer Agency',
  description:
    'One flat monthly rate for your web presence. Updates, new pages, fixes, and SEO: all included. Based in Allen, Texas.',
  icons: { icon: '/margen-logo.png' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable} style={{ colorScheme: 'light' }}>
      <head>
        <meta name="google-site-verification" content="PQSFj42BAV4zAA1gU0NbpD5kydq-ioAncQQmlPJ6a8U" />
      </head>
      <body>{children}</body>
    </html>
  )
}
