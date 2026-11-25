// What-are-you-celebrating: the event types the landing can open on.
export type Celebration = {
  slug: string
  label: string
  short: string // vertical widget word
  blurb: string
  tint: string
  heroTpls: string[]
  b: string
  g: string
  labels: [string, string]
  sub: string
  invite: string
  rec: string
  s1: string
  s2: string
  giftSub: string
  giftNote: string
  title: string
}

export const CELEBRATIONS: Celebration[] = [
  {
    slug: 'wedding', label: 'Wedding', short: 'Wedding', tint: '#2E55D6',
    heroTpls: ['classic', 'halo', 'hero', 'book'],
    blurb: 'Every stage, from the introduction to the thanksgiving.',
    b: 'Amara', g: 'Daniel', labels: ['Bride', 'Groom'],
    sub: 'Together with their families', giftSub: 'Honeymoon, home and a fresh start', giftNote: 'God bless your union', invite: 'request the honour of your presence',
    rec: 'Ceremony &amp; Reception', s1: 'Engagement', s2: 'Bridal shower',
    title: 'Wedding event apps',
  },
  {
    slug: 'birthday', label: 'Birthday', short: 'Birthday', tint: '#FF6B4A',
    heroTpls: ['bd-party', 'bd-gold'],
    blurb: 'From the pre-party to the big-N toast.',
    b: 'Chidera', g: 'Friends', labels: ['Celebrant', 'Co-host'],
    sub: 'A birthday to remember', giftSub: 'A new year, new blessings', giftNote: 'More candles, more life!', invite: 'come and turn up with us',
    rec: 'Party &amp; Reception', s1: 'Party kicks off', s2: 'Cake cutting',
    title: 'Birthday event apps',
  },
  {
    slug: 'naming-ceremony', label: 'Naming ceremony', short: 'Naming', tint: '#0C8A5F',
    heroTpls: [],
    blurb: 'Introduce your little one to the whole village.',
    b: 'Adaeze', g: 'Chidi', labels: ['Mother', 'Father'],
    sub: 'Welcome to the world, little one', giftSub: "Toward the little one's future", giftNote: 'God bless this new life!', invite: 'join us as we name our little one',
    rec: 'Naming &amp; Reception', s1: 'Thanksgiving service', s2: 'Naming & reception',
    title: 'Naming ceremony event apps',
  },
  {
    slug: 'coronation', label: 'Coronation', short: 'Coronation', tint: '#B8860B',
    heroTpls: [],
    blurb: 'Royal pomp for a chief or king in the making.',
    b: 'Oba Adeyemi', g: 'Royal House', labels: ['Celebrant', 'Court'],
    sub: 'A royal celebration', giftSub: 'Toward the big day', giftNote: 'A long and peaceful reign!', invite: 'grace this royal occasion',
    rec: 'Royal Reception', s1: 'Procession', s2: 'Crowning',
    title: 'Coronation event apps',
  },
  {
    slug: 'burial', label: 'Burial & memorial', short: 'Burial', tint: '#5A6478',
    heroTpls: [],
    blurb: 'Honor a life well lived, together.',
    b: 'Pa Emeka', g: 'Family', labels: ['Honouree', 'Family'],
    sub: 'A life well lived', giftSub: 'Standing with the family', giftNote: 'Rest well, we honour you', invite: 'stand with the family',
    rec: 'Service &amp; Reception', s1: 'Service of songs', s2: 'Commendation',
    title: 'Burial and memorial event apps',
  },
  {
    slug: 'anniversary', label: 'Anniversary', short: 'Anniversary', tint: '#D6285F',
    heroTpls: [],
    blurb: 'Renew the day it all began.',
    b: 'Chidi', g: 'Ngozi', labels: ['Husband', 'Wife'],
    sub: 'Still counting the years together', giftSub: 'A second honeymoon', giftNote: 'Many more decades together', invite: 'celebrate our love story with us',
    rec: 'Dinner &amp; Dance', s1: 'Church thanksgiving', s2: 'Vow renewal',
    title: 'Anniversary event apps',
  },
  {
    slug: 'christmas', label: 'Christmas', short: 'Christmas', tint: '#0C4A36',
    heroTpls: [],
    blurb: 'Gather the family and share the season.',
    b: 'The Okafors', g: 'Family', labels: ['Family', 'Hosts'],
    sub: 'One family, one season', giftSub: 'For the season ahead', giftNote: 'A season of joy for your family!', invite: 'celebrate the season with us',
    rec: 'Family Party', s1: 'Carols & service', s2: 'Family feast',
    title: 'Christmas event apps',
  },
]

export const bySlug: Record<string, Celebration> = Object.fromEntries(
  CELEBRATIONS.map((c) => [c.slug, c]),
)

export function isCelebrationSlug(s: string | null): boolean {
  return !!s && !!bySlug[s]
}

export function typeFromPath(pathname: string): string | null {
  const seg = pathname.replace(/\/+$/, '').split('/')[1]
  return seg && bySlug[seg] ? seg : null
}

export function typeFromQuery(search: string): string | null {
  const v = new URLSearchParams(search).get('type')
  return v && bySlug[v] ? v : null
}

export const CELEBRATION_KEY = 'ev-celebration'

export function getSavedCelebration(): string | null {
  try {
    const v = localStorage.getItem(CELEBRATION_KEY)
    return v && bySlug[v] ? v : null
  } catch { return null }
}

export function setSavedCelebration(slug: string) {
  try { localStorage.setItem(CELEBRATION_KEY, slug) } catch { /* ignore */ }
}
