export function WaveDivider() {
  return (
    <div className="wave-divider" aria-hidden="true">
      <svg viewBox="0 0 400 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="wave-divider__svg">
        <g className="wave-divider__group wave-divider__group--1">
          <path
            d="M0 18 C50 10, 50 26, 100 18 C150 10, 150 26, 200 18 C250 10, 250 26, 300 18 C350 10, 350 26, 400 18"
            stroke="#c9a84c"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
        <g className="wave-divider__group wave-divider__group--2">
          <path
            d="M0 20 C50 28, 50 12, 100 20 C150 28, 150 12, 200 20 C250 28, 250 12, 300 20 C350 28, 350 12, 400 20"
            stroke="#c9a84c"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
      </svg>
    </div>
  )
}
