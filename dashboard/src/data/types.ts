export type Lang = 'hi' | 'en' | 'ta' | 'bn' | 'mr' | 'te' | 'kn' | 'ml' | 'gu' | 'de' | 'fr'

export type Mode = 'default' | 'quick' | 'detailed' | 'child'

export type GroupType = 'solo' | 'family' | 'school' | 'tour'

export type GalleryId =
  | 'arch'
  | 'sculpture'
  | 'bronze'
  | 'painting'
  | 'arms'
  | 'coins'
  | 'decorative'
  | 'textile'

export type ArtifactKind =
  | 'seal'
  | 'sculpture'
  | 'bronze'
  | 'painting'
  | 'textile'
  | 'arms'
  | 'coin'
  | 'manuscript'
  | 'vessel'
  | 'instrument'

/** What a visitor's question is about. Drives the content-gap report. */
export type Topic =
  | 'maker'
  | 'age'
  | 'material'
  | 'technique'
  | 'meaning'
  | 'story'
  | 'origin'
  | 'use'
  | 'related'
  | 'provenance'
  | 'restoration'
  | 'value'
  | 'media'
  | 'facilities'

/** declined = the guide refused on purpose (e.g. market value), not a gap. */
export type AnswerStatus = 'answered' | 'unanswered' | 'declined'

export interface Gallery {
  id: GalleryId
  name: string
  room: string
}

/** The fields a curator can see and edit. */
export interface Artifact {
  id: string
  accession: string
  nfcTag: string
  name: string
  kind: ArtifactKind
  gallery: GalleryId
  period: string
  region: string
  material: string
  dimensions: string
  description: string
  curatorNotes: string
  verified: boolean
  narrationLangs: Lang[]
  updatedAt: number
}

export interface Query {
  id: string
  sessionId: string
  /** null for questions that are not about an artifact (washrooms, exits). */
  artifactId: string | null
  at: number
  lang: Lang
  /** As the visitor asked it, when we have the original script. */
  text: string
  textEn: string
  topic: Topic
  status: AnswerStatus
  latencyMs: number
}

export interface Stop {
  artifactId: string
  at: number
  dwellSec: number
  /** Share of the narration played before the visitor moved on. */
  listenedPct: number
  skipped: boolean
  replays: number
  /** Extra taps needed before the NFC tag read. */
  tapRetries: number
  queries: Query[]
}

export type ReviewTag =
  | 'tag-hard-to-find'
  | 'narration-long'
  | 'voice-quality'
  | 'battery'
  | 'slow-answers'
  | 'no-facilities'
  | 'wanted-more'
  | 'loved-child-mode'
  | 'loved-language'
  | 'loved-questions'
  | 'easy-to-use'

export interface Review {
  rating: number
  text: string
  textEn: string
  tags: ReviewTag[]
}

export interface Session {
  id: string
  deviceId: string
  lang: Lang
  mode: Mode
  group: GroupType
  startedAt: number
  /** null while the visitor is still in the museum. */
  endedAt: number | null
  stops: Stop[]
  /** Questions not tied to an artifact. */
  looseQueries: Query[]
  rating: number | null
  review: Review | null
}
