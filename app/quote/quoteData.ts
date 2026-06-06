export type Plan = {
  id: string
  name: string
  price: number
  pages: string
}

export type Feature = {
  id: string
  name: string
  description: string
  price: number
}

export type FeatureSection = {
  id: string
  title: string
  features: Feature[]
}

export const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', price: 400, pages: 'up to 5 pages' },
  { id: 'standard', name: 'Standard', price: 750, pages: 'up to 10 pages' },
  { id: 'growth', name: 'Growth', price: 1000, pages: 'up to 20 pages' },
  { id: 'premium', name: 'Premium', price: 1500, pages: 'unlimited pages' },
]

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: 'design',
    title: 'Design & branding',
    features: [
      { id: 'custom-visual-design', name: 'Custom visual design', description: 'Bespoke layout and visual identity tailored to the client brand.', price: 150 },
      { id: 'logo-brand', name: 'Logo & brand integration', description: 'Integrate existing logo, colors, and brand assets across the site.', price: 50 },
      { id: 'dark-mode', name: 'Dark mode support', description: 'Automatic or toggle-based dark theme matching system preference.', price: 75 },
      { id: 'scroll-animations', name: 'Scroll animations', description: 'Subtle fade-in and motion as sections enter the viewport.', price: 75 },
      { id: 'custom-typography', name: 'Custom typography', description: 'Premium font pairing loaded and applied site-wide.', price: 25 },
      { id: 'favicon-social', name: 'Favicon & social preview', description: 'Favicon, Open Graph, and Twitter card images configured.', price: 25 },
    ],
  },
  {
    id: 'pages',
    title: 'Pages & content',
    features: [
      { id: 'blog', name: 'Blog / news section', description: 'CMS-ready blog with categories and post templates.', price: 150 },
      { id: 'faq', name: 'FAQ page', description: 'Structured FAQ page with expandable questions.', price: 50 },
      { id: 'team-about', name: 'Team / about page', description: 'Team bios, photos, and company story page.', price: 75 },
      { id: 'portfolio', name: 'Portfolio / gallery', description: 'Filterable gallery or project showcase.', price: 100 },
      { id: 'careers', name: 'Careers page', description: 'Open roles listing with application form.', price: 100 },
      { id: 'testimonials', name: 'Testimonials section', description: 'Client quotes integrated into key pages.', price: 50 },
      { id: 'case-studies', name: 'Case studies', description: 'Detailed project write-ups with results.', price: 100 },
      { id: 'extra-landing', name: 'Extra landing pages (per 3)', description: 'Three additional campaign or service landing pages.', price: 150 },
    ],
  },
  {
    id: 'forms',
    title: 'Forms & functionality',
    features: [
      { id: 'contact-form', name: 'Contact form', description: 'Validated contact form with email notifications.', price: 50 },
      { id: 'booking', name: 'Online booking / scheduling', description: 'Calendly, Acuity, or similar booking embed.', price: 75 },
      { id: 'quote-form', name: 'Quote request form', description: 'Multi-step quote request with conditional fields.', price: 100 },
      { id: 'live-chat', name: 'Live chat widget', description: 'Intercom, Drift, or Tidio chat integration.', price: 75 },
      { id: 'newsletter', name: 'Email newsletter signup', description: 'Mailchimp or ConvertKit signup form.', price: 50 },
      { id: 'lead-popup', name: 'Lead capture popup', description: 'Timed or exit-intent offer popup.', price: 75 },
      { id: 'site-search', name: 'Site search', description: 'Full-text search across site content.', price: 100 },
      { id: 'google-maps', name: 'Google Maps embed', description: 'Interactive map with business pin.', price: 25 },
      { id: 'google-reviews', name: 'Google Reviews feed', description: 'Live Google review display on site.', price: 75 },
      { id: 'social-feed', name: 'Social media feed', description: 'Instagram or Facebook feed embed.', price: 75 },
    ],
  },
  {
    id: 'ecommerce',
    title: 'E-commerce & payments',
    features: [
      { id: 'online-store', name: 'Online store', description: 'Product catalog with cart and checkout flow.', price: 500 },
      { id: 'stripe', name: 'Stripe payment processing', description: 'Secure card payments via Stripe.', price: 150 },
      { id: 'invoicing', name: 'Online invoicing', description: 'Send and track invoices from the site.', price: 100 },
      { id: 'subscription', name: 'Subscription / membership', description: 'Recurring billing and member areas.', price: 350 },
      { id: 'gift-cards', name: 'Gift cards', description: 'Purchasable and redeemable gift cards.', price: 100 },
      { id: 'discount-codes', name: 'Discount codes', description: 'Promo codes and percentage discounts.', price: 75 },
      { id: 'inventory', name: 'Inventory management', description: 'Stock tracking and low-inventory alerts.', price: 150 },
    ],
  },
  {
    id: 'seo',
    title: 'SEO & performance',
    features: [
      { id: 'full-seo', name: 'Full SEO setup', description: 'Meta tags, sitemap, robots.txt, and schema markup.', price: 100 },
      { id: 'local-seo', name: 'Local SEO optimization', description: 'Google Business Profile alignment and local schema.', price: 100 },
      { id: 'speed', name: 'Speed optimization', description: 'Core Web Vitals tuning and asset optimization.', price: 75 },
      { id: 'analytics', name: 'Google Analytics setup', description: 'GA4 property, events, and conversion tracking.', price: 50 },
      { id: 'heatmap', name: 'Heatmap & session recording', description: 'Hotjar or Microsoft Clarity integration.', price: 50 },
      { id: 'seo-reporting', name: 'Monthly SEO reporting', description: 'Monthly rankings and traffic summary.', price: 100 },
      { id: 'ab-testing', name: 'A/B testing', description: 'Split-test headlines, CTAs, and layouts.', price: 150 },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced & custom',
    features: [
      { id: 'multi-language', name: 'Multi-language support', description: 'Two or more languages with language switcher.', price: 200 },
      { id: 'client-portal', name: 'Client portal / login area', description: 'Authenticated area for clients or members.', price: 400 },
      { id: 'crm', name: 'CRM integration', description: 'HubSpot, Salesforce, or similar CRM sync.', price: 150 },
      { id: 'api', name: 'Third-party API integration', description: 'Custom API connection to external software.', price: 300 },
      { id: 'admin-dashboard', name: 'Custom admin dashboard', description: 'Private dashboard for managing site data.', price: 500 },
      { id: 'zapier', name: 'Zapier / Make automations', description: 'Workflow automations between site and tools.', price: 100 },
      { id: 'service-map', name: 'Interactive service area map', description: 'Custom map showing coverage zones.', price: 125 },
      { id: 'calculator', name: 'Custom calculator / quote tool', description: 'On-site pricing or ROI calculator.', price: 175 },
      { id: 'video-bg', name: 'Video background', description: 'Hero or section with optimized video background.', price: 75 },
      { id: '3d', name: '3D elements', description: 'WebGL or 3D product/visual elements.', price: 100 },
    ],
  },
  {
    id: 'mobile',
    title: 'Mobile & apps',
    features: [
      { id: 'pwa', name: 'Progressive web app (PWA)', description: 'Installable app experience from the browser.', price: 150 },
      { id: 'push', name: 'Push notifications', description: 'Browser push alerts for updates and offers.', price: 100 },
      { id: 'app-mockups', name: 'Mobile app design mockups', description: 'High-fidelity iOS/Android design concepts.', price: 200 },
    ],
  },
  {
    id: 'support',
    title: 'Support & extras',
    features: [
      { id: 'priority-support', name: 'Priority same-day support', description: 'Same-day response for urgent requests.', price: 150 },
      { id: 'strategy-call', name: 'Monthly strategy call', description: '30-minute monthly check-in with the client.', price: 100 },
      { id: 'content-writing', name: 'Content writing', description: 'Professional copy for key pages each month.', price: 200 },
      { id: 'photo-editing', name: 'Photo editing', description: 'Retouching and optimization of client photos.', price: 75 },
      { id: 'gdpr', name: 'GDPR / privacy compliance', description: 'Cookie consent, privacy policy, and compliance setup.', price: 75 },
      { id: 'accessibility', name: 'Accessibility (WCAG 2.1)', description: 'WCAG 2.1 AA accessibility audit and fixes.', price: 100 },
      { id: 'backups', name: 'Daily backups', description: 'Automated daily backups with restore capability.', price: 50 },
      { id: 'uptime', name: 'Uptime monitoring', description: '24/7 uptime alerts and status monitoring.', price: 25 },
    ],
  },
]
