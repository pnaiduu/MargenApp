import { WaveArt } from './WaveArt'

export function HeroWaveDecor() {
  return (
    <div className="hero-wave-decor" aria-hidden="true">
      <WaveArt className="hero-wave-decor__svg" viewBox="0 0 480 200" />
    </div>
  )
}
