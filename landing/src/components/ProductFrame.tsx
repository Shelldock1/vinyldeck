type ProductFrameProps = {
  src: string;
  alt: string;
  variant?: 'noir' | 'glass';
  theme?: 'noir' | 'glass';
  className?: string;
  label?: string;
};

export function ProductFrame({ src, alt, variant, theme, className = '', label }: ProductFrameProps) {
  const resolvedVariant = variant ?? theme ?? 'noir';
  return (
    <figure className={`product-frame product-frame--${resolvedVariant} ${className}`}>
      <span className="window-chrome" aria-hidden="true"><i /><i /><i /></span>
      {label && <figcaption className="frame-label mono">{label}</figcaption>}
      <img src={src} alt={alt} loading="lazy" />
    </figure>
  );
}
