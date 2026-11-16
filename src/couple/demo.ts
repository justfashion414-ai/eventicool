// Generic demo content for template previews: the templateable couple app
// renders this until a real couple's data is bound to it. No Firestore reads.
export const DEMO_PHOTOS = [
  'https://images.pexels.com/photos/29083272/pexels-photo-29083272.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/29083275/pexels-photo-29083275.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/29083279/pexels-photo-29083279.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/29083281/pexels-photo-29083281.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/29083283/pexels-photo-29083283.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/29083284/pexels-photo-29083284.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/29083285/pexels-photo-29083285.jpeg?auto=compress&cs=tinysrgb&w=800',
]

const BOOK_CAPS = ['Together', 'Our traditions', 'The shoot', 'Golden hour', 'Save the date', 'Forever']

export interface DemoEvent { name: string; detail: string; status: 'done' | 'next' | 'upcoming'; date: string }

function demoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 120)
  return d.toISOString().slice(0, 10)
}
function relDate(daysBefore: number): string {
  const d = new Date(demoDate() + 'T12:00:00')
  d.setDate(d.getDate() - daysBefore)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function demoData() {
  const dateISO = demoDate()
  const wedding = new Date(dateISO + 'T12:00:00')
  const days = Math.max(0, Math.ceil((wedding.getTime() - Date.now()) / 864e5))
  const dateShort = wedding.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const dateLong = wedding.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const pd2 = (x: number) => (x < 10 ? '0' : '') + x
  const dotDate = pd2(wedding.getDate()) + ' · ' + pd2(wedding.getMonth() + 1) + ' · ' + wedding.getFullYear()
  const events: DemoEvent[] = [
    { name: 'Introduction', detail: 'Both families meet', status: 'done', date: relDate(140) },
    { name: 'Engagement', detail: 'The ring and the yes', status: 'done', date: relDate(110) },
    { name: 'Court wedding', detail: 'Signing the register', status: 'done', date: relDate(60) },
    { name: 'Bridal shower', detail: "The bride's party", status: 'next', date: relDate(7) },
    { name: "Groom's party", detail: 'The groomsmen send him off', status: 'upcoming', date: relDate(4) },
    { name: 'Church wedding', detail: 'Holy matrimony', status: 'upcoming', date: relDate(0) },
    { name: 'Reception', detail: 'Food, music and the first dance', status: 'upcoming', date: relDate(0) },
    { name: 'Thanksgiving', detail: 'We close the weekend giving thanks', status: 'upcoming', date: relDate(-1) },
  ]
  return {
    bride: 'Amara',
    groom: 'Daniel',
    city: 'Lagos',
    hashtag: '#AmaraAndDaniel',
    dateISO,
    days,
    dateShort,
    dateLong,
    dotDate,
    events,
    ceremonyVenue: 'Central Chapel, Ikeja',
    receptionVenue: 'The Grand Pavilion, Victoria Island',
    asoebi: 'Wine and gold',
    bookCaps: BOOK_CAPS,
    guests: ['Aunty Ronke', 'Tolu', 'Chidi', 'Kemi', 'Bisi', 'Emeka', 'Ngozi', 'Fola'],
    captions: [
      'The entrance was everything! Daniel could not stop smiling.',
      'Amara walked in with her aunties. We cried before the first prayer.',
      'God bless your union, Amara and Daniel!',
      "Still not over Amara's outfit today.",
      'The moment the two families met. Pure joy.',
      'A lifetime of happiness for you both!',
      'Best event of the year, no debate!',
      'Daniel and the groomsmen did not disappoint.',
    ],
    ago: ['2 hours ago', '6 hours ago', 'yesterday', '2 days ago', '3 days ago', '4 days ago', '5 days ago', '6 days ago'],
    likes: [42, 38, 57, 61, 24, 33, 45, 29],
    reels: [
      { src: '/reels/r1.mp4', by: 'Kemi', cap: 'The venue came together beautifully' },
      { src: '/reels/r2.mp4', by: 'Chidi', cap: 'Every detail was ready before she walked in' },
      { src: '/reels/r3.mp4', by: 'Bisi', cap: 'The bride, moments before the walk' },
      { src: '/reels/r4.mp4', by: 'Fola', cap: 'Two hearts, one celebration' },
    ],
  }
}
export type DemoData = ReturnType<typeof demoData>
