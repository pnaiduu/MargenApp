type WaveArtProps = {
  className?: string
  viewBox?: string
}

export function WaveArt({ className = '', viewBox = '0 0 400 40' }: WaveArtProps) {
  return (
    <svg viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g className="wave-art__group wave-art__group--1">
        <path
          d="M0 20 C66 12, 66 28, 133 20 C200 12, 200 28, 266 20 C333 12, 333 28, 400 20"
          stroke="#c9a84c"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
      <g className="wave-art__group wave-art__group--2">
        <path
          d="M0 22 C44 14, 44 30, 88 22 C132 14, 132 30, 176 22 C220 14, 220 30, 264 22 C308 14, 308 30, 352 22 C396 14, 396 30, 400 22"
          stroke="#c9a84c"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
      <g className="wave-art__group wave-art__group--3">
        <path
          d="M0 24 C25 16, 25 32, 50 24 C75 16, 75 32, 100 24 C125 16, 125 32, 150 24 C175 16, 175 32, 200 24 C225 16, 225 32, 250 24 C275 16, 275 32, 300 24 C325 16, 325 32, 350 24 C375 16, 375 32, 400 24"
          stroke="#c9a84c"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
    </svg>
  )
}
