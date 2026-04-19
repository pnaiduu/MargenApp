/** Premium SaaS-style easing (smooth deceleration). */
export const easePremium = [0.22, 1, 0.36, 1] as const

export const transitionPage = {
  duration: 0.2,
  ease: easePremium,
} as const

export const transitionOverlay = {
  duration: 0.2,
  ease: easePremium,
} as const

export const transitionShell = {
  duration: 0.2,
  ease: easePremium,
} as const

export const transitionCrossfade = {
  duration: 0.18,
  ease: easePremium,
} as const

export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easePremium },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.2, ease: easePremium },
  },
}

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easePremium },
  },
}

export const tapButton = { scale: 0.99 }
