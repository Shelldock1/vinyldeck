import { faqs } from '../content/features';

export function FAQ() {
  return (
    <section className="faq page-section" aria-labelledby="faq-title">
      <div className="section-shell faq-panel">
        <div className="faq-heading">
          <p className="mono section-eyebrow">Before you drop the needle</p>
          <h2 id="faq-title">Questions worth answering.</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
