// ═══════════════════════════════════════════════════════════════════════════
// src/components/Hero.jsx
// THE JAAGA DESK — Full-screen homepage hero
//
// Renders an array of slides (images or videos) with:
//   • crossfade transitions
//   • subtle Ken Burns zoom on images
//   • autoplaying muted videos with fallback poster
//   • per-slide text overlay (heading, subheading, optional CTA)
//   • indicator dots + keyboard arrows + pause-on-hover
//   • reduced-motion friendly (respects prefers-reduced-motion)
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

const DEFAULT_DURATION_MS = 7000;

export default function Hero({ slides, fallbackHeading, fallbackSubheading }) {
  const safeSlides = useMemo(
    () => (Array.isArray(slides) && slides.length > 0 ? slides : []),
    [slides]
  );

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
    const handler = (e) => { reducedMotion.current = e.matches; };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const next = useCallback(() => {
    setActive((a) => (safeSlides.length ? (a + 1) % safeSlides.length : 0));
  }, [safeSlides.length]);

  const prev = useCallback(() => {
    setActive((a) => (safeSlides.length ? (a - 1 + safeSlides.length) % safeSlides.length : 0));
  }, [safeSlides.length]);

  // Auto-advance (skipped while paused or for single-slide hero)
  useEffect(() => {
    if (paused || safeSlides.length < 2) return;
    const current = safeSlides[active] || {};
    const ms = Number.isFinite(current.durationMs) && current.durationMs > 1500
      ? current.durationMs
      : DEFAULT_DURATION_MS;
    timerRef.current = setTimeout(next, ms);
    return () => clearTimeout(timerRef.current);
  }, [active, paused, next, safeSlides]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Reset when slide deck changes shape
  useEffect(() => { setActive(0); }, [safeSlides.length]);

  if (safeSlides.length === 0) {
    return (
      <section className="jd-hero jd-hero--empty">
        <div className="jd-hero__overlay" />
        <div className="jd-hero__copy">
          <h1 className="jd-hero__heading">{fallbackHeading || "Stories that illuminate"}</h1>
          <p className="jd-hero__sub">{fallbackSubheading || "Add hero slides in the admin dashboard to customise this view."}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="jd-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {safeSlides.map((slide, i) => {
        const isActive = i === active;
        return (
          <div
            key={slide.id || i}
            className={`jd-hero__slide ${isActive ? "is-active" : ""} ${reducedMotion.current ? "no-motion" : ""}`}
            aria-hidden={!isActive}
          >
            {slide.type === "video" && slide.url ? (
              <video
                className="jd-hero__media"
                src={slide.url}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster={slide.poster || undefined}
              />
            ) : (
              <div
                className="jd-hero__media jd-hero__media--image"
                style={{ backgroundImage: `url(${slide.url || ""})` }}
                role="img"
                aria-label={slide.heading || ""}
              />
            )}
          </div>
        );
      })}

      <div className="jd-hero__overlay" />

      {/* Text content for the active slide */}
      <div className="jd-hero__copy">
        {safeSlides.map((slide, i) => (
          <div
            key={`copy-${slide.id || i}`}
            className={`jd-hero__copy-inner ${i === active ? "is-active" : ""}`}
            aria-hidden={i !== active}
          >
            {slide.heading && (
              <h1 className="jd-hero__heading">{slide.heading}</h1>
            )}
            {slide.subheading && (
              <p className="jd-hero__sub">{slide.subheading}</p>
            )}
            {slide.ctaText && slide.ctaHref && (
              <a className="jd-hero__cta" href={slide.ctaHref}>{slide.ctaText}</a>
            )}
          </div>
        ))}
      </div>

      {safeSlides.length > 1 && (
        <>
          <button
            type="button"
            className="jd-hero__arrow jd-hero__arrow--left"
            onClick={prev}
            aria-label="Previous slide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            className="jd-hero__arrow jd-hero__arrow--right"
            onClick={next}
            aria-label="Next slide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          <div className="jd-hero__dots" role="tablist" aria-label="Hero slides">
            {safeSlides.map((s, i) => (
              <button
                key={`dot-${s.id || i}`}
                type="button"
                onClick={() => setActive(i)}
                className={`jd-hero__dot ${i === active ? "is-active" : ""}`}
                aria-label={`Show slide ${i + 1}`}
                aria-selected={i === active}
                role="tab"
              />
            ))}
          </div>
        </>
      )}

      <HeroStyles />
    </section>
  );
}

function HeroStyles() {
  return (
    <style>{`
      .jd-hero {
        position: relative;
        width: 100%;
        height: clamp(420px, 86vh, 880px);
        overflow: hidden;
        background: #0c0b0a;
        isolation: isolate;
      }
      .jd-hero__slide {
        position: absolute; inset: 0;
        opacity: 0;
        transition: opacity 1.2s ease-in-out;
        will-change: opacity;
      }
      .jd-hero__slide.is-active { opacity: 1; }
      .jd-hero__media {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover;
      }
      .jd-hero__media--image {
        background-size: cover;
        background-position: center;
        animation: jd-hero-zoom 12s ease-out forwards;
        transform-origin: center center;
      }
      .jd-hero__slide.no-motion .jd-hero__media--image { animation: none; }
      .jd-hero__slide:not(.is-active) .jd-hero__media--image { animation: none; }

      .jd-hero__overlay {
        position: absolute; inset: 0; z-index: 1;
        background: linear-gradient(
          to bottom,
          rgba(0,0,0,0.25) 0%,
          rgba(0,0,0,0.15) 35%,
          rgba(0,0,0,0.55) 75%,
          rgba(0,0,0,0.75) 100%
        );
        pointer-events: none;
      }

      .jd-hero__copy {
        position: absolute;
        left: 0; right: 0; bottom: clamp(72px, 12vh, 140px);
        z-index: 2;
        padding: 0 clamp(24px, 6vw, 64px);
        display: grid;
        pointer-events: none;
      }
      .jd-hero__copy-inner {
        grid-row: 1; grid-column: 1;
        max-width: 760px;
        color: #fff;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity .8s ease-out, transform .8s ease-out;
        pointer-events: none;
      }
      .jd-hero__copy-inner.is-active {
        opacity: 1;
        transform: translateY(0);
        transition-delay: .25s;
        pointer-events: auto;
      }
      .jd-hero__heading {
        font-family: var(--font-display, "Playfair Display", Georgia, serif);
        font-weight: 800;
        font-size: clamp(2rem, 5.2vw, 4.25rem);
        line-height: 1.05;
        letter-spacing: -0.02em;
        margin-bottom: 16px;
        text-shadow: 0 4px 24px rgba(0,0,0,0.4);
      }
      .jd-hero__sub {
        font-size: clamp(1rem, 1.6vw, 1.25rem);
        line-height: 1.5;
        opacity: .92;
        margin-bottom: 24px;
        max-width: 620px;
        text-shadow: 0 2px 12px rgba(0,0,0,0.4);
      }
      .jd-hero__cta {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 14px 28px;
        border-radius: 999px;
        background: var(--accent, #c45d3e);
        color: #fff;
        font-weight: 600;
        font-size: 15px;
        text-decoration: none;
        transition: transform .2s ease, background .2s ease;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      }
      .jd-hero__cta:hover { transform: translateY(-2px); background: var(--accent-hover, #a84d32); }

      .jd-hero__arrow {
        position: absolute;
        top: 50%; transform: translateY(-50%);
        z-index: 3;
        width: 44px; height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.12);
        backdrop-filter: blur(8px);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.25);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background .2s ease;
      }
      .jd-hero__arrow:hover { background: rgba(255,255,255,0.22); }
      .jd-hero__arrow--left  { left: clamp(16px, 3vw, 32px); }
      .jd-hero__arrow--right { right: clamp(16px, 3vw, 32px); }

      .jd-hero__dots {
        position: absolute;
        left: 0; right: 0; bottom: clamp(24px, 4vh, 40px);
        z-index: 3;
        display: flex; justify-content: center; gap: 8px;
        pointer-events: auto;
      }
      .jd-hero__dot {
        width: 30px; height: 3px;
        border-radius: 2px;
        background: rgba(255,255,255,0.35);
        border: none;
        cursor: pointer;
        transition: background .2s ease, width .2s ease;
      }
      .jd-hero__dot.is-active { background: #fff; width: 44px; }

      .jd-hero--empty .jd-hero__overlay { background: linear-gradient(135deg, #1a1918, #0c0b0a); }

      @keyframes jd-hero-zoom {
        0%   { transform: scale(1.02); }
        100% { transform: scale(1.12); }
      }

      @media (max-width: 720px) {
        .jd-hero { height: clamp(420px, 78vh, 720px); }
        .jd-hero__arrow { display: none; }
        .jd-hero__copy { bottom: clamp(72px, 10vh, 120px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .jd-hero__slide, .jd-hero__copy-inner { transition: none; }
        .jd-hero__media--image { animation: none; }
      }
    `}</style>
  );
}
