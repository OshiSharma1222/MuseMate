/**
 * Gallery photography for banners and the page backdrop. Stand-ins from
 * Wikimedia Commons until the museum supplies its own; see
 * public/images/CREDITS.md. They ship with the app because the dashboard is
 * served over the museum LAN with no internet.
 */
export interface Photo {
  src: string
  credit: string
  /** object-position, so a wide crop keeps the subject in frame */
  focus: string
}

export const PHOTOS = {
  corridor: {
    src: '/images/corridor.jpg',
    credit: 'Nomu420 · CC BY-SA 3.0',
    focus: '50% 55%',
  },
  nataraja: {
    src: '/images/nataraja.jpg',
    credit: 'Richard Mortel · CC BY 2.0',
    focus: '50% 45%',
  },
  natarajaFace: {
    src: '/images/nataraja-face.jpg',
    credit: 'Richard Mortel · CC BY 2.0',
    focus: '50% 38%',
  },
  instruments: {
    src: '/images/instruments.jpg',
    credit: 'Nomu420 · CC BY-SA 3.0',
    focus: '50% 50%',
  },
  woodwork: {
    src: '/images/woodwork.jpg',
    credit: 'Nomu420 · CC BY-SA 3.0',
    focus: '50% 55%',
  },
  stone: {
    src: '/images/stone-gallery.jpg',
    credit: 'Nomu420 · CC BY-SA 3.0',
    focus: '50% 60%',
  },
} satisfies Record<string, Photo>

/** The overview hero cycles through these. */
export const HERO_PHOTOS: Photo[] = [PHOTOS.corridor, PHOTOS.nataraja, PHOTOS.instruments, PHOTOS.stone]

const BY_SECTION: Record<string, Photo> = {
  '': PHOTOS.corridor,
  exhibition: PHOTOS.stone,
  artifacts: PHOTOS.natarajaFace,
  visitors: PHOTOS.corridor,
  reviews: PHOTOS.instruments,
  'pain-points': PHOTOS.woodwork,
  reports: PHOTOS.nataraja,
}

/** One photo per section, so each page has its own room. */
export function photoFor(pathname: string): Photo {
  return BY_SECTION[pathname.split('/')[1] ?? ''] ?? PHOTOS.corridor
}
