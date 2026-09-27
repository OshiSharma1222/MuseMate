import type { ArtifactKind, Gallery, GalleryId, Lang, Mode, ReviewTag, Topic } from './types'

export const MUSEUM = {
  name: 'Sangam Heritage Museum',
  city: 'New Delhi',
  opensAt: 10,
  closesAt: 18,
  /** 1 = Monday, as returned by Date#getDay. Most Indian state museums close on Mondays. */
  closedDay: 1,
  /** Enough handhelds for a Sunday peak of about 70 visitors inside. */
  devices: 80,
}

/** Galleries in the order the floor plan walks a visitor through them. */
export const GALLERIES: Gallery[] = [
  { id: 'arch', name: 'Harappan & Early Historic', room: 'G1' },
  { id: 'sculpture', name: 'Stone Sculpture', room: 'G2' },
  { id: 'bronze', name: 'Bronzes', room: 'G3' },
  { id: 'painting', name: 'Miniature Paintings', room: 'G4' },
  { id: 'arms', name: 'Arms & Armour', room: 'G5' },
  { id: 'coins', name: 'Coins', room: 'G6' },
  { id: 'decorative', name: 'Decorative Arts & Manuscripts', room: 'G7' },
  { id: 'textile', name: 'Textiles', room: 'G8' },
]

export const GALLERY_BY_ID = Object.fromEntries(GALLERIES.map((g) => [g.id, g])) as Record<GalleryId, Gallery>

export const LANGS: { id: Lang; name: string; native: string; weight: number }[] = [
  { id: 'hi', name: 'Hindi', native: 'हिन्दी', weight: 0.33 },
  { id: 'en', name: 'English', native: 'English', weight: 0.22 },
  { id: 'ta', name: 'Tamil', native: 'தமிழ்', weight: 0.08 },
  { id: 'bn', name: 'Bengali', native: 'বাংলা', weight: 0.08 },
  { id: 'mr', name: 'Marathi', native: 'मराठी', weight: 0.07 },
  { id: 'te', name: 'Telugu', native: 'తెలుగు', weight: 0.06 },
  { id: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', weight: 0.04 },
  { id: 'ml', name: 'Malayalam', native: 'മലയാളം', weight: 0.04 },
  { id: 'gu', name: 'Gujarati', native: 'ગુજરાતી', weight: 0.04 },
  { id: 'de', name: 'German', native: 'Deutsch', weight: 0.02 },
  { id: 'fr', name: 'French', native: 'Français', weight: 0.02 },
]

export const LANG_NAME = Object.fromEntries(LANGS.map((l) => [l.id, l.name])) as Record<Lang, string>

export const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: 'default', name: 'Default', hint: 'Standard narration' },
  { id: 'quick', name: 'Quick', hint: '30-second summaries' },
  { id: 'detailed', name: 'Detailed', hint: 'History, context, technique' },
  { id: 'child', name: 'Child', hint: 'Story-led, simple words' },
]

export const MODE_NAME = Object.fromEntries(MODES.map((m) => [m.id, m.name])) as Record<Mode, string>

export const TOPICS: Record<Topic, { label: string; gapLabel: string }> = {
  maker: { label: 'Who made it', gapLabel: 'Maker and workshop' },
  age: { label: 'Age and date', gapLabel: 'Dating' },
  material: { label: 'Material', gapLabel: 'Material' },
  technique: { label: 'How it was made', gapLabel: 'Making technique' },
  meaning: { label: 'Meaning and symbols', gapLabel: 'Iconography and meaning' },
  story: { label: 'Stories and legends', gapLabel: 'Stories and legends' },
  origin: { label: 'Where it was found', gapLabel: 'Find-spot' },
  use: { label: 'What it was used for', gapLabel: 'Original use' },
  related: { label: 'Related objects', gapLabel: 'Related objects' },
  provenance: { label: 'How the museum got it', gapLabel: 'Provenance and acquisition' },
  restoration: { label: 'Condition and restoration', gapLabel: 'Conservation history' },
  value: { label: 'Market value', gapLabel: 'Market value' },
  media: { label: 'Hear or see more', gapLabel: 'Audio and media' },
  facilities: { label: 'Facilities and directions', gapLabel: 'Facilities and directions' },
}

/** How often the guide can answer each topic from typical curator content. */
export const TOPIC_ANSWER_RATE: Record<Topic, number> = {
  maker: 0.88,
  age: 0.97,
  material: 0.96,
  technique: 0.86,
  meaning: 0.92,
  story: 0.87,
  origin: 0.93,
  use: 0.9,
  related: 0.9,
  provenance: 0.34,
  restoration: 0.22,
  value: 1,
  media: 0.05,
  facilities: 0.06,
}

export interface QuestionTemplate {
  topic: Topic
  en: string
  hi: string
}

/** Questions any artifact can get. */
export const GENERIC_QUESTIONS: QuestionTemplate[] = [
  { topic: 'maker', en: 'Who made this?', hi: 'इसे किसने बनाया?' },
  { topic: 'age', en: 'How old is this?', hi: 'यह कितना पुराना है?' },
  { topic: 'material', en: 'What is it made of?', hi: 'यह किस चीज़ से बना है?' },
  { topic: 'technique', en: 'How was this made?', hi: 'इसे कैसे बनाया गया था?' },
  { topic: 'meaning', en: 'What does this symbolise?', hi: 'इसका क्या मतलब है?' },
  { topic: 'story', en: 'Is there a story behind it?', hi: 'इसके पीछे कोई कहानी है?' },
  { topic: 'origin', en: 'Where was this found?', hi: 'यह कहाँ मिला था?' },
  { topic: 'use', en: 'What was it used for?', hi: 'इसका इस्तेमाल किस लिए होता था?' },
  { topic: 'related', en: 'Are there more like this in the museum?', hi: 'संग्रहालय में ऐसी और चीज़ें हैं?' },
  { topic: 'provenance', en: 'How did the museum get this?', hi: 'यह संग्रहालय में कैसे आया?' },
  { topic: 'provenance', en: 'Is this the original or a copy?', hi: 'यह असली है या नकल?' },
  { topic: 'restoration', en: 'Has this been restored?', hi: 'क्या इसकी मरम्मत की गई है?' },
  { topic: 'restoration', en: 'Why is part of it broken?', hi: 'इसका एक हिस्सा टूटा क्यों है?' },
  { topic: 'value', en: 'How much is this worth?', hi: 'इसकी कीमत कितनी है?' },
]

/** Questions that are not about any artifact. The guide has no data for these. */
export const FACILITY_QUESTIONS: QuestionTemplate[] = [
  { topic: 'facilities', en: 'Where is the washroom?', hi: 'शौचालय कहाँ है?' },
  { topic: 'facilities', en: 'Where is the café?', hi: 'कैंटीन कहाँ है?' },
  { topic: 'facilities', en: 'How do I get to the exit?', hi: 'बाहर निकलने का रास्ता कहाँ है?' },
  { topic: 'facilities', en: 'Is there a lift for wheelchairs?', hi: 'क्या व्हीलचेयर के लिए लिफ्ट है?' },
  { topic: 'facilities', en: 'Where can I buy a replica?', hi: 'इसकी प्रतिकृति कहाँ मिलेगी?' },
]

export interface CatalogEntry {
  id: string
  accession: string
  name: string
  kind: ArtifactKind
  gallery: GalleryId
  period: string
  region: string
  material: string
  dimensions: string
  description: string
  /** How strongly it draws visitors, 0–1. */
  appeal: number
  /** How likely a visitor cuts its narration short, 0–1. */
  skipBias: number
  /** Content is thin, so most questions go unanswered. */
  thin?: boolean
  /** Tag sits behind thick glass or at an awkward height. */
  hardTag?: boolean
  questions: QuestionTemplate[]
}

export const CATALOG: CatalogEntry[] = [
  // G1 Harappan & Early Historic
  {
    id: 'A001',
    accession: 'SHM 1958.4.12',
    name: 'Unicorn seal',
    kind: 'seal',
    gallery: 'arch',
    period: 'Harappan, c. 2500–1900 BCE',
    region: 'Mohenjo-daro, Sindh',
    material: 'Steatite',
    dimensions: '3.2 × 3.2 cm',
    description:
      'A square stamp seal showing a one-horned animal before a ritual stand, with a line of the still-undeciphered Indus script above. Seals like this were pressed into clay to mark goods and may have signalled the owner’s trade or clan.',
    appeal: 0.86,
    skipBias: 0.12,
    questions: [
      { topic: 'meaning', en: 'Can anyone read the script on this seal?', hi: 'क्या इस मुहर की लिपि कोई पढ़ सकता है?' },
      { topic: 'story', en: 'Was the unicorn a real animal?', hi: 'क्या यूनिकॉर्न सच में कोई जानवर था?' },
      { topic: 'use', en: 'Why did they need seals?', hi: 'उन्हें मुहरों की ज़रूरत क्यों थी?' },
    ],
  },
  {
    id: 'A002',
    accession: 'SHM 1961.2.3',
    name: 'Mother Goddess figurine',
    kind: 'sculpture',
    gallery: 'arch',
    period: 'Harappan, c. 2600–2000 BCE',
    region: 'Mohenjo-daro, Sindh',
    material: 'Terracotta',
    dimensions: 'H 17.5 cm',
    description:
      'A hand-modelled female figure with a fan-shaped headdress, heavy necklaces and a girdle. Figurines of this type are usually read as fertility or household deities.',
    appeal: 0.6,
    skipBias: 0.18,
    questions: [
      { topic: 'meaning', en: 'Why is she wearing such a big headdress?', hi: 'इसने इतना बड़ा मुकुट क्यों पहना है?' },
      { topic: 'use', en: 'Did people pray to this at home?', hi: 'क्या लोग घर में इसकी पूजा करते थे?' },
    ],
  },
  {
    id: 'A003',
    accession: 'SHM 2004.1.1',
    name: 'Dancing Girl (cast replica)',
    kind: 'bronze',
    gallery: 'arch',
    period: 'Harappan, c. 2300–1750 BCE',
    region: 'Mohenjo-daro, Sindh',
    material: 'Bronze (replica)',
    dimensions: 'H 10.5 cm',
    description:
      'A museum replica of the lost-wax bronze of a young woman with one hand on her hip and an arm covered in bangles. It is among the oldest known bronze sculptures in the world.',
    appeal: 0.92,
    skipBias: 0.1,
    questions: [
      { topic: 'provenance', en: 'Is this the original Dancing Girl?', hi: 'क्या यह असली नर्तकी की मूर्ति है?' },
      { topic: 'provenance', en: 'Where is the real one kept?', hi: 'असली मूर्ति कहाँ रखी है?' },
      { topic: 'meaning', en: 'Why does she wear so many bangles?', hi: 'इसने इतनी सारी चूड़ियाँ क्यों पहनी हैं?' },
    ],
  },
  {
    id: 'A004',
    accession: 'SHM 1972.9.40',
    name: 'Painted Grey Ware bowl',
    kind: 'vessel',
    gallery: 'arch',
    period: 'c. 1200–600 BCE',
    region: 'Ganga plain',
    material: 'Fired clay',
    dimensions: 'D 14 cm',
    description: 'Grey bowl with black painted bands.',
    appeal: 0.28,
    skipBias: 0.46,
    thin: true,
    questions: [
      { topic: 'use', en: 'Who used bowls like this?', hi: 'ऐसे कटोरे कौन इस्तेमाल करता था?' },
      { topic: 'meaning', en: 'Is this linked to the Mahabharata period?', hi: 'क्या इसका संबंध महाभारत काल से है?' },
    ],
  },
  {
    id: 'A005',
    accession: 'SHM 1966.3.1',
    name: 'Ashokan edict fragment',
    kind: 'sculpture',
    gallery: 'arch',
    period: 'Mauryan, 3rd century BCE',
    region: 'Bihar',
    material: 'Chunar sandstone',
    dimensions: '42 × 30 cm',
    description:
      'Part of a rock edict issued by the emperor Ashoka in the Brahmi script, urging restraint, tolerance between sects and kindness to animals. The polish is typical of Mauryan workshops.',
    appeal: 0.64,
    skipBias: 0.22,
    questions: [
      { topic: 'meaning', en: 'What does the inscription say?', hi: 'इस शिलालेख में क्या लिखा है?' },
      { topic: 'story', en: 'Why did Ashoka put up these edicts?', hi: 'अशोक ने ये शिलालेख क्यों लगवाए?' },
    ],
  },

  // G2 Stone Sculpture
  {
    id: 'A006',
    accession: 'SHM 1955.7.2',
    name: 'Bodhisattva Maitreya',
    kind: 'sculpture',
    gallery: 'sculpture',
    period: 'Kushan, 2nd–3rd century CE',
    region: 'Gandhara',
    material: 'Grey schist',
    dimensions: 'H 94 cm',
    description:
      'A standing bodhisattva in princely dress with a moustache, turban and heavy jewellery. The deep folds of the robe show the Greco-Roman influence that reached Gandhara after Alexander.',
    appeal: 0.78,
    skipBias: 0.14,
    questions: [
      { topic: 'origin', en: 'Why does the Buddha look Greek?', hi: 'बुद्ध यूनानी जैसे क्यों दिखते हैं?' },
      { topic: 'meaning', en: 'What is a bodhisattva?', hi: 'बोधिसत्व क्या होता है?' },
    ],
  },
  {
    id: 'A007',
    accession: 'SHM 1959.1.8',
    name: 'Yakshi with a mango bough',
    kind: 'sculpture',
    gallery: 'sculpture',
    period: 'Kushan, 2nd century CE',
    region: 'Mathura, Uttar Pradesh',
    material: 'Mottled red sandstone',
    dimensions: 'H 128 cm',
    description:
      'A railing pillar carved with a yakshi, a nature spirit, holding a flowering branch and standing on a dwarf. Such figures guarded the gateways of Buddhist and Jain stupas.',
    appeal: 0.66,
    skipBias: 0.2,
    questions: [
      { topic: 'meaning', en: 'Who is a yakshi?', hi: 'यक्षी कौन होती है?' },
      { topic: 'meaning', en: 'Why is she standing on a small man?', hi: 'वह एक छोटे आदमी पर क्यों खड़ी है?' },
    ],
  },
  {
    id: 'A008',
    accession: 'SHM 1963.5.4',
    name: 'Head of Vishnu',
    kind: 'sculpture',
    gallery: 'sculpture',
    period: 'Gupta, 5th century CE',
    region: 'Mathura, Uttar Pradesh',
    material: 'Sandstone',
    dimensions: 'H 38 cm',
    description:
      'A crowned head with half-closed eyes and a calm smile, carved at the height of Gupta classicism. The crown is decorated with a lion face and pearl strings.',
    appeal: 0.5,
    skipBias: 0.24,
    questions: [
      { topic: 'restoration', en: 'What happened to the rest of the statue?', hi: 'बाकी मूर्ति का क्या हुआ?' },
      { topic: 'meaning', en: 'Why are the eyes half closed?', hi: 'आँखें आधी बंद क्यों हैं?' },
    ],
  },
  {
    id: 'A009',
    accession: 'SHM 1970.2.19',
    name: 'Stele of Tara',
    kind: 'sculpture',
    gallery: 'sculpture',
    period: 'Pala, 9th century CE',
    region: 'Bihar',
    material: 'Black basalt',
    dimensions: 'H 71 cm',
    description: 'Stele showing the goddess Tara.',
    appeal: 0.42,
    skipBias: 0.38,
    thin: true,
    questions: [
      { topic: 'meaning', en: 'Who is Tara?', hi: 'तारा कौन हैं?' },
      { topic: 'meaning', en: 'Who are the small figures around her?', hi: 'उनके आसपास छोटी आकृतियाँ कौन हैं?' },
    ],
  },
  {
    id: 'A010',
    accession: 'SHM 1968.4.1',
    name: 'Madanika bracket figure',
    kind: 'sculpture',
    gallery: 'sculpture',
    period: 'Hoysala, 12th century CE',
    region: 'Belur, Karnataka',
    material: 'Chloritic schist',
    dimensions: 'H 102 cm',
    description:
      'A celestial dancer carved to sit under the eaves of a temple, framed by a creeper canopy. The soft soapstone let Hoysala sculptors cut jewellery as fine as metalwork.',
    appeal: 0.72,
    skipBias: 0.16,
    questions: [
      { topic: 'technique', en: 'How did they carve such fine jewellery in stone?', hi: 'पत्थर में इतने बारीक गहने कैसे तराशे?' },
      { topic: 'use', en: 'Where on the temple did this go?', hi: 'यह मंदिर में कहाँ लगी होती थी?' },
    ],
  },

  // G3 Bronzes
  {
    id: 'A011',
    accession: 'SHM 1951.1.1',
    name: 'Shiva as Nataraja',
    kind: 'bronze',
    gallery: 'bronze',
    period: 'Chola, c. 11th century CE',
    region: 'Thanjavur, Tamil Nadu',
    material: 'Bronze, lost-wax cast',
    dimensions: 'H 89 cm',
    description:
      'Shiva dances the cosmic dance within a ring of fire, holding the drum of creation and the flame of destruction, one foot on the dwarf of ignorance. It was made to be carried in temple processions.',
    appeal: 0.98,
    skipBias: 0.06,
    hardTag: true,
    questions: [
      { topic: 'meaning', en: 'Why does Nataraja have four arms?', hi: 'नटराज की चार भुजाएँ क्यों हैं?' },
      { topic: 'story', en: 'Who is the small figure under his foot?', hi: 'उनके पैर के नीचे छोटी आकृति कौन है?' },
      { topic: 'technique', en: 'What is lost-wax casting?', hi: 'लॉस्ट-वैक्स ढलाई क्या होती है?' },
      { topic: 'use', en: 'Why are there holes in the base?', hi: 'आधार में छेद क्यों हैं?' },
    ],
  },
  {
    id: 'A012',
    accession: 'SHM 1951.1.2',
    name: 'Parvati as Shivakami',
    kind: 'bronze',
    gallery: 'bronze',
    period: 'Chola, c. 11th century CE',
    region: 'Thanjavur, Tamil Nadu',
    material: 'Bronze, lost-wax cast',
    dimensions: 'H 71 cm',
    description:
      'Parvati stands in a graceful triple bend, her right hand once holding a flower. She was made as the companion to the Nataraja and processed beside him.',
    appeal: 0.7,
    skipBias: 0.15,
    hardTag: true,
    questions: [
      { topic: 'related', en: 'Is she Nataraja’s wife?', hi: 'क्या यह नटराज की पत्नी हैं?' },
      { topic: 'meaning', en: 'What was she holding?', hi: 'इनके हाथ में क्या था?' },
    ],
  },
  {
    id: 'A013',
    accession: 'SHM 1997.6.2',
    name: 'Dhokra horse',
    kind: 'bronze',
    gallery: 'bronze',
    period: '20th century',
    region: 'Bastar, Chhattisgarh',
    material: 'Brass, lost-wax cast with wax threads',
    dimensions: 'H 46 cm',
    description:
      'A stylised horse built up from fine wax threads before casting, a technique Dhokra metalsmiths have used for about 4,000 years. Horses are offered to village deities.',
    appeal: 0.62,
    skipBias: 0.2,
    questions: [
      { topic: 'technique', en: 'Is Dhokra still made today?', hi: 'क्या ढोकरा आज भी बनता है?' },
      { topic: 'related', en: 'Is this made the same way as the Dancing Girl?', hi: 'क्या यह नर्तकी की मूर्ति की तरह ही बनाया गया है?' },
    ],
  },
  {
    id: 'A014',
    accession: 'SHM 1974.3.6',
    name: 'Tirthankara Parshvanatha',
    kind: 'bronze',
    gallery: 'bronze',
    period: 'c. 10th century CE',
    region: 'Western India',
    material: 'Bronze with silver inlay',
    dimensions: 'H 33 cm',
    description:
      'The 23rd Jain Tirthankara seated in meditation under the seven hoods of a serpent, with silver-inlaid eyes. Serpent hoods identify Parshvanatha, who was sheltered by a naga during a storm.',
    appeal: 0.54,
    skipBias: 0.2,
    questions: [
      { topic: 'story', en: 'Why does he have snake hoods over his head?', hi: 'इनके सिर के ऊपर साँप के फन क्यों हैं?' },
      { topic: 'material', en: 'Why do the eyes shine?', hi: 'आँखें चमक क्यों रही हैं?' },
    ],
  },
  {
    id: 'A015',
    accession: 'SHM 1965.8.3',
    name: 'Seated Buddha',
    kind: 'bronze',
    gallery: 'bronze',
    period: 'Pala, 9th century CE',
    region: 'Nalanda, Bihar',
    material: 'Bronze',
    dimensions: 'H 28 cm',
    description:
      'The Buddha touches the earth to call it to witness his enlightenment. Small bronzes like this were cast at Nalanda and carried by pilgrims to Tibet and South-East Asia.',
    appeal: 0.58,
    skipBias: 0.2,
    questions: [
      { topic: 'meaning', en: 'Why is he touching the ground?', hi: 'यह ज़मीन को क्यों छू रहे हैं?' },
      { topic: 'related', en: 'Is this from Nalanda university?', hi: 'क्या यह नालंदा विश्वविद्यालय से है?' },
    ],
  },

  // G4 Miniature Paintings
  {
    id: 'A016',
    accession: 'SHM 1957.2.10',
    name: 'Akbar hunting with cheetahs',
    kind: 'painting',
    gallery: 'painting',
    period: 'Mughal, c. 1590',
    region: 'Lahore',
    material: 'Opaque watercolour and gold on paper',
    dimensions: '33 × 20 cm',
    description:
      'A page from an imperial history showing Akbar at a hunt with trained cheetahs. Mughal manuscripts were painted by teams: one artist drew the design, another coloured it, a third did the faces.',
    appeal: 0.8,
    skipBias: 0.13,
    questions: [
      { topic: 'maker', en: 'Who painted this?', hi: 'इसे किसने चित्रित किया?' },
      { topic: 'story', en: 'Did Akbar really hunt with cheetahs?', hi: 'क्या अकबर सच में चीतों के साथ शिकार करते थे?' },
    ],
  },
  {
    id: 'A017',
    accession: 'SHM 1960.4.7',
    name: 'Radha and Krishna in the grove',
    kind: 'painting',
    gallery: 'painting',
    period: 'Pahari (Kangra), c. 1780',
    region: 'Kangra, Himachal Pradesh',
    material: 'Opaque watercolour on paper',
    dimensions: '28 × 19 cm',
    description:
      'Radha and Krishna shelter beneath flowering trees as a storm gathers, painted in the lyrical Kangra style associated with the family of Nainsukh.',
    appeal: 0.76,
    skipBias: 0.14,
    questions: [
      { topic: 'meaning', en: 'Why is Krishna blue?', hi: 'कृष्ण नीले क्यों हैं?' },
      { topic: 'meaning', en: 'Why are there clouds and lightning?', hi: 'बादल और बिजली क्यों दिखाए गए हैं?' },
    ],
  },
  {
    id: 'A018',
    accession: 'SHM 1962.1.5',
    name: 'Todi Ragini, from a Ragamala',
    kind: 'painting',
    gallery: 'painting',
    period: 'Rajasthani (Bundi), c. 1680',
    region: 'Bundi, Rajasthan',
    material: 'Opaque watercolour on paper',
    dimensions: '25 × 18 cm',
    description:
      'A woman plays the veena in a forest and deer come close to listen. Ragamala paintings give each musical mode a scene, a mood and a time of day.',
    appeal: 0.6,
    skipBias: 0.18,
    questions: [
      { topic: 'media', en: 'Can I hear what Raga Todi sounds like?', hi: 'क्या मैं राग तोड़ी सुन सकता हूँ?' },
      { topic: 'meaning', en: 'Why are the deer listening?', hi: 'हिरण क्यों सुन रहे हैं?' },
    ],
  },
  {
    id: 'A019',
    accession: 'SHM 1979.5.1',
    name: 'Tanjore painting of Balakrishna',
    kind: 'painting',
    gallery: 'painting',
    period: '19th century',
    region: 'Thanjavur, Tamil Nadu',
    material: 'Gold foil, gesso and glass beads on wood',
    dimensions: '61 × 46 cm',
    description:
      'Infant Krishna eating butter, with raised gesso work covered in gold leaf and set with coloured glass. Tanjore paintings were made for household shrines.',
    appeal: 0.74,
    skipBias: 0.15,
    questions: [
      { topic: 'material', en: 'Is that real gold?', hi: 'क्या यह असली सोना है?' },
      { topic: 'technique', en: 'How is the gold raised like that?', hi: 'सोना इस तरह उभरा हुआ कैसे है?' },
    ],
  },
  {
    id: 'A020',
    accession: 'SHM 1988.2.2',
    name: 'Pattachitra of the Jagannath temple',
    kind: 'painting',
    gallery: 'painting',
    period: 'Early 20th century',
    region: 'Raghurajpur, Odisha',
    material: 'Natural pigments on primed cloth',
    dimensions: '120 × 88 cm',
    description:
      'A map-like painting of the Jagannath temple at Puri with the deities, pilgrims and festival chariots. It was sold to pilgrims as a souvenir of the journey.',
    appeal: 0.56,
    skipBias: 0.22,
    questions: [
      { topic: 'material', en: 'Where do the colours come from?', hi: 'ये रंग कहाँ से आते हैं?' },
      { topic: 'meaning', en: 'Why do the gods have big round eyes?', hi: 'भगवान की आँखें बड़ी और गोल क्यों हैं?' },
    ],
  },
  {
    id: 'A021',
    accession: 'SHM 1983.6.14',
    name: 'Company painting of a toddy tapper',
    kind: 'painting',
    gallery: 'painting',
    period: 'c. 1820',
    region: 'Patna, Bihar',
    material: 'Watercolour on paper',
    dimensions: '22 × 17 cm',
    description: 'Painting of a man climbing a palm tree.',
    appeal: 0.3,
    skipBias: 0.52,
    thin: true,
    questions: [
      { topic: 'maker', en: 'Who were Company painters?', hi: 'कंपनी चित्रकार कौन थे?' },
      { topic: 'use', en: 'Who bought paintings like this?', hi: 'ऐसी पेंटिंग कौन खरीदता था?' },
    ],
  },

  // G5 Arms & Armour
  {
    id: 'A022',
    accession: 'SHM 1953.9.1',
    name: 'Tiger-hilt talwar',
    kind: 'arms',
    gallery: 'arms',
    period: 'Late 18th century',
    region: 'Mysore, Karnataka',
    material: 'Watered steel, gold koftgari',
    dimensions: 'L 96 cm',
    description:
      'A curved sword whose hilt ends in a tiger head, with gold inlay on the blade. The tiger stripe motif, or bubri, is associated with the court of Mysore.',
    appeal: 0.9,
    skipBias: 0.08,
    questions: [
      { topic: 'provenance', en: 'Did this belong to Tipu Sultan?', hi: 'क्या यह टीपू सुल्तान की थी?' },
      { topic: 'material', en: 'What are the wavy lines on the blade?', hi: 'तलवार पर लहरदार रेखाएँ क्या हैं?' },
    ],
  },
  {
    id: 'A023',
    accession: 'SHM 1956.4.2',
    name: 'Mail and plate coat (zirah bagtar)',
    kind: 'arms',
    gallery: 'arms',
    period: '18th century',
    region: 'Rajasthan',
    material: 'Steel rings and plates, velvet lining',
    dimensions: 'H 84 cm',
    description:
      'Armour of riveted rings with steel plates over the chest, worn by Rajput cavalry. A full coat weighs about 12 kg.',
    appeal: 0.7,
    skipBias: 0.14,
    questions: [
      { topic: 'material', en: 'How heavy is this armour?', hi: 'यह कवच कितना भारी है?' },
      { topic: 'use', en: 'Could arrows go through it?', hi: 'क्या तीर इसके आर-पार जा सकते थे?' },
    ],
  },
  {
    id: 'A024',
    accession: 'SHM 1978.2.5',
    name: 'Wagh nakh (tiger claws)',
    kind: 'arms',
    gallery: 'arms',
    period: '18th century',
    region: 'Maharashtra',
    material: 'Steel',
    dimensions: 'L 11 cm',
    description:
      'A concealed weapon of four curved blades on a bar with two finger rings, hidden in the palm. It is famous from accounts of Shivaji’s meeting with Afzal Khan in 1659.',
    appeal: 0.88,
    skipBias: 0.08,
    questions: [
      { topic: 'story', en: 'Is this like Shivaji’s wagh nakh?', hi: 'क्या यह शिवाजी के वाघ नख जैसा है?' },
      { topic: 'use', en: 'How did people hold it?', hi: 'इसे कैसे पकड़ते थे?' },
    ],
  },
  {
    id: 'A025',
    accession: 'SHM 1964.7.9',
    name: 'Jade-hilted khanjar',
    kind: 'arms',
    gallery: 'arms',
    period: 'Mughal, 17th century',
    region: 'North India',
    material: 'Nephrite jade, steel, rubies',
    dimensions: 'L 37 cm',
    description:
      'A court dagger with a hilt carved as a horse head from pale jade and set with rubies. Daggers like this were worn as jewellery and given as marks of favour.',
    appeal: 0.66,
    skipBias: 0.16,
    questions: [
      { topic: 'use', en: 'Was this ever used in a fight?', hi: 'क्या इसका कभी लड़ाई में इस्तेमाल हुआ?' },
    ],
  },

  // G6 Coins
  {
    id: 'A026',
    accession: 'SHM 1950.1.33',
    name: 'Gold dinar of Samudragupta',
    kind: 'coin',
    gallery: 'coins',
    period: 'Gupta, c. 335–375 CE',
    region: 'North India',
    material: 'Gold',
    dimensions: 'D 2 cm, 7.8 g',
    description:
      'The king sits on a couch playing a veena, one of several coin types that show Samudragupta as a poet and musician as well as a conqueror.',
    appeal: 0.62,
    skipBias: 0.18,
    questions: [
      { topic: 'story', en: 'Why is the king playing a veena?', hi: 'राजा वीणा क्यों बजा रहे हैं?' },
      { topic: 'value', en: 'How much would this coin cost today?', hi: 'आज इस सिक्के की कीमत कितनी होगी?' },
    ],
  },
  {
    id: 'A027',
    accession: 'SHM 1950.1.2',
    name: 'Punch-marked coins',
    kind: 'coin',
    gallery: 'coins',
    period: 'c. 4th–2nd century BCE',
    region: 'Magadha',
    material: 'Silver',
    dimensions: 'Various',
    description:
      'Bent silver pieces stamped with symbols such as the sun, a six-armed wheel and a hill. They are the earliest coins of India.',
    appeal: 0.34,
    skipBias: 0.5,
    questions: [
      { topic: 'meaning', en: 'What do the symbols mean?', hi: 'इन चिन्हों का क्या मतलब है?' },
    ],
  },
  {
    id: 'A028',
    accession: 'SHM 1952.3.11',
    name: 'Square rupee of Akbar',
    kind: 'coin',
    gallery: 'coins',
    period: 'Mughal, 1584',
    region: 'Lahore mint',
    material: 'Silver',
    dimensions: '2 × 2 cm, 11.4 g',
    description:
      'A square silver rupee carrying a Persian inscription of the kalima and the mint name. Square coins were struck for a few years of Akbar’s reign.',
    appeal: 0.4,
    skipBias: 0.34,
    questions: [
      { topic: 'meaning', en: 'What is written on it?', hi: 'इस पर क्या लिखा है?' },
      { topic: 'story', en: 'Why is it square?', hi: 'यह चौकोर क्यों है?' },
    ],
  },
  {
    id: 'A029',
    accession: 'SHM 1955.2.20',
    name: 'Vijayanagara gold pagoda',
    kind: 'coin',
    gallery: 'coins',
    period: '16th century',
    region: 'Vijayanagara, Karnataka',
    material: 'Gold',
    dimensions: 'D 1.1 cm, 3.4 g',
    description:
      'A tiny thick gold coin showing Venkateshwara. Foreign traders called these coins pagodas, and they circulated along the whole southern coast.',
    appeal: 0.38,
    skipBias: 0.36,
    questions: [
      { topic: 'story', en: 'Why is it called a pagoda?', hi: 'इसे पगोडा क्यों कहते हैं?' },
    ],
  },

  // G7 Decorative Arts & Manuscripts
  {
    id: 'A030',
    accession: 'SHM 1967.5.3',
    name: 'Bidri huqqa base',
    kind: 'vessel',
    gallery: 'decorative',
    period: '18th century',
    region: 'Bidar, Karnataka',
    material: 'Zinc alloy with silver inlay',
    dimensions: 'H 18 cm',
    description:
      'A globe-shaped huqqa base with silver poppies inlaid in a black ground. The black comes from a paste of soil from the Bidar fort that darkens the alloy.',
    appeal: 0.48,
    skipBias: 0.24,
    questions: [
      { topic: 'technique', en: 'How is the metal made black?', hi: 'धातु को काला कैसे किया जाता है?' },
    ],
  },
  {
    id: 'A031',
    accession: 'SHM 1971.8.2',
    name: 'Gita Govinda palm-leaf manuscript',
    kind: 'manuscript',
    gallery: 'decorative',
    period: '18th century',
    region: 'Odisha',
    material: 'Incised palm leaf',
    dimensions: '35 × 4 cm per leaf',
    description:
      'Jayadeva’s 12th-century poem of Radha and Krishna, incised into palm leaves with a stylus and darkened with lamp-black. The leaves are strung together through holes.',
    appeal: 0.56,
    skipBias: 0.22,
    questions: [
      { topic: 'meaning', en: 'What language is this written in?', hi: 'यह किस भाषा में लिखा है?' },
      { topic: 'technique', en: 'How did they write on leaves?', hi: 'पत्तों पर कैसे लिखते थे?' },
    ],
  },
  {
    id: 'A032',
    accession: 'SHM 1958.9.1',
    name: 'Jade wine cup',
    kind: 'vessel',
    gallery: 'decorative',
    period: 'Mughal, mid-17th century',
    region: 'North India',
    material: 'White nephrite jade',
    dimensions: 'L 18 cm',
    description:
      'A gourd-shaped cup with a handle carved as an ibex head, in the style of the cup made for Shah Jahan. The jade is worked so thin it lets light through.',
    appeal: 0.72,
    skipBias: 0.14,
    questions: [
      { topic: 'provenance', en: 'Did Shah Jahan drink from this?', hi: 'क्या शाहजहाँ इसमें पीते थे?' },
      { topic: 'technique', en: 'How did they carve jade so thin?', hi: 'जेड को इतना पतला कैसे तराशा?' },
    ],
  },
  {
    id: 'A033',
    accession: 'SHM 1986.3.1',
    name: 'Saraswati veena',
    kind: 'instrument',
    gallery: 'decorative',
    period: 'Early 20th century',
    region: 'Thanjavur, Tamil Nadu',
    material: 'Jackwood, brass frets, painted decoration',
    dimensions: 'L 122 cm',
    description:
      'A seven-stringed veena carved from a single jackwood log, with a dragon head at the neck. It is the instrument held by Saraswati, goddess of learning.',
    appeal: 0.64,
    skipBias: 0.18,
    questions: [
      { topic: 'media', en: 'Can you play how this veena sounds?', hi: 'क्या आप इस वीणा की आवाज़ सुना सकते हैं?' },
      { topic: 'related', en: 'Is this the same as in the Todi Ragini painting?', hi: 'क्या यह तोड़ी रागिनी वाली पेंटिंग जैसी वीणा है?' },
    ],
  },

  // G8 Textiles
  {
    id: 'A034',
    accession: 'SHM 1990.4.6',
    name: 'Kanchipuram silk sari',
    kind: 'textile',
    gallery: 'textile',
    period: 'Mid-20th century',
    region: 'Kanchipuram, Tamil Nadu',
    material: 'Mulberry silk, silver-gilt zari',
    dimensions: '5.6 × 1.2 m',
    description:
      'A heavy silk sari with a contrasting border and pallu woven separately and interlocked, a joint that proves a true Kanchipuram. The temple-tower border is called gopuram.',
    appeal: 0.68,
    skipBias: 0.16,
    questions: [
      { topic: 'technique', en: 'How long does it take to weave one?', hi: 'एक साड़ी बुनने में कितना समय लगता है?' },
      { topic: 'material', en: 'Is the zari real silver?', hi: 'क्या ज़री असली चाँदी की है?' },
    ],
  },
  {
    id: 'A035',
    accession: 'SHM 1961.7.3',
    name: 'Kani shawl',
    kind: 'textile',
    gallery: 'textile',
    period: 'c. 1840',
    region: 'Kashmir',
    material: 'Pashmina goat wool',
    dimensions: '3.1 × 1.4 m',
    description:
      'A twill-tapestry shawl woven with hundreds of small wooden bobbins (kani), following a coded pattern called talim. One shawl could take two weavers more than a year.',
    appeal: 0.58,
    skipBias: 0.2,
    questions: [
      { topic: 'material', en: 'What is pashmina?', hi: 'पश्मीना क्या है?' },
      { topic: 'technique', en: 'What is a talim?', hi: 'तालीम क्या होती है?' },
    ],
  },
  {
    id: 'A036',
    accession: 'SHM 1975.1.9',
    name: 'Phulkari bagh',
    kind: 'textile',
    gallery: 'textile',
    period: 'Early 20th century',
    region: 'Punjab',
    material: 'Silk floss on hand-spun cotton',
    dimensions: '2.4 × 1.3 m',
    description:
      'A wedding shawl so densely darned in golden silk that the cotton ground disappears. A grandmother would begin a bagh when a granddaughter was born.',
    appeal: 0.52,
    skipBias: 0.22,
    questions: [
      { topic: 'story', en: 'Who made phulkaris?', hi: 'फुलकारी कौन बनाता था?' },
    ],
  },
  {
    id: 'A037',
    accession: 'SHM 1982.5.2',
    name: 'Kalamkari temple hanging',
    kind: 'textile',
    gallery: 'textile',
    period: '19th century',
    region: 'Srikalahasti, Andhra Pradesh',
    material: 'Mordant-dyed and painted cotton',
    dimensions: '2.8 × 1.6 m',
    description:
      'Scenes from the Ramayana drawn freehand with a bamboo pen (kalam) and dyed in stages with madder and indigo.',
    appeal: 0.46,
    skipBias: 0.24,
    questions: [
      { topic: 'technique', en: 'How many times was it dyed?', hi: 'इसे कितनी बार रंगा गया?' },
    ],
  },
  {
    id: 'A038',
    accession: 'SHM 1993.2.1',
    name: 'Patola sari',
    kind: 'textile',
    gallery: 'textile',
    period: 'Late 19th century',
    region: 'Patan, Gujarat',
    material: 'Double-ikat silk',
    dimensions: '5.2 × 1.1 m',
    description:
      'Both warp and weft threads were tie-dyed to the pattern before weaving, so the design appears the same on both sides. Patola were prized trade goods as far as Indonesia.',
    appeal: 0.5,
    skipBias: 0.22,
    questions: [
      { topic: 'technique', en: 'What is double ikat?', hi: 'डबल इकत क्या है?' },
    ],
  },
]

export const REVIEW_TAGS: Record<ReviewTag, { label: string; positive: boolean }> = {
  'tag-hard-to-find': { label: 'NFC tag hard to find', positive: false },
  'narration-long': { label: 'Narration too long', positive: false },
  'voice-quality': { label: 'Voice quality', positive: false },
  battery: { label: 'Battery ran out', positive: false },
  'slow-answers': { label: 'Slow answers', positive: false },
  'no-facilities': { label: 'No facilities info', positive: false },
  'wanted-more': { label: 'Wanted more depth', positive: false },
  'loved-child-mode': { label: 'Loved child mode', positive: true },
  'loved-language': { label: 'Own language', positive: true },
  'loved-questions': { label: 'Asking questions', positive: true },
  'easy-to-use': { label: 'Easy to use', positive: true },
}

export interface ReviewTemplate {
  tag: ReviewTag
  en: string
  hi?: string
}

export const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    tag: 'tag-hard-to-find',
    en: 'Could not find the tag on the bronze cases, had to tap three or four times.',
    hi: 'कांसे वाले केस पर टैग ढूंढना मुश्किल था, तीन-चार बार टैप करना पड़ा।',
  },
  { tag: 'tag-hard-to-find', en: 'The tag on the Nataraja case is too low, took a while to get it to read.' },
  { tag: 'narration-long', en: 'Detailed mode goes on for a long time. I switched to quick halfway.' },
  { tag: 'narration-long', en: 'Some stories are too long when you are standing in a crowd.', hi: 'भीड़ में खड़े होकर कुछ कहानियाँ बहुत लंबी लगती हैं।' },
  { tag: 'voice-quality', en: 'The Tamil voice sounded robotic and mispronounced some names.' },
  { tag: 'voice-quality', en: 'Pronunciation of temple names in Tamil was wrong in a few places.' },
  { tag: 'battery', en: 'Device battery died before I reached the textiles gallery.' },
  { tag: 'slow-answers', en: 'In the arms gallery answers took a long time to come.', hi: 'हथियारों वाली गैलरी में जवाब आने में बहुत देर लगी।' },
  { tag: 'no-facilities', en: 'I asked where the washroom was and it could not tell me.', hi: 'मैंने शौचालय पूछा तो इसे पता नहीं था।' },
  { tag: 'no-facilities', en: 'Would be good if it could guide to the lift, my mother uses a wheelchair.' },
  { tag: 'wanted-more', en: 'Wanted to know how the museum got these pieces, it never said.' },
  { tag: 'wanted-more', en: 'Asked if the sword was Tipu Sultan’s and it did not know.', hi: 'मैंने पूछा कि तलवार टीपू सुल्तान की है क्या, इसे नहीं पता था।' },
  { tag: 'loved-child-mode', en: 'My kids loved child mode and kept asking it questions all the way round!', hi: 'बच्चों को चाइल्ड मोड बहुत पसंद आया, पूरे रास्ते सवाल पूछते रहे!' },
  { tag: 'loved-child-mode', en: 'The school group was glued to it. Best museum trip we have done.' },
  { tag: 'loved-language', en: 'Wonderful to hear everything explained in Bengali.' },
  { tag: 'loved-language', en: 'Finally a museum guide in Marathi. My parents enjoyed it a lot.' },
  { tag: 'loved-language', en: 'Sehr gut, the German narration was clear and natural.' },
  { tag: 'loved-questions', en: 'Being able to ask questions felt like walking with a real guide.', hi: 'सवाल पूछ पाना ऐसा लगा जैसे असली गाइड साथ हो।' },
  { tag: 'loved-questions', en: 'I asked about the lost-wax process and got a great answer.' },
  { tag: 'easy-to-use', en: 'Very easy, just tap and listen. My grandfather used it without help.', hi: 'बहुत आसान है, बस टैप करो और सुनो।' },
]
