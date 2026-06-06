import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Build Your Quote | Margen',
  description: 'Tell us about your business and get an instant monthly estimate for your new website.',
}

export default function QuoteBuilderLayout({ children }: { children: React.ReactNode }) {
  return children
}
