import type { ImgHTMLAttributes } from 'react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** Used as default `alt` when the mark is meaningful (non-decorative). */
  title?: string
}

/**
 * Raster Margen mark from `/Margen.png` (synced from repo-root `Margen.png` on build).
 * Pass `className` for height/width; default is a slightly larger bar mark than the old SVG.
 */
export function MargenLogo({
  title = 'Margen',
  className,
  alt,
  'aria-hidden': ariaHidden,
  ...props
}: Props) {
  const decorative = ariaHidden === true || ariaHidden === 'true'
  const size = className?.trim() ? className : 'h-11 w-auto'
  return (
    <img
      {...props}
      src="/Margen.png"
      alt={decorative ? '' : alt ?? title}
      aria-hidden={ariaHidden}
      decoding="async"
      className={['shrink-0 object-contain', size].join(' ')}
    />
  )
}
