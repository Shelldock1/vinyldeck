import { img } from '../content/assets';

const cards = [
  {
    eyebrow: '01 / Record object',
    title: 'The vinyl is not a thumbnail.',
    text: 'Grooves, sheen, wobble and an album-art label make the current track feel like a collectible pressing instead of a flat image inside a circle.',
    image: img.vinylMacro,
    alt: 'Macro view of VinylDeck red vinyl grooves',
    className: 'deep-card--wide'
  },
  {
    eyebrow: '02 / Needle state',
    title: 'The tonearm tells you what is happening.',
    text: 'Play, pause, cue and idle states read through the arm angle, so status feels physical before it feels informational.',
    image: img.tonearmMacro,
    alt: 'Macro view of a tonearm above red vinyl',
    className: ''
  },
  {
    eyebrow: '03 / Album glow',
    title: 'The room borrows color from the track.',
    text: 'Album art becomes restrained ambient light, so the interface reacts without turning into a visualizer cliché.',
    image: img.spotifySource,
    alt: 'VinylDeck showing album-art ambient color and source information',
    className: ''
  }
];

export function ProductDeepDive() {
  return (
    <section className="deep-dive page-section" id="motion">
      <div className="section-shell">
        <div className="section-heading deep-heading">
          <p className="mono section-eyebrow">Motion language</p>
          <h2>The deck moves like the music is physical.</h2>
          <p>
            VinylDeck keeps motion restrained: steady rotation, slow album bloom, a needle with intent and glass that behaves like material.
          </p>
        </div>
        <div className="deep-grid">
          {cards.map((card) => (
            <article className={`deep-card ${card.className}`} key={card.title}>
              <img src={card.image} alt={card.alt} loading="lazy" />
              <div>
                <p className="mono">{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
