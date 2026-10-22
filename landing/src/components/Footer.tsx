import { img } from '../content/assets';

export function Footer() {
  return (
    <footer className="footer section-shell">
      <a className="brand" href="#top">
        <img src={img.icon} alt="" aria-hidden="true" />
        <span>VinylDeck</span>
      </a>
      <p>Music stays in your player. VinylDeck becomes the deck.</p>
      <nav aria-label="Footer links">
        <a href="#experience">How it works</a>
        <a href="#download">Download</a>
        <a href="#top">Back to top</a>
      </nav>
    </footer>
  );
}
