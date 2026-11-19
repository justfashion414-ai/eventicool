import './heroes.css';
import { useEffect, useRef, useState } from 'react';
import { DEMO_PHOTOS, DEMO_COUPLE } from './lib/demoMode';

type Img = { '--r'?: string; '--dur'?: string; '--dl'?: string; '--li'?: number; backgroundImage?: string } & React.CSSProperties;

const scrollToJourney = () => {
  const el = document.getElementById('journey');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* Drag-to-spin for the deck: the ring follows the finger, horizontal drags
   rotate it, vertical swipes keep scrolling the page. Auto-rotates slowly,
   pauses while dragging and glides back to speed after. */
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
    if (dx !== 0) setAngle((a) => a + dx * 0.28);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    resumeAt.current = performance.now() + 2200;
  };
  return { angle, handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag } };
}

/* HALO ARC: photos flow along a fixed arch from the left edge to the right
   edge; when one leaves on the right the next enters on the left, so any
   number of photos keeps cycling. Dragging scrubs the flow in the finger's
   direction, then it drifts back to its own slow pace. Each photo carries its
   event tag. */
export function HaloHero({ images, names, eventNames = [] }: { images: string[]; names?: string; eventNames?: string[] }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  // Enough cards to blanket the viewport width at fan spacing; photos repeat
  // as the conveyor cycles, so the count is not limited by the album size.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const N = Math.max(7, Math.min(20, Math.round((vw + 160) / 58)));
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const prevRaw = useRef<number[]>(Array(N).fill(-1));
  const nextPhoto = useRef(N);
  const flow = useRef(0);
  const vel = useRef(34);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastDX = useRef(0);
  const [slotPhoto, setSlotPhoto] = useState<number[]>(() => Array.from({ length: N }, (_, i) => i % imgs.length));

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const BASE = 21;
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - prev) / 1000);
      prev = t;
      const el = stageRef.current;
      if (el) {
        const W = el.clientWidth;
        const H = el.clientHeight;
        const cw = Math.max(88, Math.min(W * 0.34, 150));
        const ch = cw * 1.55;
        // Cards cluster tightly, overlapping like a fanned hand of photos,
        // and the conveyor spans past both edges of the screen.
        const span = W + 1.6 * cw;
        const s = span / N;
        if (!dragging.current) {
          vel.current += (BASE - vel.current) * Math.min(1, dt * 1.6);
          flow.current += vel.current * dt;
        }
        const mid = W / 2;
        const amp = H * 0.16;
        const sigma = W * 0.3;
        // Part the cards around the middle: extra breathing room near the
        // centre so a photo crossing it shows FULLY (never half-covered by a
        // neighbour first and half-covered again after), while the edges keep
        // the tight fanned-hand look.
        const spreadSig = cw * 0.8;
        const spreadK = spreadSig * Math.max(0, (cw + 6) / s - 1);
        for (let i = 0; i < N; i++) {
          const raw = ((flow.current + i * s) % span + span) % span;
          const u = raw - 1.2 * cw;
          const x = mid + (u - mid) + spreadK * Math.tanh((u - mid) / spreadSig);
          if (prevRaw.current[i] >= 0) {
            if (raw < prevRaw.current[i] - span / 2 || raw > prevRaw.current[i] + span / 2) {
              const p = nextPhoto.current++ % imgs.length;
              setSlotPhoto((arr) => { const c = arr.slice(); c[i] = p; return c; });
            }
          }
          prevRaw.current[i] = raw;
          const node = cardRefs.current[i];
          if (node) {
            const d = Math.exp(-0.5 * ((x - mid) / sigma) ** 2);
            // Entrance/exit: a card rises in from the lower left and sinks away
            // to the lower right, dipping below the arc, tilting further and
            // fading as it goes, like cards falling off the edge of the fan.
            const edge = Math.max(0, Math.min(1, (Math.abs(x - mid) - W * 0.16) / (W * 0.46)));
            const e2 = edge * edge;
            const y = H * 0.44 - amp * d + H * 0.36 * e2;
            const rot = Math.max(-16, Math.min(16, ((x - mid) / W) * 30)) + 34 * e2;
            const sc = (0.9 + 0.14 * d) * (1 - 0.24 * e2);
            node.style.width = `${cw}px`;
            node.style.height = `${ch}px`;
            node.style.transform = `translate3d(${(x - cw / 2).toFixed(1)}px, ${(y - ch / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
            // No visible fade: a card stays fully opaque while any part of it
            // is on screen; it exits by dipping below the arch and sliding off
            // the edge, so the hand never dissolves in view.
            node.style.zIndex = String(Math.round(200 - Math.abs(x - mid)));
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [N, imgs.length]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    lastDX.current = 0;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    lastDX.current = dx;
    flow.current += dx;
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    vel.current = Math.max(-520, Math.min(520, lastDX.current * 30));
  };

  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[88vh] sm:h-[86vh] overflow-hidden hv-halo mb-10">
      <div className="hv2-stage" ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {Array.from({ length: N }, (_, i) => (
          <div key={i} ref={(n) => { cardRefs.current[i] = n; }} className="hv2-card">
            <i className="hv2-img" style={{ backgroundImage: `url(${imgs[slotPhoto[i] % imgs.length]})` }} />
            {eventNames.length ? <span className="hv2-tag">{eventNames[slotPhoto[i] % eventNames.length]}</span> : null}
          </div>
        ))}
      </div>
      <div className="hv2-names">
        <h2>{names || DEMO_COUPLE.header}</h2>
        <p>You are invited to celebrate with us</p>
        <button type="button" className="hv2-cta" onClick={scrollToJourney}>See the journey</button>
      </div>
    </section>
  );
}

/* HERO DECK: a 3D ring of tall portrait cards, each tagged with its event,
   that turns on its own and follows the finger when dragged. */
export function DeckHero({ images, names, eventNames = [] }: { images: string[]; names?: string; eventNames?: string[] }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  // Cards sit evenly around the ring, so n must equal the number of images
  // shown: padding it up to 6 leaves an empty sector between the last image
  // and the first, which is the gap the couple sees after the scroll.
  const n = Math.max(1, Math.min(imgs.length, 9));
  const { angle, handlers } = useSpin(11);
  const step = 360 / n;
  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[86vh] sm:h-[88vh] overflow-hidden hv-deck mb-10">
      <div className="hv3-names">{names || DEMO_COUPLE.header}</div>
      <div className="hv3-stage" {...handlers} style={{ ['--spin' as any]: `${angle}deg` } as Img}>
        <div className="hv3-ring">
          {imgs.slice(0, n).map((img, i) => (
            <div key={i} className="hv3-card" style={{ ['--a' as any]: `${i * step}deg`, backgroundImage: `url(${img})` } as Img}>
              {eventNames.length ? <span className="hv2-tag hv3-tag">{eventNames[i % eventNames.length]}</span> : null}
            </div>
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
      <div className="hv5-float">
        <div className="hv5-stage" {...bookHandlers} style={{ ['--shift' as any]: `${flipped === 0 ? -25 : flipped === L ? 25 : 0}%` } as Img}>
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
