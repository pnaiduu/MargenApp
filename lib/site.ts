export const CALENDLY = 'https://calendly.com/davynaidu/30min'
export const LOGO = '/margen-logo.png'
export const SITE_NAME = 'Margen'
export const SITE_LOCATION = 'Allen, Texas'
export const SITE_DOMAIN = 'trymargen.com'
export const SITE_URL = `https://${SITE_DOMAIN}`
export const CONTACT_EMAIL = 'hello@trymargen.com'

export const SITE_PHONE = process.env.NEXT_PUBLIC_SITE_PHONE ?? ''
export const SITE_PHONE_DISPLAY = process.env.NEXT_PUBLIC_SITE_PHONE_DISPLAY ?? SITE_PHONE

export const SERVICES_LINKS = [
  { href: '/services/web-design', label: 'Web Design' },
  { href: '/services/management', label: 'Website Management' },
  { href: '/services/seo', label: 'SEO' },
  { href: '/services/whats-included', label: "What's Included" },
] as const

export const COMPANY_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/why-margen', label: 'Why Margen' },
  { href: '/contact', label: 'Contact' },
] as const

export const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  ...SERVICES_LINKS,
  ...COMPANY_LINKS,
  { href: '/careers', label: 'Careers' },
  { href: '/quote-builder', label: 'Get a Quote' },
] as const

export const SAMPLES = [
  {
    id: 'atlas-law',
    business: 'Law Firm',
    name: 'Atlas Law Group',
    desc: 'Dark navy and gold. Old-money authority for personal injury and criminal defense.',
    src: '/samples/atlas-law.html',
    cardClass: 'sample-card--law',
  },
  {
    id: 'lumiere',
    business: 'Med Spa',
    name: 'Lumière Med Spa',
    desc: 'Warm cream and rose gold. Luxury aesthetics for Botox, fillers, and laser treatments.',
    src: '/samples/lumiere-medspa.html',
    cardClass: 'sample-card--spa',
  },
  {
    id: 'arctic-air',
    business: 'HVAC',
    name: 'Arctic Air HVAC',
    desc: 'Clean white and blue. Trustworthy local service for AC repair and 24/7 emergency calls.',
    src: '/samples/arctic-air.html',
    cardClass: 'sample-card--hvac',
  },
] as const

export const STEPS = [
  {
    title: 'Free website audit',
    desc: "We review your site and show you exactly what's hurting your business.",
  },
  {
    title: 'We build or rebuild',
    desc: 'Clean, fast, mobile-first. Usually live within 7 to 10 days.',
  },
  {
    title: 'You text us changes',
    desc: 'New hours, services, photos, pages. Done within 48 hours.',
  },
  {
    title: 'One flat rate',
    desc: 'No surprise invoices. No per-update fees. Cancel anytime.',
  },
] as const

export const BUILDER_COMPARISON = [
  'Website builders leave you alone with a tool and a tutorial. We give you a real person who knows your business.',
  "With a builder, updates mean logging in, figuring out the interface, and hoping nothing breaks. With Margen, you text your developer and it's done in 48 hours.",
  'Builders give everyone the same templates. We build something custom to your business from scratch.',
  'When something goes wrong with a builder, you\'re on your own. When something goes wrong with Margen, your developer fixes it.',
  'Builders charge you for every feature upgrade. Margen is one flat rate — everything included.',
] as const

export const HERO_VALUE_PROP =
  'Your own dedicated developer. One flat monthly rate. Text them anything, anytime — they know your business and handle everything.'

export const HERO_STATS = [
  '$500 to $2k / flat monthly',
  'Cancel anytime',
  '48hr turnaround',
] as const
