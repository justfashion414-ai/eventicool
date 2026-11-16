import './heroes.css';
import { DEMO_PHOTOS } from './lib/demoMode';

type Img = { '--r'?: string; '--dur'?: string; '--dl'?: string; '--li'?: number; backgroundImage?: string } & React.CSSProperties;

/* HALO ARC: the same photos, fanned out in a rising arc that sways gently. */
export function HaloHero({ images }: { images: string[] }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  const n = Math.min(imgs.length, 7);
  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[65vh] sm:h-[80vh] overflow-hidden hv-halo mb-12 shadow-inner">
      <div className="hv-fan">
        {imgs.slice(0, n).map((img, i) => (
          <i
            key={i}
            style={{ ['--r' as any]: (-57 + (i * 114) / Math.max(1, n - 1)) + 'deg', backgroundImage: `url(${img})` } as Img}
          />
        ))}
      </div>
      <p className="hv-halo-sub">You are invited to celebrate with us</p>
    </section>
  );
}

/* HERO DECK: the same photos, stacked like cards that cycle to the front. */
export function DeckHero({ images, dateShort, city }: { images: string[]; dateShort: string; city: string }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  const nc = Math.max(4, Math.min(imgs.length, 5));
  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[65vh] sm:h-[80vh] overflow-hidden hv-deck mb-12 shadow-inner">
      <div className="hv-deck-stage">
        <div className="hv-dmeta">
          <span>The event</span>
          <b>{dateShort.toUpperCase()}</b>
          <span>{city.toUpperCase()}</span>
        </div>
        <div className="hv-stack">
          {imgs.slice(0, nc).map((img, i) => (
            <div
              key={i}
              className="hv-cfc"
              style={{ ['--dl' as any]: (-i * 3) + 's', ['--dur' as any]: nc * 3 + 's', backgroundImage: `url(${img})` } as Img}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* OPEN BOOK: the same photos, laid out as pages of a flipping hardback. */
export function BookHero({ images, bride, groom, dotDate, city, hashtag }: { images: string[]; bride: string; groom: string; dotDate: string; city: string; hashtag: string }) {
  const imgs = images.length ? images : DEMO_PHOTOS;
  const star = (
    <svg viewBox="0 0 24 24" className="hv-star" style={{ width: 'calc(14px * var(--u))', height: 'calc(14px * var(--u))' }}>
      <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8 2 9.2h7.6z" fill="currentColor" stroke="none" />
    </svg>
  );
  const pgi = (i: number, n: number) => (
    <div className="hv-page">
      <div className="hv-pimg" style={{ backgroundImage: `url(${imgs[i % imgs.length]})` }} />
      <div className="hv-pcap">{['Together', 'Our traditions', 'The shoot', 'Golden hour', 'Save the date', 'Forever'][i % 6]}</div>
      <div className="hv-pno">{n}</div>
    </div>
  );
  const cover = (
    <div className="hv-cover">
      <small>THE CELEBRATION OF</small>
      <b>{bride}<br />&amp;<br />{groom}</b>
      {star}
      <span>{dotDate}</span>
    </div>
  );
  const txp = (
    <div className="hv-page ktx">
      <small>Together with their families</small>
      <b>{bride} &amp; {groom}</b>
      <i>request the honour of your presence</i>
      {star}
      <span>Ceremony &amp; Reception</span>
      <span>{dotDate}</span>
    </div>
  );
  const fin = (
    <div className="hv-page ktx">
      <small>Save the date</small>
      <b>{dotDate}</b>
      {star}
      <span>10:00 am · {city}</span>
      <span>{hashtag.replace('#', '')}</span>
    </div>
  );
  const back = (
    <div className="hv-cover kbc">
      {star}
      <span>EVENTICOR</span>
    </div>
  );
  const leaves = [
    [cover, txp],
    [pgi(0, 1), pgi(1, 2)],
    [pgi(2, 3), pgi(3, 4)],
    [pgi(4, 5), pgi(5, 6)],
    [fin, back],
  ];
  return (
    <section className="hv-wrap relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[65vh] sm:h-[80vh] overflow-hidden hv-book mb-12 shadow-inner">
      <div className="hv-book-stage">
        <i className="hv-bshadow" style={{ width: 'calc(376px * var(--u))', height: 'calc(26px * var(--u))', left: 'calc(-188px * var(--u))', top: 'calc(136px * var(--u))' }} />
        {leaves.map((pair, bi) => (
          <div
            key={bi}
            className="hv-leaf"
            style={{ ['--li' as any]: bi, width: 'calc(188px * var(--u))', height: 'calc(264px * var(--u))', top: 'calc(-132px * var(--u))', animationDelay: -bi * 3 + 's' } as Img}
          >
            <div className="hv-face">{pair[0]}<i className="hv-sp1" /><i className="hv-shade" /></div>
            <div className="hv-face bf">{pair[1]}<i className="hv-sp2" /><i className="hv-shade" style={{ transform: 'scaleX(-1)' }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
