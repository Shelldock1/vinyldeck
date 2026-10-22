const stack = [
  ['Tauri v2 shell', 'Native Windows windowing, tray and lifecycle.'],
  ['Rust media backend', 'System media polling, commands and settings ownership.'],
  ['Compatible SMTC players', 'Spotify, browsers, VLC and apps that expose Windows media sessions.'],
  ['React visual engine', 'Vinyl, tonearm, controls, shells and settings UI.'],
  ['One settings truth', 'Main, mini and fullscreen stay aligned.'],
  ['Keyboard + tray', 'Desktop companion behavior, not a browser tab.']
];

export function NativeStack() {
  return (
    <section className="native page-section">
      <div className="section-shell native-panel">
        <div className="native-copy">
          <p className="mono section-eyebrow">Native desktop core</p>
          <h2>Built native where it matters.</h2>
          <p>
            VinylDeck is not a mock player inside a web page. Rust and Tauri handle media sessions, windows, tray behavior and settings ownership while React renders the deck.
          </p>
        </div>
        <div className="native-grid">
          {stack.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
