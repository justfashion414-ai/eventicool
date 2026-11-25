// HeroShowcase: the landing hero plays the real templates (the same looks the
// admin dashboard previews) behind the hero text. The floating-photo card and
// birthday hero components are copied from the couple app so the landing
// bundle stays light; keep visual edits in both places in step.
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useAnimationFrame, useMotionValue } from 'motion/react'
import { HaloHero, DeckHero, BookHero } from '../couple/heroes'

const heroPreloadedUrls = new Set<string>();

const HERO_FALLBACK_PHOTOS = ['/demo/photo1.jpg','/demo/photo2.jpg','/demo/photo3.jpg','/demo/photo4.jpg','/demo/photo5.jpg','/demo/photo6.jpg','/demo/photo7.jpg']

interface FloatingPhotoCardProps {
  images: string[];
  imgOffset: number;
  slot: number;
  column: number;
  constraintsRef: React.RefObject<HTMLDivElement | null>;
  eventNames?: string[];
}

// Hero runs as a 2x2 grid: two cards in the upper half, two in the lower half, at all times.
// Each column is a conveyor of four slots spaced half a screen apart; as the top card of a
// column clears the top it wraps to the bottom, so the grid never empties.
// Cards are purely decorative: no drag and no tap handlers, so touching one can never move,
// hide or dislodge it, and the page always scrolls normally over the hero.
const HERO_TRAVERSE_SECONDS = 11; // Time for one card to travel one screen height

export const FloatingPhotoCard: React.FC<FloatingPhotoCardProps> = ({ images, imgOffset, slot, column, constraintsRef, eventNames }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(1000);
  const initialized = useRef(false);
  const baseH = useRef(0);
  const pxPerSecond = useRef(0);
  const [imgIdx, setImgIdx] = useState(slot + imgOffset);
  const [shownImage, setShownImage] = useState<string>('');
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  useAnimationFrame((_, delta) => {
    if (!constraintsRef.current || !cardRef.current) return;
    const containerHeight = constraintsRef.current.offsetHeight;
    if (containerHeight === 0) return;
    const cardHeight = cardRef.current.offsetHeight || 220;

    // Lane geometry is frozen from the first measured height. Live re-measuring
    // (mobile URL bars resizing, tab switches, reflow) used to shift the lanes
    // mid-flight and let cards pile onto each other; a frozen base keeps the
    // formation exact no matter how far the page is scrolled.
    if (!initialized.current) {
      baseH.current = containerHeight;
      pxPerSecond.current = (containerHeight + cardHeight) / HERO_TRAVERSE_SECONDS;
      y.set(baseH.current * 0.12 + slot * (baseH.current / 2));
      initialized.current = true;
    }

    const halfStep = baseH.current / 2;
    const cycleLength = halfStep * 4;
    const dt = Math.min(delta, 100) / 1000;
    const speedMultiplier = prefersReducedMotion ? 0.05 : 1.0;
    let nextY = y.get() - (pxPerSecond.current * dt * speedMultiplier);

    if (nextY < -(cardHeight + 60)) {
      nextY += cycleLength;
      x.set(0);
      setImgIdx((prev) => (prev + 4) % Math.max(1, images.length));
    }

    y.set(nextY);
  });

  const currentImage = images.length > 0 ? images[imgIdx % images.length] : HERO_FALLBACK_PHOTOS[imgIdx % HERO_FALLBACK_PHOTOS.length];
  const caption = eventNames && eventNames.length > 0 ? eventNames[(imgIdx + imgOffset) % eventNames.length] : undefined;

  return (
    <motion.div
      ref={cardRef}
      initial={{ rotate: column === 0 ? (slot % 2 === 0 ? -4 : 3) : (slot % 2 === 0 ? 3 : -4) }}
      style={{
        left: column === 0 ? '6%' : '54%',
        width: 'clamp(140px, 46%, 280px)',
        position: 'absolute',
        x,
        y,
        zIndex: 10
      }}
    >
      <div className="bg-white p-2 pb-2 shadow-2xl shadow-black/20 rounded-sm">
        <div className="relative w-full h-[calc(32.5vh-80px)] sm:h-[calc(40vh-80px)] overflow-hidden pointer-events-none">
          {shownImage && shownImage !== currentImage && (
            <img src={shownImage} className="absolute inset-0 w-full h-full object-cover object-center" alt="" draggable={false} />
          )}
          <img
            src={currentImage}
            onLoad={() => setShownImage(currentImage)}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${shownImage === currentImage ? 'opacity-100' : 'opacity-0'}`}
            alt=""
            draggable={false}
          />
        </div>
        {caption && (
          <p className="text-center text-[0.78rem] font-bold font-display text-[#14262D] pt-2 pb-1 leading-tight">{caption}</p>
        )}
      </div>
    </motion.div>
  );
}

export function BirthdayHero({ variant, isDarkMode, images, names, celebrant, age, ageHidden, date, city, hashtag, eventNames, compact = false }: { variant: 'party' | 'gold', isDarkMode?: boolean, images?: string[], names?: string, celebrant?: string, age?: string, ageHidden?: boolean, date?: string, city?: string, hashtag?: string, eventNames?: string[], compact?: boolean }) {
  const who = (celebrant || names || 'Guest of honour').trim();
  const bigAge = !ageHidden && age ? age : '';
  const kicker = bigAge ? `${who} turns ${bigAge}` : `It's ${who}'s day`;
  const line = [date, city].filter(Boolean).join(' \u00b7 ');
  const lineup = (eventNames || []).slice(0, 5).join(' \u00b7 ');
  const picks = (images || []).slice(0, 3);
  if (variant === 'gold') {
    return (
      <div className="relative w-full overflow-hidden" style={{ minHeight: compact ? '420px' : '78vh', background: 'radial-gradient(120% 100% at 50% 0%, #3d2c12 0%, #191007 55%, #0c0805 100%)' }}>
        <div className="absolute inset-0 opacity-[0.13]" style={{ background: 'radial-gradient(circle at 18% 22%, #E7C86A 0, transparent 3px), radial-gradient(circle at 82% 14%, #E7C86A 0, transparent 2.5px), radial-gradient(circle at 64% 78%, #E7C86A 0, transparent 2px), radial-gradient(circle at 30% 84%, #E7C86A 0, transparent 2.5px)', backgroundSize: '220px 220px' }} />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-14">
          <p className="m-0 text-[0.72rem] font-black uppercase tracking-[0.3em] text-[#E7C86A]/80">{kicker}</p>
          {picks[0] && <div className="mt-6 w-44 h-44 sm:w-56 sm:h-56 rounded-full p-[3px]" style={{ border: '3px solid #C9A227', boxShadow: '0 0 0 7px rgba(201,162,39,0.18), 0 30px 60px rgba(0,0,0,0.5)' }}><img src={picks[0]} alt={who} className="w-full h-full object-cover rounded-full" /></div>}
          <h2 className="text-center font-serif-display m-0 mt-7 text-[#F5E7C8] text-[clamp(2.6rem,12vw,3.6rem)] leading-[1]">{who}</h2>
          {bigAge && <div className="text-center font-serif-display text-[clamp(3rem,15vw,4.6rem)] leading-[0.95] mt-1" style={{ color: '#E7C86A' }}>{bigAge}</div>}
          {line && <p className="m-0 mt-4 text-[0.9rem] tracking-wide text-[#E7C86A]/70">{line}</p>}
          {hashtag && <span className="mt-4 px-4 py-1.5 rounded-full text-[0.8rem] font-bold text-[#E7C86A]" style={{ border: '1px solid rgba(231,200,106,0.45)' }}>{hashtag}</span>}
          {lineup && <p className="m-0 mt-5 text-[0.78rem] text-[#F5E7C8]/55 max-w-[32ch] mx-auto leading-relaxed">{lineup}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: compact ? '420px' : '78vh', background: 'radial-gradient(130% 110% at 50% 0%, #ff9ec2 0%, #e5399e 40%, #7a1440 100%)' }}>
      {['#ffd166', '#7dd3fc', '#c084fc', '#fb7185', '#a3e635', '#f9a8d4'].map((c, i) => (
        <span key={i} aria-hidden className="absolute rounded-full" style={{ width: 34 + (i % 3) * 16, height: 42 + (i % 3) * 20, left: `${6 + i * 15}%`, top: `${12 + (i % 4) * 18}%`, background: c, opacity: 0.85, animation: `bdFloat ${7 + (i % 3) * 2}s ease-in-out ${i * 0.7}s infinite` }} />
      ))}
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={`c${i}`} aria-hidden className="absolute w-2 h-2 rounded-[2px]" style={{ left: `${(i * 53) % 100}%`, top: '-10px', background: ['#ffd166', '#7dd3fc', '#c084fc', '#fb7185', '#a3e635', '#f9a8d4'][i % 6], animation: `bdFall ${5 + (i % 4)}s linear ${(i % 6) * 0.8}s infinite` }} />
      ))}
      <style>{`@keyframes bdFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-18px) rotate(4deg)}}@keyframes bdFall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(92vh) rotate(340deg)}}`}</style>
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-14">
        <span className="px-3 py-1 rounded-full bg-white/25 backdrop-blur text-white text-[0.68rem] font-black uppercase tracking-[0.28em]">Birthday</span>
        <p className="m-0 mt-4 text-white text-[1rem] font-semibold">{kicker}</p>
        <h2 className="text-center font-serif-display text-white text-[clamp(2.7rem,13vw,3.8rem)] leading-[1] mt-2 mb-0">{who}</h2>
        {bigAge && <div className="font-black text-white/95 text-[clamp(5rem,26vw,8rem)] leading-[0.85] mt-1 drop-shadow-[0_6px_24px_rgba(0,0,0,0.25)]">{bigAge}</div>}
        {line && <p className="m-0 mt-3 text-white/90 text-[0.9rem] tracking-wide">{line}</p>}
        {hashtag && <span className="mt-4 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur text-white text-[0.8rem] font-bold">{hashtag}</span>}
        {picks.length > 0 && (
          <div className="mt-7 flex items-center gap-2">
            {picks.map((src, i) => (
              <img key={i} src={src} alt={`${who} ${i + 1}`} className={`w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl shadow-lg bg-white/30 ${i === 1 ? 'rotate-2' : '-rotate-2'}`} />
            ))}
          </div>
        )}
        {lineup && <p className="m-0 mt-5 text-white/80 text-[0.78rem] max-w-[32ch] mx-auto leading-relaxed">{lineup}</p>}
      </div>
    </div>
  );
}

export function FloatingHeroSection({ isDarkMode, images, eventNames, compact = false }: { isDarkMode: boolean, images: string[], eventNames?: string[], compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardsReady, setCardsReady] = useState(false);

  const baseImages = images.length > 0 ? images : HERO_FALLBACK_PHOTOS;
  const baseKey = baseImages.join('|');

  // Keep every hero image warm in the browser cache, and only mount the cards
  // once the first batch has loaded, so pictures never pop in or out.
  useEffect(() => {
    let cancelled = false;
    const missing = baseImages.filter((src: string) => !heroPreloadedUrls.has(src));
    if (missing.length === 0) {
      setCardsReady(true);
      return;
    }
    let doneCount = 0;
    missing.forEach((src: string) => {
      const img = new Image();
      const done = () => {
        heroPreloadedUrls.add(src);
        doneCount += 1;
        if (!cancelled && doneCount >= missing.length) setCardsReady(true);
      };
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });
    const fallback = setTimeout(() => { if (!cancelled) setCardsReady(true); }, 2000);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [baseKey]);

  return (
    <section
      ref={containerRef}
      className={`relative overflow-hidden bg-[var(--ann-accent)] shadow-inner ${compact ? 'w-full h-[238px]' : 'w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[65vh] sm:h-[80vh] mb-12'}`}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent)]" />
      </div>

      <div className="absolute inset-0 overflow-hidden">
        {!cardsReady && (
          <div className="absolute inset-0 grid grid-cols-2 gap-[6%] px-[9%] py-[7%] pointer-events-none ev-hero-skel" aria-hidden="true">
            {[0, 1].map((c) => (
              <div key={c} className={`flex flex-col gap-[7%] ${c === 0 ? 'items-start -rotate-6 translate-y-3' : 'items-end rotate-6'}`}>
                {[0, 1, 2].map((r) => (
                  <div key={r} className={`ev-hero-skel-card w-[64%] ${r === 1 ? 'self-stretch' : ''} ${r === 2 ? 'w-[52%]' : ''}`} style={{ height: r === 1 ? '34%' : '30%' }} />
                ))}
              </div>
            ))}
          </div>
        )}
        {cardsReady && [0, 1].map((column) =>
          [0, 1, 2, 3].map((slot) => (
            <FloatingPhotoCard
              key={`hero-${column}-${slot}`}
              images={baseImages}
              imgOffset={column * 2}
              eventNames={eventNames}
              slot={slot}
              column={column}
              constraintsRef={containerRef}
            />
          ))
        )}
      </div>
    </section>
  );
}

// Stage colours: each template's hero background so the stage fills the hero
// even where the template's own section ends, plus its accent CSS var (the
// floating cards and inner accents read --ann-accent).
const TPL_HERO_BG: Record<string, string> = { classic: '#0a0917', halo: '#8f1c42', hero: '#07301f', book: '#151f63', 'bd-party': '#8f1650', 'bd-gold': '#241035' }
const TPL_ACC: Record<string, string> = { classic: '#14122b', halo: '#d6285f', hero: '#0c4a36', book: '#2236b4', 'bd-party': '#e5399e', 'bd-gold': '#F5B82E' }

const WED_PHOTOS = HERO_FALLBACK_PHOTOS
const BD_PHOTOS = ['/demo/birthday1.jpg','/demo/birthday2.jpg','/demo/birthday3.jpg','/demo/birthday4.jpg']
const WED_EVENTS = ['Engagement','Bridal shower','Ceremony','Reception']
const BD_EVENTS = ['Arrival & red carpet','Games & dancing','Cake cutting','Toast & tributes']

function tplNode(t: string) {
  switch (t) {
    case 'classic': return <FloatingHeroSection isDarkMode={false} images={WED_PHOTOS} eventNames={WED_EVENTS} />
    case 'halo': return <HaloHero images={WED_PHOTOS} names="Amara & Daniel" eventNames={WED_EVENTS} />
    case 'hero': return <DeckHero images={WED_PHOTOS} names="Amara & Daniel" eventNames={WED_EVENTS} />
    case 'book': return <BookHero images={WED_PHOTOS} bride="Amara" groom="Daniel" dotDate="12 . 06 . 2027" city="Lagos" hashtag="#AmaraAndDaniel" eventNames={WED_EVENTS} />
    case 'bd-party': return <BirthdayHero variant="party" isDarkMode={false} images={BD_PHOTOS} names="Chidera" celebrant="Chidera" age="50" date="Sat 12 Jun 2027" city="Lagos" hashtag="#ChideraAt50" eventNames={BD_EVENTS} />
    case 'bd-gold': return <BirthdayHero variant="gold" isDarkMode={false} images={BD_PHOTOS} names="Chidera" celebrant="Chidera" age="50" date="Sat 12 Jun 2027" city="Lagos" hashtag="#ChideraAt50" eventNames={BD_EVENTS} />
    default: return null
  }
}

// Plays the active celebration's enabled templates full-bleed behind the hero
// text, crossfading one to the next every five seconds. All stages stay
// mounted so each template's animation is always live, exactly like the
// admin's own preview.
export function HeroShowcase({ tpls }: { tpls: string[] }) {
  const [i, setI] = useState(0)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const key = tpls.join('|')
  useEffect(() => { setHost(document.getElementById('heroBg')) }, [])
  useEffect(() => {
    setI(0)
    if (tpls.length < 2) return
    const t = window.setInterval(() => setI((v) => (v + 1) % tpls.length), 5000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    const r = document.getElementById('ev-l')
    if (r) r.classList.toggle('ev-heroimg', tpls.length > 0)
    return () => { try { r?.classList.remove('ev-heroimg') } catch { /* ignore */ } }
  }, [tpls.length])
  if (!host || tpls.length === 0) return null
  return createPortal(
    <>
      {tpls.map((t, k) => (
        <div
          key={t}
          className="hs-stage"
          style={{ background: TPL_HERO_BG[t] || '#151f63', opacity: k === i % tpls.length ? 1 : 0, '--ann-accent': TPL_ACC[t] || '#151F63' } as React.CSSProperties}
        >
          {tplNode(t)}
        </div>
      ))}
    </>,
    host,
  )
}
