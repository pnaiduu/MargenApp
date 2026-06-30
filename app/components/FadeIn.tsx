'use client'

import { useEffect, useRef } from 'react'

type FadeInProps = {
  children: React.ReactNode
  className?: string
}

export function FadeIn({ children, className = '' }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`fade-in ${className}`.trim()}>
      {children}
    </div>
  )
}
