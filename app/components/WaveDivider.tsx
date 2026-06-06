import { WaveArt } from './WaveArt'

export function WaveDivider() {
  return (
    <div className="wave-divider" aria-hidden="true">
      <WaveArt className="wave-divider__svg" />
    </div>
  )
}
