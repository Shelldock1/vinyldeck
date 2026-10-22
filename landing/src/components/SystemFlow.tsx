import { SectionEyebrow } from './SectionEyebrow';

const steps = ['Spotify', 'Browser', 'VLC', 'Windows media session', 'VinylDeck', 'Animated vinyl deck'];

export function SystemFlow() {
  return (
    <section id="experience" className="system-flow page-section reveal-up" aria-labelledby="flow-title">
      <div className="section-heading section-heading--center">
        <SectionEyebrow>Not another music app</SectionEyebrow>
        <h2 id="flow-title">VinylDeck visualizes what is already playing.</h2>
        <p>
          It does not replace your player. It turns the active Windows media session into a tactile deck,
          with controls flowing back through the same system media path when supported.
        </p>
      </div>
      <div className="flow-rail" aria-label="System media flow">
        {steps.map((step, index) => (
          <div key={step} className={`flow-node ${index > 2 ? 'flow-node--primary' : ''}`}>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
