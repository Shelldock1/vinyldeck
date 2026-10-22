import { release } from '../content/downloads';
import { img } from '../content/assets';

export function Nav() {
  return (
    <header className="site-nav" aria-label="Primary navigation">
      <a className="brand" href="#top" aria-label="VinylDeck home">
        <img src={img.icon} alt="" aria-hidden="true" />
        <span>VinylDeck</span>
      </a>
      <nav className="nav-links" aria-label="Page sections">
        <a href="#experience">Experience</a>
        <a href="#shells">Shells</a>
        <a href="#modes">Modes</a>
        <a href="#download">Download</a>
      </nav>
      <a className="nav-cta" href={release.exeUrl}>Download for Windows</a>
    </header>
  );
}
