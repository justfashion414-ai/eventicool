import './heroes.css';
import { useEffect, useRef, useState } from 'react';
import { DEMO_PHOTOS, DEMO_COUPLE } from './lib/demoMode';

type Img = { '--r'?: string; '--dur'?: string; '--dl'?: string; '--li'?: number; backgroundImage?: string } & React.CSSProperties;

const scrollToJourney = () => {
  const el = document.getElementById('journey');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* Drag-to-spin: horizontal drags rotate, vertical swipes keep scrolling the
   page. Auto-rotates at a slow speed, pauses while dragging and briefly after. */
function useSpin(autoDegPerSec: number) {
  const [angle, setAngle] = useState(0);
  const dragging = useRef(false);
  const axis = useRef<null | 'h' | 'v'>(null);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const resumeAt = useRef(0);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - prev) / 1000);
      prev = t;
      if (!dragging.current && performance.now() > resumeAt.current) setAngle((a) => a + autoDegPerSec * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoDegPerSec]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    axis.current = null;
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    const dy = e.clientY - lastY.current;
    if (axis.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) axis.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    if (axis.current === 'v') return;
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    if (dx !== 0) setAngle((a) => a - dx * 0.28);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    resumeAt.current = performance.now() + 2200;
  };
  return { angle, handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag } };
}

/* HALO ARC: a tall fan of photos arcing up from below the fold. The whole fan
   rotates slowly on its own and can be spun by dragging. Each photo carries
   its event tag. */
export function HaloHero({ images, names, eventNames = [] }: { images: string[]; names?: string; eventNames?: string[] }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  const n = Math.min(imgs.length, 8);
  const { angle, handlers } = useSpin(6.5);
  const cards = imgs.slice(0, n).map((img, i) => ({
    img,
    tag: eventNames.length ? eventNames[i % eventNames.length] : '',
    base: -100 + (200 * i) / Math.max(1, n - 1),
  }));
  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[88vh] sm:h-[86vh] overflow-hidden hv-halo mb-10">
      <div className="hv2-fanstage" {...handlers} style={{ ['--spin' as any]: `${angle}deg` } as Img}>
        <div className="hv2-fan">
          {cards.map((c, i) => (
            <div key={i} className="hv2-card" style={{ ['--a' as any]: `${c.base}deg`, backgroundImage: `url(${c.img})` } as Img}>
              {c.tag ? <span className="hv2-tag">{c.tag}</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="hv2-names">
        <h2>{names || DEMO_COUPLE.header}</h2>
        <p>You are invited to celebrate with us</p>
        <button type="button" className="hv2-cta" onClick={scrollToJourney}>See the journey</button>
      </div>
    </section>
  );
}

/* HERO DECK: a 3D ring of tall portrait cards that turns on its own and can be
   spun by dragging, with the couple's names across the top. */
export function DeckHero({ images, names }: { images: string[]; names?: string }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  const n = Math.max(6, Math.min(imgs.length, 9));
  const { angle, handlers } = useSpin(11);
  const step = 360 / n;
  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[86vh] sm:h-[88vh] overflow-hidden hv-deck mb-10">
      <div className="hv3-names">{names || DEMO_COUPLE.header}</div>
      <div className="hv3-stage" {...handlers} style={{ ['--spin' as any]: `${angle}deg` } as Img}>
        <div className="hv3-ring">
          {imgs.slice(0, n).map((img, i) => (
            <div key={i} className="hv3-card" style={{ ['--a' as any]: `${i * step}deg`, backgroundImage: `url(${img})` } as Img} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* OPEN BOOK: a floating hardback that flips through its pages on its own, each
   page labelled with the event it belongs to. Tap a page or drag to turn it. */
export function BookHero({ images, bride, groom, dotDate, city, hashtag, eventNames = [] }: { images: string[]; bride: string; groom: string; dotDate: string; city: string; hashtag: string; eventNames?: string[] }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  const L = 6;
  const [flipped, setFlipped] = useState(0);
  const [flipping, setFlipping] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const busy = useRef(false);
  const holdUntil = useRef(0);
  const dir = useRef<1 | -1>(1);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const evName = (i: number) => (eventNames.length ? eventNames[i % eventNames.length] : 'Celebration');

  const go = (d: 1 | -1) => {
    if (busy.current) return;
    if (d === 1 && flipped >= L) return;
    if (d === -1 && flipped <= 0) return;
    busy.current = true;
    dir.current = d;
    setFlipping(d === 1 ? flipped : flipped - 1);
    setFlipped((f) => f + d);
    window.setTimeout(() => { busy.current = false; setFlipping(null); }, 1000);
  };

  // Auto turn: pauses on top of every spread, closes the book at the end,
  // reopens, and repeats. Yields for a few seconds after the reader touches it.
  useEffect(() => {
    if (flipping !== null) return;
    const held = performance.now() < holdUntil.current;
    const delay = held ? 900 : dir.current === 1 ? (flipped === 0 ? 2100 : 2500) : (flipped === 0 ? 1300 : 640);
    const t = window.setTimeout(() => {
      if (performance.now() < holdUntil.current) { setTick((x) => x + 1); return; }
      if (dir.current === 1) {
        if (flipped < L) go(1);
        else { dir.current = -1; go(-1); }
      } else {
        if (flipped > 0) go(-1);
        else { dir.current = 1; go(1); }
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [flipped, flipping]);

  const hold = () => { holdUntil.current = performance.now() + 6000; };

  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!down.current) return;
    const dx = e.clientX - down.current.x;
    const dy = e.clientY - down.current.y;
    if (!down.current.moved && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) {
      down.current.moved = true;
      hold();
      go(dx < 0 ? 1 : -1);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (down.current && !down.current.moved) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      hold();
      go(e.clientX > r.left + r.width / 2 ? 1 : -1);
    }
    down.current = null;
  };
  const bookHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => { down.current = null; } };

  const star = (
    <svg viewBox="0 0 24 24" className="hv-star" style={{ width: 'calc(13px * var(--u))', height: 'calc(13px * var(--u))' }}>
      <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8 2 9.2h7.6z" fill="currentColor" stroke="none" />
    </svg>
  );

  const photo = (i: number) => (
    <div className="hv5-page">
      <div className="hv5-pimg" style={{ backgroundImage: `url(${imgs[i % imgs.length]})` }} />
      <div className="hv5-pcap">{evName(i)}</div>
      <div className="hv5-pno">{i + 1}</div>
    </div>
  );

  const cover = (
    <div className="hv5-cover">
      <small>THE WEDDING OF</small>
      <b>{bride}<br />&amp;<br />{groom}</b>
      {star}
      <span>{dotDate}</span>
    </div>
  );
  const invite = (
    <div className="hv5-page ktx">
      <small>Together with their families</small>
      <b>{bride} &amp; {groom}</b>
      <i>request the honour of your presence</i>
      {star}
      <span>Ceremony &amp; Reception</span>
      <span>{dotDate}</span>
    </div>
  );
  const sdt = (
    <div className="hv5-page ktx">
      <small>Save the date</small>
      <b>{dotDate}</b>
      {star}
      <span>10:00 am · {city}</span>
      <span>{hashtag.replace('#', '')}</span>
    </div>
  );
  const back = (
    <div className="hv5-cover kbc">
      {star}
      <span>EVENTICOR</span>
    </div>
  );

  const leaves: Array<[React.ReactNode, React.ReactNode]> = [
    [cover, invite],
    [photo(0), photo(1)],
    [photo(2), photo(3)],
    [photo(4), photo(5)],
    [photo(6), photo(7)],
    [sdt, back],
  ];

  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[78vh] sm:h-[80vh] overflow-hidden hv-book mb-10">
      <p className="hv5-hint">Tap a page or drag to turn</p>
      <div className="hv5-float">
        <div className="hv5-stage" {...bookHandlers} style={{ ['--shift' as any]: `${(((flipped / L) - 0.5) * 100).toFixed(2)}%` } as Img}>
          <i className="hv5-bshadow" />
          {leaves.map((pair, bi) => {
            const isFlipped = bi < flipped;
            const isFlipping = flipping === bi;
            const z = isFlipping ? 400 : isFlipped ? 100 + bi : 100 + (L - bi);
            return (
              <div
                key={bi}
                className={`hv5-leaf${isFlipped ? ' flipped' : ''}`}
                style={{ ['--li' as any]: bi, zIndex: z } as Img}
              >
                <div className="hv5-face"><i className="hv5-sp1" />{pair[0]}</div>
                <div className="hv5-face bf"><i className="hv5-sp2" />{pair[1]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
