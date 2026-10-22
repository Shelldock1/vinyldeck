import { img } from '../content/assets';
import { ProductFrame } from './ProductFrame';

export function Shells() {
  return (
    <section className="shells" id="shells">
      <div className="section-shell shells-inner">
        <div className="shells-copy">
          <p className="mono section-eyebrow">Noir / Glass</p>
          <h2 aria-label="Two materials. One turntable.">
            <span>Two materials.</span>
            <span>One turntable.</span>
          </h2>
          <p>
            Noir feels like an OLED listening room. Glass feels like a warm acrylic display case. The record, arm and controls stay familiar while the material around them changes.
          </p>
        </div>
        <div className="shells-stage">
          <ProductFrame
            src={img.noirMain}
            alt="VinylDeck Noir shell"
            variant="noir"
            className="shell-frame shell-frame--noir"
            label="Noir"
          />
          <ProductFrame
            src={img.glassMain}
            alt="VinylDeck Glass shell"
            variant="glass"
            className="shell-frame shell-frame--glass"
            label="Glass"
          />
          <div className="shell-divider" aria-hidden="true"><span>material reveal</span></div>
        </div>
      </div>
    </section>
  );
}
