import React from "react";
import AuroraBackground from "./components/AuroraBackground";
import Nav from "./components/Nav";
import HeroSection from "./components/HeroSection";
import EmotionShowcase from "./components/EmotionShowcase";
import HowItWorks from "./components/HowItWorks";
import FeatureGrid from "./components/FeatureGrid";
import CtaSection from "./components/CtaSection";
import Footer from "./components/Footer";

export default function App() {
  return (
    <>
      <AuroraBackground />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Nav />
        <main>
          <HeroSection />
          <EmotionShowcase />
          <HowItWorks />
          <FeatureGrid />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </>
  );
}
