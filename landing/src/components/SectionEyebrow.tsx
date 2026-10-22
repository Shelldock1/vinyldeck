import type { ReactNode } from 'react';

type Props = { children: ReactNode };
export function SectionEyebrow({ children }: Props) {
  return <p className="section-eyebrow mono">{children}</p>;
}
