import { useEffect, useMemo, useRef, useState } from 'react'
import './template.css'
import { demoData, DEMO_PHOTOS, type DemoData } from './demo'

export type Tpl = 'classic' | 'halo' | 'hero' | 'book'
type View = 'home' | 'feed' | 'set'

const HOUSE_ICONS = {
  home: (
    <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.4" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" /></svg>
  ),
  like: <svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c2 0 3 1 3 3l-1 4h6a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 1.5H7" /></svg>,
  comment: <svg viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4z" /></svg>,
  share: <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" /></svg>,
}

interface Post { id: string; by: string; cap: string; img?: string; video?: boolean; ago: string; likes: number; mine?: boolean }

function initial(name: string) { return (name || 'G').charAt(0).toUpperCase() }

function daysAgoLabel(d: Date) {
  const diff = Math.round((Date.now() - d.getTime()) / 864e5)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return diff + ' days ago'
  if (diff < 14) return '1 week ago'
  return Math.round(diff / 7) + ' weeks ago'
}

function seedPosts(D: DemoData): Post[] {
  const base: Post[] = DEMO_PHOTOS.map((img, i) => ({
    id: 's' + i,
    by: D.guests[i % D.guests.length],
    cap: D.captions[i % D.captions.length],
    img,
    ago: D.ago[i % D.ago.length],
    likes: D.likes[i % D.likes.length],
  }))
  const dates = base.map((p, i) => ({ ...p, _t: Date.now() - (i * 36 + 5) * 36e5 }))
  return dates.sort((a, b) => (b as any)._t - (a as any)._t)
}

/* ---------------- HOME: CLASSIC ---------------- */
function ClassicHome({ D, goFeed, goJourney }: { D: DemoData; goFeed: () => void; goJourney: () => void }) {
  const namesLen = Math.max(D.bride.length, D.groom.length, 4)
  const fs = Math.min(52, Math.floor(430 / (namesLen * 0.6)))
  const dateObj = new Date(D.dateISO + 'T12:00:00')
  return (
    <>
      <div className="tap-mp">
        {DEMO_PHOTOS.slice(0, 6).map((img, i) => (
          <div
            key={i}
            className="tap-tile anim"
            style={{ left: i % 2 ? '56%' : '8%', ['--r' as any]: (i % 2 ? 5 : -6) + 'deg', animationDelay: -i * 2.3 + 's', backgroundImage: `url(${img})` }}
          />
        ))}
      </div>
      <div className="tap-mn">
        <small>Together with their families</small>
        <b style={{ ['--fs' as any]: fs + 'px' }}>{D.bride}</b>
        <em>and</em>
        <b style={{ ['--fs' as any]: fs + 'px' }}>{D.groom}</b>
      </div>
      <div className="tap-cd">
        <div><b>{D.days}</b><span>days to go</span></div>
        <div><b>{D.dateShort}</b><span>{D.dateISO.slice(0, 4)}</span></div>
        <div><b>{D.city}</b><span>city</span></div>
      </div>
      <Journey D={D} ref={goJourney as any} />
      <WeddingDay D={D} />
      <button className="tap-cta" onClick={goFeed}>Open the feed</button>
      <footer style={{ textAlign: 'center', paddingBottom: 26 }}>
        <div style={{ font: 'italic 600 17px var(--serif)', color: 'var(--a)' }}>{D.bride} &amp; {D.groom}</div>
        <div style={{ fontSize: 12, opacity: .7 }}>{dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div style={{ fontSize: 11.5, opacity: .6, marginTop: 3 }}>Wedding memories, kept for life</div>
      </footer>
    </>
  )
}

/* ---------------- HOME: HALO ARC ---------------- */
function HaloHome({ D, goFeed, goJourney }: { D: DemoData; goFeed: () => void; goJourney: () => void }) {
  return (
    <>
      <div className="tap-arwrap">
        <div className="tap-arfan">
          {DEMO_PHOTOS.slice(0, 7).map((img, i) => (
            <i key={i} style={{ ['--r' as any]: -60 + i * 20 + 'deg', backgroundImage: `url(${img})` }} />
          ))}
        </div>
      </div>
      <div className="tap-artt">{D.bride} &amp; {D.groom}</div>
      <div className="tap-arts">You are invited to celebrate with us</div>
      <button className="tap-artb" style={{ background: 'var(--a)', color: 'var(--b)' }} onClick={goJourney}>See the journey</button>
      <div className="tap-cd" style={{ width: '100%' }}>
        <div><b>{D.days}</b><span>days to go</span></div>
        <div><b>{D.dateShort}</b><span>{D.dateISO.slice(0, 4)}</span></div>
        <div><b>{D.city}</b><span>city</span></div>
      </div>
      <Journey D={D} />
      <WeddingDay D={D} />
      <button className="tap-cta" onClick={goFeed}>Open the feed</button>
    </>
  )
}

/* ---------------- HOME: HERO DECK ---------------- */
function HeroHome({ D, goFeed, goJourney }: { D: DemoData; goFeed: () => void; goJourney: () => void }) {
  const NC = Math.max(4, Math.min(DEMO_PHOTOS.length, 5))
  const [heroN, setHeroN] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setHeroN((n) => (n % NC) + 1), 2400)
    return () => clearInterval(t)
  }, [NC])
  return (
    <>
      <div className="tap-cfbar">
        <span style={{ color: 'var(--a)' }}>{D.bride} &amp; {D.groom}</span>
        <span style={{ opacity: .9 }}>Hero {heroN} of {NC}</span>
      </div>
      <div className="tap-cfmeta"><span>THE EVENT</span><span>{D.dateShort.toUpperCase()} {D.dateISO.slice(0, 4)}</span><span>{D.city.toUpperCase()}</span></div>
      <div className="tap-cftt">{D.bride} &amp; {D.groom}</div>
      <div className="tap-cfdeck">
        {DEMO_PHOTOS.slice(0, NC).map((img, i) => (
          <div key={i} className="tap-cfc" style={{ animationDelay: -i * 2.4 + 's', animationDuration: NC * 2.4 + 's', backgroundImage: `url(${img})` }} />
        ))}
      </div>
      <Journey D={D} />
      <WeddingDay D={D} />
      <button className="tap-cta" onClick={goFeed}>Open the feed</button>
    </>
  )
}

/* ---------------- HOME: OPEN BOOK ---------------- */
function BookHome({ D, goFeed, goJourney }: { D: DemoData; goFeed: () => void; goJourney: () => void }) {
  const spread = (
    <svg viewBox="0 0 24 24" className="tap-kor" style={{ width: 'calc(14px * var(--u))', height: 'calc(14px * var(--u))' }}><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8 2 9.2h7.6z" fill="currentColor" stroke="none" /></svg>
  )
  const pgi = (i: number, n: number) => (
    <div className="tap-kpg">
      <div className="tap-kbp" style={{ backgroundImage: `url(${DEMO_PHOTOS[i % DEMO_PHOTOS.length]})` }} />
      <div className="tap-kcp">{D.bookCaps[i % D.bookCaps.length]}</div>
      <div className="tap-kpn">{n}</div>
    </div>
  )
  const cover = (
    <div className="tap-kcv">
      <small>THE CELEBRATION OF</small>
      <b>{D.bride}<br />&amp;<br />{D.groom}</b>
      <div className="tap-kor">{spread}</div>
      <span>{D.dotDate}</span>
    </div>
  )
  const txp = (
    <div className="tap-kpg ktx">
      <small>Together with their families</small>
      <b>{D.bride} &amp; {D.groom}</b>
      <i>request the honour of your presence</i>
      <div className="tap-kor">{spread}</div>
      <span>Ceremony &amp; Reception</span>
      <span>{D.dotDate}</span>
    </div>
  )
  const fin = (
    <div className="tap-kpg ktx">
      <small>Save the date</small>
      <b>{D.dotDate}</b>
      <div className="tap-kor">{spread}</div>
      <span>10:00 am · {D.city}</span>
      <span>{D.hashtag.replace('#', '')}</span>
    </div>
  )
  const back = (
    <div className="tap-kcv kbc">
      <div className="tap-kor">{spread}</div>
      <span>EVENTICOR</span>
    </div>
  )
  const leaves = [
    [cover, txp],
    [pgi(0, 1), pgi(1, 2)],
    [pgi(2, 3), pgi(3, 4)],
    [pgi(4, 5), pgi(5, 6)],
    [fin, back],
  ]
  return (
    <>
      <div className="tap-kbw">
        <div className="tap-kbo">
          <i className="tap-kbs" style={{ width: 'calc(376px * var(--u))', height: 'calc(26px * var(--u))', left: 'calc(-188px * var(--u))', top: 'calc(136px * var(--u))' }} />
          {leaves.map((pair, bi) => (
            <div
              key={bi}
              className="tap-klf"
              style={{
                ['--li' as any]: bi,
                width: 'calc(188px * var(--u))',
                height: 'calc(264px * var(--u))',
                top: 'calc(-132px * var(--u))',
                animationDelay: -bi * 3 + 's',
              }}
            >
              <div className="tap-kfc">{pair[0]}<i className="tap-ksp1" /><i className="tap-ksd" /></div>
              <div className="tap-kfc bf">{pair[1]}<i className="tap-ksp2" /><i className="tap-ksd" style={{ transform: 'scaleX(-1)' }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="tap-sec-p" style={{ textAlign: 'center', fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 15 }}>
        Turn the pages of our story, then share yours.
      </div>
      <Journey D={D} />
      <WeddingDay D={D} />
      <button className="tap-cta" onClick={goFeed}>Open the feed</button>
    </>
  )
}

/* ---------------- shared home sections ---------------- */
const Journey = ({ D }: { D: DemoData }, ref: any) => (
  <>
    <h2 className="tap-sec-h" ref={ref}>The journey</h2>
    <p className="tap-sec-p">Tap any event to see its memories.</p>
    {D.events.map((e) => (
      <div key={e.name} className={'tap-ev ' + (e.status === 'done' ? 'd' : e.status === 'next' ? 'n' : '')}>
        <i />
        <div style={{ minWidth: 0 }}>
          {e.name}
          <small>{e.detail} · {e.date}</small>
        </div>
        <span>{e.status === 'done' ? 'Done' : e.status === 'next' ? 'Next up' : 'Upcoming'}</span>
      </div>
    ))}
  </>
)

function WeddingDay({ D }: { D: DemoData }) {
  return (
    <>
      <h2 className="tap-sec-h">Wedding day</h2>
      <p className="tap-sec-p">{D.dateLong}</p>
      <div className="tap-wd">
        <div><strong>Church wedding · 10:00 am</strong></div>
        <div style={{ opacity: .85 }}>{D.ceremonyVenue}</div>
        <div style={{ marginTop: 10 }}><strong>Reception · 3:00 pm</strong></div>
        <div style={{ opacity: .85 }}>{D.receptionVenue}</div>
        <div style={{ marginTop: 10 }}><strong>Aso-ebi: {D.asoebi}</strong></div>
        <div style={{ opacity: .85 }}>Share your looks with <span style={{ fontWeight: 700 }}>{D.hashtag}</span></div>
      </div>
    </>
  )
}

/* ---------------- FEED ---------------- */
function Feed({ D, view, setView, onCompose }: { D: DemoData; view: 'post' | 'reels'; setView: (v: 'post' | 'reels') => void; onCompose: () => void }) {
  const [posts, setPosts] = useState<Post[]>(() => seedPosts(D))
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  if (view === 'reels') return <Reels D={D} />
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="tap-feedbar">
        <button className="on" onClick={() => setView('post')}>Posts</button>
        <button onClick={() => setView('reels')}>Reels</button>
      </div>
      <div style={{ height: 12 }} />
      {posts.map((p) => (
        <div key={p.id} className="tap-post">
          <div className="tap-pw">
            <i style={{ background: `hsl(${(p.by.length * 47) % 360}, 50%, 42%)` }}>{initial(p.by)}</i>
            <div>
              <b>{p.by}</b>
              <small>{p.mine ? 'just now' : p.ago}</small>
            </div>
          </div>
          <p>{p.cap}</p>
          <div className="tap-fm">
            {p.video ? (
              <video src={p.img} muted playsInline loop autoPlay />
            ) : p.img ? (
              <img src={p.img} alt="Event photo" loading="lazy" />
            ) : null}
          </div>
          <div className="tap-fa">
            <button
              className={'lk' + (liked[p.id] ? ' on' : '')}
              onClick={() => setLiked((l) => ({ ...l, [p.id]: !l[p.id] }))}
            >
              {HOUSE_ICONS.like}Like {p.likes + (liked[p.id] ? 1 : 0)}
            </button>
            <button>{HOUSE_ICONS.comment}Comment</button>
            <button>{HOUSE_ICONS.share}Share</button>
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', opacity: .55, fontSize: 12, padding: '4px 0 22px' }}>
        Guests are posting live. Be part of it.
      </div>
      <button className="tap-cta" onClick={onCompose}>Share a memory</button>
    </div>
  )
}

function Reels({ D }: { D: DemoData }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([])
  const [sound, setSound] = useState<Record<number, boolean>>({})
  return (
    <div className="tap-reels">
      {D.reels.map((r, i) => (
        <div key={r.src} className="tap-rl">
          <video
            ref={(el) => { refs.current[i] = el }}
            src={r.src}
            loop
            autoPlay
            playsInline
            muted={!sound[i]}
            onClick={() => {
              setSound((s) => ({ ...s, [i]: !s[i] }))
              const v = refs.current[i]
              if (v) v.muted = !sound[i]
            }}
          />
          <button className="tap-rvc" onClick={() => {
            setSound((s) => ({ ...s, [i]: !s[i] }))
            const v = refs.current[i]
            if (v) v.muted = !sound[i]
          }}>
            {sound[i] ? 'Sound on' : 'Tap for sound'}
          </button>
          <div className="tap-rs">
            <button>{HOUSE_ICONS.like}<i>Like</i></button>
            <button>{HOUSE_ICONS.comment}<i>12</i></button>
            <button>{HOUSE_ICONS.share}<i>Share</i></button>
          </div>
          <div className="tap-rt">
            <b>{r.by}</b><br />{r.cap}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- SETTINGS ---------------- */
function Settings({ D }: { D: DemoData }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState('')
  return (
    <div className="tap-set">
      <h2 className="tap-sec-h">Settings</h2>
      <div className="tap-card">
        <div className="tap-av">{saved ? initial(saved) : '+'}</div>
        <h3>{saved ? `Hello, ${saved}` : 'Complete your profile'}</h3>
        <p>Add your name and photo so the couple knows who you are.</p>
        <div className="tap-setup">
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={() => name.trim() && setSaved(name.trim())}>Save</button>
        </div>
      </div>
      <div className="tap-card">
        <h3>The celebration</h3>
        <div className="row"><span>Couple</span><b>{D.bride} &amp; {D.groom}</b></div>
        <div className="row"><span>Date</span><b>{D.dateLong}</b></div>
        <div className="row"><span>City</span><b>{D.city}</b></div>
        <div className="row"><span>Aso-ebi</span><b>{D.asoebi}</b></div>
        <div className="row"><span>Hashtag</span><b>{D.hashtag}</b></div>
      </div>
      <div className="tap-card">
        <h3>Install the app</h3>
        <p>Add this celebration to your home screen so memories are always one tap away.</p>
        <button className="tap-cta" style={{ margin: '4px 0 0' }}>Install</button>
      </div>
      <div className="tap-powered">POWERED BY EVENTICOR</div>
    </div>
  )
}

/* ---------------- APP SHELL ---------------- */
export default function TemplateApp({ tpl }: { tpl: Tpl }) {
  const D = useMemo(() => demoData(), [])
  const [view, setView] = useState<View>('home')
  const [feedView, setFeedView] = useState<'post' | 'reels'>('post')
  const [compose, setCompose] = useState(false)
  const [toast, setToast] = useState('')
  const journeyRef = useRef<HTMLElement | null>(null)

  const goJourney = () => {
    setView('home')
    setTimeout(() => journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  // hero deck / book / halo hide the top header on home, per each design.
  const showHeader = view !== 'home' || tpl === 'classic'
  const reelsOpen = view === 'feed' && feedView === 'reels'

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  const [cType, setCType] = useState<'photo' | 'video' | 'reel' | 'note'>('photo')
  const [cCap, setCCap] = useState('')
  const [cFile, setCFile] = useState<{ name: string; url?: string } | null>(null)

  function submitCompose() {
    if (cType !== 'note' && !cFile) { say('Choose a ' + (cType === 'photo' ? 'photo' : 'video') + ' first'); return }
    if (!cCap.trim()) { say('Write a short caption'); return }
    say('Preview mode: your memory would post to the live feed')
    setCompose(false); setCCap(''); setCFile(null)
  }

  return (
    <div className="tap-root" data-tpl={tpl}>
      <div className="tap-bd" style={reelsOpen ? { display: 'none' } : undefined}>
        {showHeader && <div className="tap-mh">{D.bride} &amp; {D.groom}</div>}
        {view === 'home' && (
          <div className={'tap-col tap-home' + (tpl === 'classic' ? '' : ' col')}>
            {tpl === 'classic' && <ClassicHome D={D} goFeed={() => setView('feed')} goJourney={goJourney} />}
            {tpl === 'halo' && <HaloHome D={D} goFeed={() => setView('feed')} goJourney={goJourney} />}
            {tpl === 'hero' && <HeroHome D={D} goFeed={() => setView('feed')} goJourney={goJourney} />}
            {tpl === 'book' && <BookHome D={D} goFeed={() => setView('feed')} goJourney={goJourney} />}
          </div>
        )}
        {view === 'feed' && <Feed D={D} view={feedView} setView={setFeedView} onCompose={() => setCompose(true)} />}
        {view === 'set' && <Settings D={D} />}
      </div>
      {!reelsOpen && (
        <nav className={'tap-nav' + (reelsOpen ? ' reels-on' : '')}>
          <button className={view === 'home' ? 'on' : ''} onClick={() => setView('home')}>
            <i className="ni">{HOUSE_ICONS.home}</i>Home
          </button>
          <div className="tap-mcn">
            <button className="tap-ms" onClick={() => { setView('feed'); setCompose(true) }}>+</button>
            <small style={{ color: 'var(--f)', fontSize: 11 }}>Feed</small>
          </div>
          <button className={view === 'set' ? 'on' : ''} onClick={() => setView('set')}>
            <i className="ni">{HOUSE_ICONS.settings}</i>Settings
          </button>
        </nav>
      )}
      {reelsOpen && (
        <button
          onClick={() => { setFeedView('post'); }}
          style={{ position: 'fixed', top: 14, left: 14, zIndex: 45, background: 'rgba(0,0,0,.5)', color: '#fff', border: 0, borderRadius: 99, padding: '8px 14px', font: '600 13px var(--body)', cursor: 'pointer' }}
        >
          Back to Posts
        </button>
      )}
      {compose && (
        <div className="tap-cb" onClick={() => setCompose(false)}>
          <div className="tap-cs" onClick={(e) => e.stopPropagation()}>
            <h4>Share a memory</h4>
            <div className="tap-ctabs">
              {([['photo', 'Photo'], ['video', 'Video'], ['reel', 'Reel'], ['note', 'Wish']] as const).map(([k, label]) => (
                <button key={k} className={cType === k ? 'on' : ''} onClick={() => { setCType(k); setCFile(null) }}>{label}</button>
              ))}
            </div>
            {cType !== 'note' && (
              <label className={'tap-dz' + (cFile ? ' on' : '')}>
                <input
                  type="file"
                  accept={cType === 'photo' ? 'image/*' : 'video/*'}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setCFile({ name: f.name, url: URL.createObjectURL(f) })
                  }}
                />
                {cFile ? cFile.name + ' selected' : 'Tap to choose a ' + (cType === 'photo' ? 'photo' : 'video')}
              </label>
            )}
            <textarea placeholder={cType === 'note' ? 'Write your wish for the couple' : 'What is happening at the celebration?'} value={cCap} onChange={(e) => setCCap(e.target.value)} />
            <button className="tap-go" onClick={submitCompose}>Share memory</button>
            <button className="tap-no" onClick={() => setCompose(false)}>Cancel</button>
          </div>
        </div>
      )}
      {toast && <div className="tap-toast" role="status">{toast}</div>}
    </div>
  )
}
