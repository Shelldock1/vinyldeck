import { img } from '../content/assets';
import { SectionEyebrow } from './SectionEyebrow';

const items = [
  {
    eyebrow: 'Physical vinyl',
    title: 'Grooves, sheen, wobble, and album-art labels.',
    text: 'The record is treated like a real object, not a circular thumbnail.',
    src: img.vinylMacro,
    tone: 'dark'
  },
  {
    eyebrow: 'Tonearm behavior',
    title: 'The needle breathes with playback state.',
    text: 'Playback, pause, skip, and idle states are visible through arm posture and deck motion.',
    src: img.tonearmMacro,
    tone: 'light'
  },
  {
    eyebrow: 'Settings that persist',
    title: 'Look, vinyl, display, and other app behavior stay synced.',
    text: 'The desktop app keeps settings backend-owned so main, fullscreen, and mini windows stay aligned.',
    src: img.settingsGlass,
    tone: 'light'
  },
  {
    eyebrow: 'System source',
    title: 'Built around Windows media sessions.',
    text: 'VinylDeck identifies the active source and exposes only the actions that source supports.',
    src: img.spotifySource,
    tone: 'dark'
  }
];

export function FeatureBento() {
  return (
    <section className="feature-bento page-section" aria-labelledby="features-title">
      <div className="section-heading reveal-up">
        <SectionEyebrow>Product details</SectionEyebrow>
        <h2 id="features-title">Every visual choice comes from the desktop app.</h2>
      </div>
      <div className="bento-grid">
        {items.map((item, index) => (
          <article key={item.title} className={`bento-card bento-card--${item.tone} reveal-up bento-${index + 1}`}>
            <img src={item.src} alt="" loading="lazy" />
            <div className="bento-content">
              <p className="mono">{item.eyebrow}</p>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
