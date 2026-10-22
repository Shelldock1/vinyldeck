import { img } from '../content/assets';
import { ProductFrame } from './ProductFrame';
import { SectionEyebrow } from './SectionEyebrow';

export function ThemeCompare() {
  return (
    <section className="theme-compare page-section" aria-labelledby="shell-title">
      <div className="split-copy reveal-up">
        <SectionEyebrow>Two shells, one deck</SectionEyebrow>
        <h2 id="shell-title">Noir is black lacquer. Glass is a soft acrylic display case.</h2>
        <p>
          The landing page inherits the real app language: OLED room depth, warm cream glass,
          album-art bloom, and controls that feel embedded in the surface instead of pasted on top.
        </p>
      </div>
      <div className="compare-stack reveal-scale">
        <ProductFrame src={img.noirMain} alt="VinylDeck Noir shell" theme="noir" />
        <ProductFrame src={img.glassMain} alt="VinylDeck Glass shell" theme="glass" className="compare-glass" />
        <div className="compare-divider mono" aria-hidden="true">Noir / Glass</div>
      </div>
    </section>
  );
}
