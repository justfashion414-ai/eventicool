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
  const rel = (days: number) => {
    const d = new Date(`${DEMO_WEDDING_DATE}T12:00:00`);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  return [
    { id: 'intro', name: 'Introduction', type: 'Traditional introduction', date: rel(140), desc: 'Both families meet, gifts are exchanged and the journey becomes official.', status: 'done' },
    { id: 'engage', name: 'Engagement', type: 'Engagement ceremony', date: rel(110), desc: 'The ring, the yes and the first big celebration together.', status: 'done' },
    { id: 'court', name: 'Court Wedding', type: 'Registry', date: rel(60), desc: 'Signing the register with our closest people.', status: 'done' },
    { id: 'shower', name: 'Bridal Shower', type: "The bride's party", date: rel(7), desc: 'An afternoon of games, gifts and girls with the bride.', status: 'next' },
    { id: 'stag', name: "Groom's Party", type: "The groom's party", date: rel(4), desc: 'The groomsmen send Daniel off in style.', status: 'up' },
    { id: 'church', name: 'Church Wedding', type: 'Holy matrimony', date: DEMO_WEDDING_DATE, time: '10:00', desc: 'Vows before God, family and friends.', status: 'up' },
    { id: 'reception', name: 'Reception', type: 'Hall celebration', date: DEMO_WEDDING_DATE, time: '15:00', desc: 'Food, music, aso-ebi and the first dance.', status: 'up' },
    { id: 'thanks', name: 'Thanksgiving', type: 'Thanksgiving service', date: rel(-1), desc: 'We close the weekend giving thanks together.', status: 'up' },
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
