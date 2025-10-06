import type { CatalogStore } from "../types.js";

const VALUE_SYNONYMS: Record<string, string[]> = {
  sustainable: ["eco", "eco-friendly", "sustainable", "green", "earth-friendly"],
  handmade: ["handmade", "hand-crafted", "artisan", "artisanal"],
  local: ["local", "locally", "made nearby", "shop local"],
  vegan: ["vegan", "plant-based"],
  luxury: ["luxury", "premium"],
  organic: ["organic"],
  fair_trade: ["fair trade", "fair-trade"],
  recycled: ["recycled", "upcycled"],
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Comprehensive interest → category/facet mapping
const INTEREST_MAPPINGS: Record<string, { categories: string[]; interests: string[]; keywords: RegExp }> = {
  gardening: {
    categories: ['Flowers & Plants', 'Home & Garden'],
    interests: ['gardening'],
    keywords: /\b(garden|gardening|plant|plants|flower|flowers|seed|seeds|grow|growing|botanical|horticulture|landscap)\b/i
  },
  cooking: {
    categories: ['Home & Garden', 'Food & Beverages'],
    interests: ['cooking'],
    keywords: /\b(cook|cooking|kitchen|baking|bake|chef|culinary|recipe|recipes|cookware|utensils?)\b/i
  },
  reading: {
    categories: ['Books & Media'],
    interests: ['reading'],
    keywords: /\b(read|reading|reader|book|books|novel|novels|literature|library|bibliophile)\b/i
  },
  art: {
    categories: ['Art & Crafts', 'Home & Garden'],
    interests: ['art'],
    keywords: /\b(art|artist|artistic|paint|painting|draw|drawing|sketch|craft|crafting|creative)\b/i
  },
  music: {
    categories: ['Music & Instruments', 'Electronics & Gadgets'],
    interests: ['music'],
    keywords: /\b(music|musician|musical|instrument|guitar|piano|sing|singing|concert|vinyl|record)\b/i
  },
  fitness: {
    categories: ['Sports & Outdoors', 'Health & Beauty'],
    interests: ['fitness'],
    keywords: /\b(fitness|workout|exercise|gym|yoga|pilates|running|runner|athletic|sports?)\b/i
  },
  travel: {
    categories: ['Travel & Luggage', 'Books & Media'],
    interests: ['travel'],
    keywords: /\b(travel|traveling|traveler|wanderlust|adventure|adventurous|trip|trips|vacation|journey)\b/i
  },
  photography: {
    categories: ['Electronics & Gadgets', 'Art & Crafts'],
    interests: ['photography'],
    keywords: /\b(photo|photography|photographer|camera|cameras|lens|lenses|snapshot)\b/i
  },
  gaming: {
    categories: ['Toys & Games', 'Electronics & Gadgets'],
    interests: ['gaming'],
    keywords: /\b(game|games|gaming|gamer|video game|board game|puzzle|puzzles)\b/i
  },
  coffee: {
    categories: ['Food & Beverages', 'Home & Garden'],
    interests: ['coffee'],
    keywords: /\b(coffee|espresso|cappuccino|latte|barista|brew|brewing|caffeine)\b/i
  },
  tea: {
    categories: ['Food & Beverages', 'Home & Garden'],
    interests: ['tea'],
    keywords: /\b(tea|chai|matcha|herbal|steep|steeping|teapot)\b/i
  },
  wine: {
    categories: ['Food & Beverages', 'Home & Garden'],
    interests: ['wine'],
    keywords: /\b(wine|wines|winery|vineyard|sommelier|vintage wine)\b/i
  },
  pets: {
    categories: ['Pet Supplies'],
    interests: ['pets'],
    keywords: /\b(pet|pets|dog|dogs|cat|cats|puppy|puppies|kitten|kittens|animal)\b/i
  },
  tech: {
    categories: ['Electronics & Gadgets', 'Office & Stationery'],
    interests: ['tech'],
    keywords: /\b(tech|technology|gadget|gadgets|electronics?|computer|coding|programming|software)\b/i
  },
  fashion: {
    categories: ['Clothing & Accessories', 'Jewelry & Watches'],
    interests: ['fashion'],
    keywords: /\b(fashion|fashionable|style|stylish|trendy|chic|designer|accessori)\b/i
  },
  outdoors: {
    categories: ['Sports & Outdoors', 'Travel & Luggage'],
    interests: ['outdoors'],
    keywords: /\b(outdoor|outdoors|hiking|camping|nature|wilderness|trail|mountain)\b/i
  },
  skincare: {
    categories: ['Health & Beauty', 'Wellness & Self-Care'],
    interests: ['skincare'],
    keywords: /\b(skincare|skin care|beauty|cosmetic|facial|serum|moisturizer|spa)\b/i
  },
  fishing: {
    categories: ['Sports & Outdoors', 'Art & Crafts'],
    interests: ['fishing'],
    keywords: /\b(fish|fishing|fisherman|angler|angling|lure|bait|tackle|rod|reel|catch)\b/i
  },
  hunting: {
    categories: ['Sports & Outdoors'],
    interests: ['hunting'],
    keywords: /\b(hunt|hunting|hunter|outdoor|wildlife)\b/i
  },
  camping: {
    categories: ['Sports & Outdoors', 'Travel & Luggage'],
    interests: ['camping'],
    keywords: /\b(camp|camping|camper|tent|hik|backpack|trail)\b/i
  }
};

export async function extractFromText(text: string, catalog?: CatalogStore): Promise<{ categories?: string[]; values?: string[]; interests?: string[] }> {
  const out: { categories?: string[]; values?: string[]; interests?: string[] } = {};
  const ntext = normalize(text);

  // Values
  const values: string[] = [];
  for (const [canonical, synonyms] of Object.entries(VALUE_SYNONYMS)) {
    for (const syn of synonyms) {
      const ns = normalize(syn);
      if (ntext.includes(ns)) { values.push(canonical); break; }
    }
  }
  if (values.length) out.values = Array.from(new Set(values));

  // Extract interests and map to categories
  const matchedCategories = new Set<string>();
  const matchedInterests = new Set<string>();

  for (const [key, mapping] of Object.entries(INTEREST_MAPPINGS)) {
    if (mapping.keywords.test(text)) {
      mapping.categories.forEach(c => matchedCategories.add(c));
      mapping.interests.forEach(i => matchedInterests.add(i));
    }
  }

  // Categories from catalog (direct matches)
  try {
    if (catalog && (await catalog.listCategories()).length) {
      const cats = await catalog.listCategories();
      for (const c of cats) {
        const nc = normalize(c);
        if (!nc) continue;
        // match words or phrases directly
        if (nc.length >= 3 && ntext.includes(nc)) matchedCategories.add(c);
      }
      // Validate extracted categories exist in catalog
      const validCategories = Array.from(matchedCategories).filter(c =>
        cats.some(cat => normalize(cat) === normalize(c))
      );
      if (validCategories.length) out.categories = validCategories.slice(0, 8);
    } else {
      // No catalog, use matched categories as-is
      if (matchedCategories.size) out.categories = Array.from(matchedCategories).slice(0, 8);
    }
  } catch {
    // Fallback: use matched categories as-is
    if (matchedCategories.size) out.categories = Array.from(matchedCategories).slice(0, 8);
  }

  if (matchedInterests.size) out.interests = Array.from(matchedInterests);

  return out;
}

const RECIPIENT_MAP: Record<string, string[]> = {
  sister: ["sister", "sis"],
  brother: ["brother", "bro"],
  partner: ["partner", "boyfriend", "girlfriend", "fiance", "fiancé", "fiancee", "spouse"],
  wife: ["wife"],
  husband: ["husband"],
  mother: ["mother", "mom", "mum", "mommy"],
  father: ["father", "dad", "daddy"],
  grandma: ["grandma", "grandmother", "granny", "nana"],
  grandpa: ["grandpa", "grandfather", "grandad"],
  nephew: ["nephew"],
  niece: ["niece"],
  cousin: ["cousin"],
  aunt: ["aunt", "auntie"],
  uncle: ["uncle"],
  parent: ["parent", "parents"],
  friend: ["friend", "best friend", "bff"],
  colleague: ["colleague", "coworker", "co-worker", "boss", "manager", "team", "teammate"],
  daughter: ["daughter"],
  son: ["son"],
  child: ["child", "kid"],
};

export function extractRecipient(text: string): string | undefined {
  const t = normalize(text);
  for (const [key, syns] of Object.entries(RECIPIENT_MAP)) {
    for (const s of syns) {
      const ns = normalize(s);
      if (t.includes(ns)) return key;
    }
  }
  return undefined;
}

const OCCASION_MAP: Record<string, string[]> = {
  birthday: ["birthday", "bday", "b-day"],
  anniversary: ["anniversary"],
  wedding: ["wedding", "bride", "groom", "marriage"],
  christmas: ["christmas", "xmas"],
  valentine: ["valentine", "valentines"],
  "mother's day": ["mother's day", "mothers day"],
  "father's day": ["father's day", "fathers day"],
  graduation: ["graduation", "graduating"],
  "baby shower": ["baby shower"],
  housewarming: ["housewarming", "house warming"],
  retirement: ["retirement", "retiring"],
  "thank you": ["thank you", "thanks"],
};

export function extractOccasion(text: string): string | undefined {
  const t = normalize(text);
  for (const [key, syns] of Object.entries(OCCASION_MAP)) {
    for (const s of syns) {
      const ns = normalize(s);
      if (t.includes(ns)) return key;
    }
  }
  return undefined;
}

// Build search query hints based on recipient type to filter out inappropriate items
const RECIPIENT_SEARCH_HINTS: Record<string, string> = {
  colleague: "professional office appropriate workplace desk",
  boss: "professional elegant sophisticated tasteful office",
  manager: "professional office appropriate desk executive",
  coworker: "professional office appropriate workplace desk",
  mother: "thoughtful home comfort spa relaxation",
  mom: "thoughtful home comfort spa relaxation",
  father: "practical tools hobby outdoor gadget",
  dad: "practical tools hobby outdoor gadget",
  sister: "personal fashion beauty jewelry accessories",
  brother: "tech gaming hobby sports entertainment",
  grandma: "comfort cozy home warmth sentimental",
  grandpa: "classic comfort hobby traditional nostalgic",
  wife: "romantic thoughtful jewelry elegant spa",
  husband: "thoughtful quality hobby tech personalized",
  partner: "romantic thoughtful personal meaningful quality",
  friend: "fun personal entertainment shared experience",
  daughter: "special meaningful keepsake jewelry personal",
  son: "hobby interest entertainment tech sports",
  nephew: "fun age-appropriate educational entertainment",
  niece: "fun age-appropriate creative educational",
  child: "age-appropriate fun educational creative safe",
  kid: "age-appropriate fun educational creative safe"
};

export function buildRecipientSearchHints(recipientKey?: string): string {
  if (!recipientKey) return '';
  return RECIPIENT_SEARCH_HINTS[recipientKey] || '';
}

// Filter out inappropriate products based on recipient type
// Be specific - only exclude truly inappropriate items, not general party/seasonal items
const RECIPIENT_EXCLUDE_PATTERNS: Record<string, RegExp[]> = {
  colleague: [
    /\b(sexy|lingerie|intimate|gag gift|prank|bachelor|bachelorette|drinking game)\b/i,
    /\b(pirate costumes?|halloween costumes?|dress-up costumes?|adult costumes?)\b/i,
    /\b(tablecloth|party supply|party supplies)\b/i
  ],
  boss: [
    /\b(sexy|lingerie|intimate|gag gift|prank|bachelor|bachelorette|drinking game|cheap|budget)\b/i,
    /\b(pirate costumes?|halloween costumes?|dress-up costumes?|adult costumes?)\b/i,
    /\b(tablecloth|party supply|party supplies)\b/i
  ],
  manager: [
    /\b(sexy|lingerie|intimate|gag gift|prank|bachelor|bachelorette|drinking game)\b/i,
    /\b(pirate costumes?|halloween costumes?|dress-up costumes?|adult costumes?)\b/i,
    /\b(tablecloth|party supply|party supplies)\b/i
  ],
  coworker: [
    /\b(sexy|lingerie|intimate|gag gift|prank|bachelor|bachelorette|drinking game)\b/i,
    /\b(pirate costumes?|halloween costumes?|dress-up costumes?|adult costumes?)\b/i,
    /\b(tablecloth|party supply|party supplies)\b/i
  ],
};

export function filterInappropriateProducts(products: any[], recipientKey?: string): any[] {
  if (!recipientKey) return products;
  const excludePatterns = RECIPIENT_EXCLUDE_PATTERNS[recipientKey];
  if (!excludePatterns || excludePatterns.length === 0) return products;

  return products.filter(p => {
    const product = p.product || p;
    const searchText = [
      product.title,
      product.name,
      product.category,
      product.description,
      ...(product.tags || [])
    ].filter(Boolean).join(' ').toLowerCase();

    return !excludePatterns.some(pattern => pattern.test(searchText));
  });
}

// Detect emotional context in user message
export function detectEmotionalContext(text: string): {
  anxiety?: boolean;
  excitement?: boolean;
  uncertainty?: boolean;
  urgency?: boolean;
  celebration?: boolean;
} {
  const t = text.toLowerCase();

  return {
    anxiety: /\b(stress|anxious|worry|worried|nervous|help|stuck|overwhelm)\b/.test(t),
    excitement: /(!{2,}|exciting|amazing|wonderful|can't wait|so happy|thrilled|love|excited)/i.test(t),
    uncertainty: /\b(not sure|don't know|don't really know|maybe|unsure|no idea|clueless|unclear)\b/.test(t),
    urgency: /\b(tomorrow|tonight|today|asap|urgent|last minute|forgot|quickly|quick|rush|need fast)\b/.test(t),
    celebration: /\b(birthday|anniversary|graduation|wedding|milestone|special|celebrate)\b/.test(t)
  };
}

// Build empathetic intro based on emotional context
export function buildEmpatheticIntro(emotional: ReturnType<typeof detectEmotionalContext>): string | null {
  if (emotional.urgency && emotional.anxiety) {
    const options = [
      "Okay, deep breath—I've got you! Let's find something great, fast.",
      "No worries, we'll find something perfect quickly!",
      "I've got you covered! Let's make this easy and fast."
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (emotional.anxiety) {
    const options = [
      "Totally get it, gift shopping can be stressful. Let's make this easy.",
      "I hear you—finding the right gift can be tough. Let's figure this out together.",
      "No stress—I'm here to help make this simple."
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (emotional.excitement || emotional.celebration) {
    const options = [
      "How exciting! Let's find something really special.",
      "Love the energy! Let's find something perfect.",
      "This is such a great occasion! Let's make it memorable."
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (emotional.uncertainty) {
    const options = [
      "No worries, that's what I'm here for! Let's figure this out together.",
      "Totally normal—I'll help you narrow it down.",
      "That's okay! We'll find something they'll love."
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  return null;
}

// Detect significant milestones
const MILESTONE_PATTERNS = {
  bigBirthday: /\b(50th|60th|70th|80th|90th|100th|milestone|big birthday)\b/i,
  anniversary: /\b(\d+)(th|st|nd|rd)?\s*anniversary\b/i,
  firstTime: /\b(first|1st)\s+(mother'?s?\s+day|father'?s?\s+day|christmas|birthday|time)\b/i,
  graduation: /\b(graduation|graduating|graduate|diploma|degree)\b/i,
  wedding: /\b(wedding|bride|groom|marriage|married|getting married|engagement|engaged)\b/i,
  newBaby: /\b(baby|newborn|pregnancy|expecting|baby shower|new mom|new dad|new parent)\b/i,
  promotion: /\b(promotion|new job|got the job|starting new)\b/i,
  housewarming: /\b(housewarming|new house|new home|new place|just moved|first house)\b/i
};

export function celebrateMilestone(text: string): string | null {
  const t = text.toLowerCase();

  if (MILESTONE_PATTERNS.bigBirthday.test(text)) {
    return "Wow, that's a special milestone! Let's make it memorable.";
  }

  const anniversaryMatch = text.match(MILESTONE_PATTERNS.anniversary);
  if (anniversaryMatch) {
    const years = parseInt(anniversaryMatch[1]);
    if (years >= 25) {
      return `${years} years—that's incredible! This deserves something really special.`;
    }
    if (years >= 10) {
      return `${years} years together! Let's find something meaningful.`;
    }
    return "What a wonderful milestone to celebrate!";
  }

  if (MILESTONE_PATTERNS.firstTime.test(text)) {
    return "A first—that's so special! Let's find something they'll treasure.";
  }

  if (MILESTONE_PATTERNS.graduation.test(t)) {
    return "Graduation! That's huge—let's find something they'll treasure.";
  }

  if (MILESTONE_PATTERNS.wedding.test(t)) {
    return "Such an exciting time! Let's find the perfect gift.";
  }

  if (MILESTONE_PATTERNS.newBaby.test(t)) {
    return "A new baby—how exciting! Let's find something thoughtful.";
  }

  if (MILESTONE_PATTERNS.promotion.test(t)) {
    return "New job! That's worth celebrating properly.";
  }

  if (MILESTONE_PATTERNS.housewarming.test(t)) {
    return "New home! Let's find something they'll actually use and love.";
  }

  return null;
}
