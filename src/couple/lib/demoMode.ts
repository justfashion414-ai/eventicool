// Demo mode for Eventicor couple-app previews: /app renders the wedding-gallery
// app itself with GENERIC content until a real couple's data is bound to it.
// No real couple's names, dates, venues or photos ever appear in a preview.
export const DEMO = true;

export const DEMO_COUPLE = {
  bride: 'Amara',
  groom: 'Daniel',
  header: 'Amara & Daniel',
  city: 'Lagos',
};

// The demo wedding sits 120 days out so the countdown always looks alive.
export const DEMO_WEDDING_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 120);
  return d.toISOString().slice(0, 10);
})();
export const DEMO_WEDDING_TIME = '10:00';

export const DEMO_STORY =
  "Amara and Daniel met at a friend's birthday dinner in 2021. Four years, two families and countless inside jokes later, here we are. This page keeps every moment of it in one place, for life.";

export const DEMO_DETAILS = {
  churchTime: '10:00 am',
  churchVenue: 'Central Chapel, Ikeja, Lagos',
  receptionTime: '3:00 pm',
  receptionVenue: 'The Grand Pavilion, Victoria Island, Lagos',
  asoEbi: 'wine and gold',
  hashtag: '#AmaraAndDaniel',
};

export const DEMO_PHOTOS = [
  '/demo/photo1.jpg',
  '/demo/photo2.jpg',
  '/demo/photo3.jpg',
  '/demo/photo4.jpg',
  '/demo/photo5.jpg',
  '/demo/photo6.jpg',
  '/demo/photo7.jpg',
];

export function demoEvents(): any[] {
  const T = (t: string) => demoText(t);
  const rel = (days: number) => {
    const d = new Date(`${DEMO_WEDDING_DATE}T12:00:00`);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  return [
    { id: 'intro', name: 'Introduction', type: 'Traditional introduction', date: rel(140), desc: T('Both families meet, gifts are exchanged and the journey becomes official.'), status: 'done', images: ['/demo/photo2.jpg', '/demo/photo3.jpg'] },
    { id: 'engage', name: 'Engagement', type: 'Engagement ceremony', date: rel(110), desc: T('The ring, the yes and the first big celebration together.'), status: 'done', images: ['/demo/photo4.jpg', '/demo/photo5.jpg'] },
    { id: 'court', name: 'Court Wedding', type: 'Registry', date: rel(60), desc: T('Signing the register with our closest people.'), status: 'done', images: ['/demo/photo6.jpg', '/demo/photo1.jpg'] },
    { id: 'shower', name: 'Bridal Shower', type: "The bride's party", date: rel(7), desc: T('An afternoon of games, gifts and girls with the bride.'), status: 'next', images: ['/demo/photo7.jpg', '/demo/photo2.jpg'] },
    { id: 'stag', name: "Groom's Party", type: "The groom's party", date: rel(4), desc: T("The groomsmen send the groom off in style."), status: 'up', images: [] },
    { id: 'church', name: 'Church Wedding', type: 'Holy matrimony', date: DEMO_WEDDING_DATE, time: '10:00', desc: T('Vows before God, family and friends.'), status: 'up', images: [] },
    { id: 'reception', name: 'Reception', type: 'Hall celebration', date: DEMO_WEDDING_DATE, time: '15:00', desc: T('Food, music, aso-ebi and the first dance.'), status: 'up', images: [] },
    { id: 'thanks', name: 'Thanksgiving', type: 'Thanksgiving service', date: rel(-1), desc: T('We close the weekend giving thanks together.'), status: 'up', images: [] },
  ];
}

export const DEMO_GUESTS = ['Aunty Ronke', 'Tolu', 'Chidi', 'Kemi', 'Bisi', 'Emeka', 'Ngozi', 'Fola'];

export const DEMO_CAPTIONS = [
  'The entrance was everything! Daniel could not stop smiling.',
  'Amara walked in with her aunties. We cried before the first prayer.',
  'God bless your union, Amara and Daniel!',
  "Still not over Amara's outfit today.",
  'The moment the two families met. Pure joy.',
  'A lifetime of happiness for you both!',
  'Best event of the year, no debate!',
  'Daniel and the groomsmen did not disappoint.',
];

export const DEMO_REELS = [
  { src: '/reels/r1.mp4', by: 'Kemi', cap: 'The venue came together beautifully' },
  { src: '/reels/r2.mp4', by: 'Chidi', cap: 'Every detail was ready before she walked in' },
  { src: '/reels/r3.mp4', by: 'Bisi', cap: 'The bride, moments before the walk' },
  { src: '/reels/r4.mp4', by: 'Fola', cap: 'Two hearts, one celebration' },
];

// Preview access code: the composer in a preview validates against this local
// demo code, never the real couple's code from Firebase.
export const DEMO_ACCESS_CODE = 'AMARA26';

// ---- Lead sample override -------------------------------------------------
// A lead sample is a marketing app an admin builds in the console. Its link
// (?lead=<id>) carries the admin's chosen names and uploaded placeholder
// images; CoupleApp resolves the lead before AnniversaryPortal renders, and
// the generic demo content then uses the lead's data wherever it appears:
// hero section, giant footer wall, feed photo posts and the names shown.
// The journey keeps the seeded demo events and reels keep the demo videos.
export interface LeadOverride {
  bride: string;
  groom: string;
  city?: string;
  heroImages?: string[];
  footerImages?: string[];
  feedImages?: string[];
}
let LEAD: LeadOverride | null = null;
export function setLeadOverride(l: LeadOverride | null) { LEAD = l; }
export function leadOverride(): LeadOverride | null { return LEAD; }
export function demoBride(): string { return LEAD?.bride || DEMO_COUPLE.bride; }
export function demoGroom(): string { return LEAD?.groom || DEMO_COUPLE.groom; }
export function demoHeader(): string { return LEAD ? `${LEAD.bride} & ${LEAD.groom}` : DEMO_COUPLE.header; }
export function demoCity(): string { return LEAD?.city || DEMO_COUPLE.city; }
// Sample copy mentions Amara and Daniel by name; under a lead those sentences
// name the lead's couple instead, so the story, captions and journey blurbs
// stay coherent with the header.
export function demoText(t: string): string {
  if (!LEAD) return t;
  return t.replace(/Amara/g, LEAD.bride).replace(/Daniel/g, LEAD.groom);
}
export function demoHeroImages(): string[] {
  return LEAD && LEAD.heroImages && LEAD.heroImages.length > 0 ? LEAD.heroImages : DEMO_PHOTOS;
}
export function demoFooterImages(): string[] {
  return LEAD && LEAD.footerImages && LEAD.footerImages.length > 0 ? [...LEAD.footerImages, ...DEMO_PHOTOS] : [...DEMO_PHOTOS];
}
export function demoFeedImages(): string[] {
  return LEAD && LEAD.feedImages && LEAD.feedImages.length > 0 ? LEAD.feedImages : DEMO_PHOTOS;
}

// Seeded demo feed: real-post shape so the feed renders through the normal
// card path. Demo posts never touch Firebase or Cloudinary.
export const DEMO_POSTS = (() => {
  const evs = demoEvents();
  const hrs = (h: number) => new Date(Date.now() - h * 3600_000);
  const rows: any[] = [];
  DEMO_CAPTIONS.forEach((cap, i) => {
    rows.push({
      id: `demo-seed-p${i}`,
      localDemo: true,
      authorUid: `demo-guest-${i}`,
      authorName: DEMO_GUESTS[i % DEMO_GUESTS.length],
      authorPhoto: null,
      text: cap,
      mediaUrls: [DEMO_PHOTOS[i % DEMO_PHOTOS.length]],
      mediaTypes: ['image'],
      eventId: evs[i % evs.length].id,
      pending: false,
      likeCount: 6 + ((i * 7) % 30),
      loveCount: 3 + ((i * 5) % 17),
      commentCount: i % 3,
      timestamp: hrs(6 + i * 9),
    });
  });
  DEMO_REELS.forEach((r, i) => {
    rows.push({
      id: `demo-seed-r${i}`,
      localDemo: true,
      authorUid: `demo-guest-r${i}`,
      authorName: r.by,
      authorPhoto: null,
      text: r.cap,
      mediaUrls: [r.src],
      mediaTypes: ['video'],
      videoOrientation: 'portrait',
      eventId: evs[(i + 3) % evs.length].id,
      pending: false,
      likeCount: 11 + i * 6,
      loveCount: 5 + i * 3,
      commentCount: i % 2,
      timestamp: hrs(10 + i * 12),
    });
  });
  return rows;
})();
