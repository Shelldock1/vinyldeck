import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { ProofStrip } from './components/ProofStrip';
import { Shells } from './components/Shells';
import { ProductDeepDive } from './components/ProductDeepDive';
import { Modes } from './components/Modes';
import { NativeStack } from './components/NativeStack';
import { Download } from './components/Download';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <main className="landing-page">
      <Nav />
      <Hero />
      <ProofStrip />
      <Shells />
      <ProductDeepDive />
      <Modes />
      <NativeStack />
      <Download />
      <FAQ />
      <Footer />
    </main>
  );
}
