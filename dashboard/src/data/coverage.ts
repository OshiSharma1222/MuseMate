import type { Artifact, Topic } from './types'

/*
  A rough read of which kinds of question the guide can answer from an
  entry. The guide only answers from curator content, so a topic with no
  supporting text is a question that will go unanswered. On the server this
  would be the retrieval step's hit rate; here it is keyword rules, which is
  enough to show a curator what their edit changes.
*/

export interface CoverageRule {
  topic: Topic
  label: string
  test: (a: Artifact, text: string) => boolean
}

export const COVERAGE_RULES: CoverageRule[] = [
  { topic: 'age', label: 'Date', test: (a) => a.period.trim().length > 2 },
  { topic: 'origin', label: 'Find-spot', test: (a) => a.region.trim().length > 2 },
  { topic: 'material', label: 'Material', test: (a) => a.material.trim().length > 2 },
  {
    topic: 'technique',
    label: 'How it was made',
    test: (_, t) => /cast|carv|wove|weav|paint|dye|incis|inlai|inlay|stamp|model|forg|technique|drawn|struck|worked/i.test(t),
  },
  { topic: 'meaning', label: 'Meaning', test: (_, t) => t.length > 140 },
  { topic: 'use', label: 'Original use', test: (_, t) => /used|made to|made for|worn|carried|offered|given|pressed|sold|guard|mark/i.test(t) },
  { topic: 'story', label: 'Stories', test: (_, t) => /legend|story|famous|myth|accounts?|said to|tradition/i.test(t) },
  {
    topic: 'provenance',
    label: 'Provenance',
    test: (_, t) => /acquir|donat|purchas|gift|bequest|transferr|excavated|came to the museum|collection of|replica of|original is/i.test(t),
  },
  {
    topic: 'restoration',
    label: 'Condition',
    test: (_, t) => /restor|conserv|repair|clean|stabilis|stabiliz|damage|broken|missing|condition/i.test(t),
  },
]

export function coverage(a: Artifact) {
  const text = `${a.description}\n${a.curatorNotes}`
  return COVERAGE_RULES.map((r) => ({ ...r, covered: r.test(a, text) }))
}
