const nodes = [
  ['Your player', 'Spotify, browser, VLC'],
  ['Windows media', 'active system session'],
  ['VinylDeck', 'reads the session'],
  ['Living deck', 'record, arm, glow']
];

export function ProofStrip() {
  return (
    <section id="experience" className="proof section-shell" aria-label="How VinylDeck works">
      <div className="proof-copy">
        <p className="mono section-eyebrow">Not another player</p>
        <h2>Your music stays where it is.</h2>
        <p>
          Start playback in the app you already use. VinylDeck listens to the compatible Windows media session and renders the current track as a physical desktop object.
        </p>
      </div>
      <div className="proof-flow" aria-label="System media flow">
        {nodes.map(([top, bottom], index) => (
          <div className="proof-step" key={top}>
            <span className="proof-index mono">0{index + 1}</span>
            <strong>{top}</strong>
            <small>{bottom}</small>
            {index < nodes.length - 1 && <b aria-hidden="true">→</b>}
          </div>
        ))}
      </div>
    </section>
  );
}
