import { img, video } from '../content/assets';
import { ProductFrame } from './ProductFrame';

export function Modes() {
  return (
    <section className="modes page-section" id="modes">
      <div className="section-shell modes-shell">
        <div className="modes-heading">
          <p className="mono section-eyebrow">Window modes</p>
          <h2>Three ways to keep the deck nearby.</h2>
          <p>Main for choosing, Mini for working, Fullscreen for listening. Each mode keeps the same turntable language instead of becoming a separate app.</p>
        </div>

        <div className="mode-gallery">
          <article className="mode-card mode-card--main">
            <ProductFrame src={img.noirMain} alt="VinylDeck main window" variant="noir" />
            <div>
              <span className="mono">Main</span>
              <h3>Focused desktop window.</h3>
              <p>The complete deck, controls and track context when you are actively choosing music.</p>
            </div>
          </article>
          <article className="mode-card mode-card--mini">
            <div className="mini-video-shell">
              <video src={video.miniMode} poster={img.miniGlass} muted autoPlay loop playsInline />
              <ProductFrame src={img.miniNoir} alt="VinylDeck mini Noir window" className="mini-float mini-float--noir" />
              <ProductFrame src={img.miniGlass} alt="VinylDeck mini Glass window" variant="glass" className="mini-float mini-float--glass" />
            </div>
            <div>
              <span className="mono">Mini</span>
              <h3>A corner companion.</h3>
              <p>A compact always-on-top deck for keeping the record visible while you work.</p>
            </div>
          </article>
          <article className="mode-card mode-card--full">
            <ProductFrame src={img.fullscreenNoir} alt="VinylDeck fullscreen Noir mode" variant="noir" />
            <div>
              <span className="mono">Fullscreen</span>
              <h3>The room becomes the player.</h3>
              <p>Fullscreen strips back everything except the vinyl, tonearm and ambient album glow.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
