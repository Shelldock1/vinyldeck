import { img } from '../content/assets';
import { release } from '../content/downloads';

const specs = [release.windows, release.requirement, 'Setup installer recommended', 'MSI available', 'Unsigned builds may show Publisher: Unknown'];

export function Download() {
  return (
    <section className="download page-section" id="download">
      <div className="section-shell download-panel">
        <div className="download-copy">
          <p className="mono section-eyebrow">Release {release.version}</p>
          <h2>Install the Windows deck.</h2>
          <p>
            Download VinylDeck, start music in a compatible player, and turn the active Windows media session into a living record on your desktop.
          </p>
          <div className="download-actions">
            <a className="button button-primary button-xl" href={release.exeUrl}>Download setup .exe</a>
            <a className="button button-ghost" href={release.msiUrl}>Download .msi</a>
            <a className="button button-link" href={release.releasesUrl}>All releases</a>
          </div>
          <div className="download-specs" aria-label="Release requirements">
            {specs.map((spec) => <span key={spec}>{spec}</span>)}
          </div>
        </div>
        <div className="download-card" aria-label="Windows download card">
          <img src={img.icon} alt="VinylDeck app icon" />
          <span className="mono">VinylDeck</span>
          <strong>{release.version}</strong>
          <p>Recommended installer for Windows 10 / 11</p>
        </div>
      </div>
    </section>
  );
}
