import { img, video } from '../content/assets';
import { release } from '../content/downloads';
import { ProductFrame } from './ProductFrame';

export function Hero() {
  return (
    <section className="hero section-shell" id="top">
      <div className="hero-atmosphere" aria-hidden="true">
        <video src={video.hero} poster={img.heroNoirPoster} muted autoPlay loop playsInline />
        <div className="hero-noise" />
      </div>

      <div className="hero-copy reveal-up">
        <p className="mono hero-kicker">Windows system media visualizer</p>
        <h1 aria-label="Turn your desktop music into a living vinyl deck.">
          <span>Turn your desktop music</span>
          <span>into a living vinyl deck.</span>
        </h1>
        <p className="hero-lede">
          VinylDeck watches compatible Windows media sessions and gives the track you are already playing a physical record, tonearm, ambient glow and compact mini deck.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href={release.exeUrl}>Download for Windows</a>
          <a className="button button-ghost" href="#experience">See how it works</a>
        </div>
        <div className="hero-meta" aria-label="Product highlights">
          <span>Compatible system media</span>
          <span>Main · Mini · Fullscreen</span>
          <span>v{release.version}</span>
        </div>
      </div>

      <div className="hero-stage reveal-up reveal-delay-1" aria-label="VinylDeck product preview">
        <div className="hero-glow hero-glow--red" aria-hidden="true" />
        <div className="hero-glow hero-glow--blue" aria-hidden="true" />
        <ProductFrame
          src={img.noirMain}
          alt="VinylDeck Noir main window with a vinyl record and tonearm"
          variant="noir"
          className="hero-window hero-window--back"
          label="Noir"
        />
        <ProductFrame
          src={img.glassMain}
          alt="VinylDeck Glass main window playing a track"
          variant="glass"
          className="hero-window hero-window--front"
          label="Glass"
        />
        <figure className="hero-mini-card">
          <img src={img.miniNoir} alt="VinylDeck compact mini mode" />
          <figcaption>
            <strong>Mini mode</strong>
            <span>A small deck that can stay above your workspace.</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
