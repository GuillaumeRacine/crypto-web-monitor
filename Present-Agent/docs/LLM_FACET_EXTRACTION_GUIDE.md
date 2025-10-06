# LLM Guide: Product Facet Extraction for Gift Recommendations

**For: LLM agents performing automated facet extraction from product data**

This document provides comprehensive instructions for extracting gift-relevant facets from product information using LLMs (Claude, GPT-4, etc.). Proper facet extraction is **critical** for accurate recommendations.

---

## Table of Contents

1. [What Are Facets?](#what-are-facets)
2. [Why Facets Matter](#why-facets-matter)
3. [Facet Schema](#facet-schema)
4. [Extraction Guidelines by Facet Type](#extraction-guidelines-by-facet-type)
5. [Confidence Scoring](#confidence-scoring)
6. [Prompt Templates](#prompt-templates)
7. [Examples: Step-by-Step Extraction](#examples-step-by-step-extraction)
8. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
9. [Batch Processing Strategy](#batch-processing-strategy)
10. [Quality Assurance](#quality-assurance)

---

## What Are Facets?

**Facets** are gift-relevant attributes extracted from product data. They answer questions like:

- **Recipient**: Who is this gift appropriate for?
- **Occasion**: What events/celebrations is this suitable for?
- **Interest**: What hobbies/activities does this relate to?
- **Value**: What ethical/aesthetic values does this represent?
- **Theme**: What visual/conceptual style does this have?

### Example

**Product**: "Personalized Leather Fishing Lure Making Kit - Handcrafted Artisan Set"

**Extracted Facets**:
```json
{
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.85},
    {"key": "recipient", "value": "friend", "confidence": 0.90},
    {"key": "recipient", "value": "dad", "confidence": 0.75},
    {"key": "occasion", "value": "birthday", "confidence": 0.70},
    {"key": "occasion", "value": "father_day", "confidence": 0.80},
    {"key": "interest", "value": "fishing", "confidence": 0.95},
    {"key": "interest", "value": "art", "confidence": 0.70},
    {"key": "value", "value": "handmade", "confidence": 1.0},
    {"key": "value", "value": "personalized", "confidence": 1.0},
    {"key": "theme", "value": "rustic", "confidence": 0.65}
  ]
}
```

---

## Why Facets Matter

### 1. Enable Precise Matching

Without facets:
```
Query: "birthday gift for friend who loves fishing"
→ Keyword match on "fishing"
→ Returns any product mentioning fishing
```

With facets:
```
Query: "birthday gift for friend who loves fishing"
→ recipient=friend (boost +0.3)
→ occasion=birthday (boost +0.4)
→ interest=fishing (boost +0.3)
→ Total boost: +1.0 for perfect match!
```

### 2. Cross-Category Discovery

A "Lure Making Kit" in "Art & Crafts" category matches fishing queries because it has `interest=fishing` facet.

### 3. Personalization

Graph database stores: "User123 gifted products with interest=fishing to recipient=friend 3 times, all rated 5 stars"
→ Future "friend" queries boost `interest=fishing` products

### 4. Explainability

Rationales come from facets:
> "Why: Perfect for birthdays. Great gift for a friend. Ideal for fishing enthusiasts. Handmade choice."

---

## Facet Schema

### Database Structure

```sql
CREATE TABLE product_facets (
  product_id TEXT NOT NULL,
  facet_key TEXT NOT NULL,
  facet_value TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  PRIMARY KEY (product_id, facet_key, facet_value)
);

CREATE INDEX idx_facets_key_value ON product_facets(facet_key, facet_value);
```

### Facet Keys (5 types)

| Key | Purpose | Cardinality |
|-----|---------|-------------|
| `recipient` | Who to give this to | Multiple values per product |
| `occasion` | When to give this | Multiple values per product |
| `interest` | What hobbies/activities | Multiple values per product |
| `value` | Ethical/aesthetic attributes | Multiple values per product |
| `theme` | Visual/conceptual style | Usually 1-2 per product |

### Allowed Values

#### Recipient Values

```
him, her, them, kids, baby, toddler, teen, friend, best_friend,
close_friend, mom, mother, dad, father, parents, grandma, grandpa,
grandparents, sister, brother, sibling, aunt, uncle, cousin,
wife, husband, spouse, partner, girlfriend, boyfriend,
colleague, coworker, boss, employee, teacher, mentor, client,
neighbor, host, hostess
```

**Guidelines**:
- Use **multiple recipient values** when appropriate (e.g., "him", "friend", "dad")
- "Them" for gender-neutral products
- Relationship terms (friend, colleague) are often more useful than gender (him/her)

#### Occasion Values

```
birthday, anniversary, wedding, engagement, graduation,
retirement, promotion, new_job, baby_shower, bridal_shower,
christmas, hanukkah, kwanzaa, new_year, valentine,
mother_day, father_day, easter, thanksgiving,
house_warming, host_gift, thank_you, apology, sympathy,
get_well, congratulations, just_because, milestone
```

**Guidelines**:
- A product can fit **multiple occasions**
- "Just_because" is for everyday gifting
- Religious holidays should be tagged conservatively (only if explicitly themed)

#### Interest Values

```
fishing, hunting, camping, hiking, outdoors, sports,
gaming, video_games, board_games,
cooking, baking, grilling, wine, beer, coffee, tea,
gardening, plants, flowers,
art, painting, drawing, crafts, diy,
music, musical_instruments, singing,
reading, books, writing,
photography, travel, adventure,
fitness, yoga, running, cycling,
pets, dogs, cats,
tech, gadgets, electronics,
fashion, beauty, skincare, makeup,
home_decor, organization, cleaning,
movies, tv_shows, anime,
collectibles, antiques, vintage
```

**Guidelines**:
- Be **specific** (not just "sports", but "fishing", "cycling", etc.)
- **Multiple interests** are common (fishing lure kit → fishing + art)
- Infer from **activity** not just category (cookbook → cooking, not books)

#### Value Values

```
sustainable, eco_friendly, organic, fair_trade, recycled, upcycled,
handmade, artisan, handcrafted,
personalized, customized, engraved, monogrammed,
luxury, premium, high_end, designer,
minimalist, simple, clean, modern,
quirky, unique, unusual, creative, original, playful,
practical, functional, useful,
sentimental, meaningful, thoughtful,
local, small_business, indie,
vintage, retro, nostalgic, classic,
tech_savvy, innovative, cutting_edge,
relaxing, spa, wellness, self_care,
educational, learning, stem
```

**Guidelines**:
- Values are **attributes**, not product types
- Can have **many values** (sustainable + handmade + personalized)
- "Luxury" needs high price point AND premium branding
- "Practical" vs "Sentimental" are opposites (can both apply if versatile)

#### Theme Values

```
rustic, farmhouse, country,
modern, contemporary, sleek,
vintage, retro, antique,
elegant, sophisticated, classy,
playful, fun, whimsical,
minimalist, simple, zen,
bohemian, boho, eclectic,
industrial, urban, edgy,
nautical, coastal, beach,
tropical, exotic,
romantic, feminine, delicate,
masculine, bold, rugged,
seasonal, holiday, festive,
nature, earthy, organic,
geometric, abstract, artistic
```

**Guidelines**:
- Theme is about **aesthetics**, not function
- Usually **1-2 themes** per product
- Look at visual appearance, materials, design language

---

## Extraction Guidelines by Facet Type

### Recipient Extraction

#### Evidence Sources (in priority order)

1. **Product Title/Name**
   - "Men's Fishing Rod" → `him` (confidence: 1.0)
   - "Mom's Kitchen Apron" → `mom` (confidence: 1.0)
   - "Kids' Art Set" → `kids` (confidence: 1.0)

2. **Product Description**
   - "Perfect gift for him" → `him` (confidence: 0.9)
   - "Your dad will love this" → `dad` (confidence: 0.85)
   - "Great for friends and family" → `friend`, `family` (confidence: 0.7)

3. **Category/Collection**
   - "Men's Accessories" → `him` (confidence: 0.8)
   - "Father's Day Collection" → `dad` (confidence: 0.85)
   - "Gifts for Her" → `her` (confidence: 0.85)

4. **Implicit Signals**
   - Masculine design (dark colors, rugged) → `him` (confidence: 0.4)
   - Feminine design (pink, floral) → `her` (confidence: 0.4)
   - Child-safe, educational → `kids` (confidence: 0.6)

#### Decision Tree

```
Does title/description explicitly mention recipient? (e.g., "for him", "dad's")
├─ YES → Extract with confidence 0.9-1.0
└─ NO
    ├─ Is it in a gendered category? (e.g., "Men's", "Women's")
    │   ├─ YES → Extract with confidence 0.7-0.8
    │   └─ NO
    │       ├─ Does it have gendered design cues? (colors, style)
    │       │   ├─ YES → Extract with confidence 0.3-0.5
    │       │   └─ NO → Mark as "them" (gender-neutral)
    └─ Does it mention relationships? (e.g., "great for colleagues")
        ├─ YES → Extract relationship with confidence 0.7-0.8
        └─ NO → Infer from typical use case
```

#### Examples

**Product**: "Personalized Men's Leather Wallet - Groomsman Gift"
```json
[
  {"key": "recipient", "value": "him", "confidence": 1.0},      // "Men's"
  {"key": "recipient", "value": "friend", "confidence": 0.85},  // "Groomsman"
  {"key": "recipient", "value": "husband", "confidence": 0.7},  // Wallet + wedding context
  {"key": "recipient", "value": "boyfriend", "confidence": 0.7}
]
```

**Product**: "Unisex Bluetooth Headphones"
```json
[
  {"key": "recipient", "value": "them", "confidence": 1.0},     // "Unisex"
  {"key": "recipient", "value": "teen", "confidence": 0.6},     // Common tech gift
  {"key": "recipient", "value": "friend", "confidence": 0.5}
]
```

**Product**: "Mom Mug - Best Mom Ever"
```json
[
  {"key": "recipient", "value": "mom", "confidence": 1.0},      // Explicit
  {"key": "recipient", "value": "mother", "confidence": 1.0}    // Synonym
]
```

### Occasion Extraction

#### Evidence Sources

1. **Explicit Mentions**
   - "Birthday Gift Set" → `birthday` (confidence: 1.0)
   - "Wedding Present" → `wedding` (confidence: 1.0)
   - "Christmas Ornament" → `christmas` (confidence: 1.0)

2. **Collection/Category**
   - "Mother's Day Collection" → `mother_day` (confidence: 0.9)
   - "Holiday Décor" → seasonal occasions (confidence: 0.7)

3. **Product Function**
   - Thank you card → `thank_you` (confidence: 0.9)
   - Sympathy flowers → `sympathy` (confidence: 0.9)
   - Baby blanket → `baby_shower` (confidence: 0.7)

4. **Universal Gifting**
   - Most products fit: `birthday`, `just_because`
   - Don't over-tag; only if it makes sense

#### Occasion Confidence Levels

- **1.0**: Product explicitly themed for occasion ("Happy Birthday Banner")
- **0.8-0.9**: Product commonly given for occasion (flowers → valentine)
- **0.6-0.7**: Product could work but not specific (coffee mug → any occasion)
- **0.4-0.5**: Generic item rarely given for this occasion

#### Examples

**Product**: "Red Roses Bouquet - 24 Long-Stem"
```json
[
  {"key": "occasion", "value": "valentine", "confidence": 0.95},       // Classic valentine gift
  {"key": "occasion", "value": "anniversary", "confidence": 0.85},     // Romantic
  {"key": "occasion", "value": "apology", "confidence": 0.75},         // Traditional
  {"key": "occasion", "value": "birthday", "confidence": 0.65},        // Common
  {"key": "occasion", "value": "just_because", "confidence": 0.6}
]
```

**Product**: "Engraved Retirement Plaque - Years of Service"
```json
[
  {"key": "occasion", "value": "retirement", "confidence": 1.0}        // Explicit
]
```

**Product**: "Wireless Speaker - Portable Bluetooth"
```json
[
  {"key": "occasion", "value": "birthday", "confidence": 0.7},         // Common birthday gift
  {"key": "occasion", "value": "graduation", "confidence": 0.65},      // Tech for grads
  {"key": "occasion", "value": "christmas", "confidence": 0.6},        // Holiday gift
  {"key": "occasion", "value": "just_because", "confidence": 0.55}
]
```

### Interest Extraction

#### How to Identify Interests

1. **Primary Use Case**
   - Fishing rod → `fishing`
   - Cookbook → `cooking`
   - Yoga mat → `yoga`

2. **Activity Mentioned**
   - "Perfect for your next camping trip" → `camping`
   - "Great for gamers" → `gaming`
   - "Ideal for photography enthusiasts" → `photography`

3. **Category Inference**
   - "Sports & Outdoors" → may have specific sports interests
   - "Arts & Crafts" → `art`, `crafts`, `diy`
   - "Kitchen & Dining" → `cooking`, `baking`, etc.

4. **Keywords in Title/Description**
   - "Lure", "tackle", "bait" → `fishing`
   - "Recipe", "chef", "culinary" → `cooking`
   - "Canvas", "paint", "brush" → `painting`, `art`

#### Multi-Interest Products

Many products serve **multiple interests**:

**Example**: "Lure Making Kit"
```json
[
  {"key": "interest", "value": "fishing", "confidence": 0.95},   // Primary
  {"key": "interest", "value": "art", "confidence": 0.70},       // Crafting aspect
  {"key": "interest", "value": "diy", "confidence": 0.75},       // Making things
  {"key": "interest", "value": "crafts", "confidence": 0.70}
]
```

**Example**: "Vegetarian Grilling Cookbook"
```json
[
  {"key": "interest", "value": "cooking", "confidence": 0.95},
  {"key": "interest", "value": "grilling", "confidence": 0.90},
  {"key": "interest", "value": "reading", "confidence": 0.60}    // It's a book
]
```

#### Interest Hierarchy

Some interests are **broader** than others:

- `outdoors` (broad) → `fishing`, `camping`, `hiking` (specific)
- `sports` (broad) → `running`, `cycling`, `swimming` (specific)
- `art` (broad) → `painting`, `drawing`, `sculpting` (specific)

**Best Practice**: Extract **both** broad and specific when applicable:

**Example**: "Camping Tent"
```json
[
  {"key": "interest", "value": "camping", "confidence": 1.0},    // Specific
  {"key": "interest", "value": "outdoors", "confidence": 0.85}   // Broad
]
```

This helps matching:
- "Camping gifts" matches via `camping`
- "Outdoor enthusiast" matches via `outdoors`

### Value Extraction

#### Value Categories

Values fall into several categories:

1. **Ethical/Environmental**
   - sustainable, eco_friendly, organic, fair_trade, recycled, upcycled

2. **Craftsmanship**
   - handmade, artisan, handcrafted, small_business, indie, local

3. **Personalization**
   - personalized, customized, engraved, monogrammed

4. **Quality/Luxury**
   - luxury, premium, high_end, designer

5. **Aesthetic Style**
   - minimalist, quirky, unique, creative, playful

6. **Function/Purpose**
   - practical, useful, functional, educational, relaxing, sentimental

7. **Innovation**
   - tech_savvy, innovative, cutting_edge

#### Evidence for Values

**Sustainable**:
- Materials: bamboo, recycled plastic, organic cotton
- Keywords: "eco", "green", "earth-friendly", "sustainable"
- Certifications: Fair Trade, B Corp, Carbon Neutral

**Handmade**:
- Description: "handcrafted", "made by hand", "artisan"
- Vendor: Etsy shops, local artisans, craft markets
- **NOT**: Mass-produced brands (Nike, Apple)

**Personalized**:
- Options: engraving, monogramming, custom text
- Keywords: "add your name", "personalize it", "custom"

**Luxury**:
- Price: >$200 for small items, >$500 for large
- Brand: Designer names (Gucci, Tiffany, Hermès)
- Materials: Gold, silver, diamonds, Italian leather
- **NOT**: Mid-tier brands at high prices

**Practical**:
- Function-focused (tools, organizers, everyday items)
- NOT decorative or collectible
- Solves a problem

**Sentimental**:
- Emotional value (keepsakes, memory books, photo albums)
- Personalization often increases sentimentality
- Can overlap with practical (personalized keychain)

#### Examples

**Product**: "Fair Trade Organic Coffee Beans - Small Batch Roasted"
```json
[
  {"key": "value", "value": "fair_trade", "confidence": 1.0},
  {"key": "value", "value": "organic", "confidence": 1.0},
  {"key": "value", "value": "sustainable", "confidence": 0.85},
  {"key": "value", "value": "small_business", "confidence": 0.75}
]
```

**Product**: "Engraved Wooden Photo Frame - Custom Family Name"
```json
[
  {"key": "value", "value": "personalized", "confidence": 1.0},
  {"key": "value", "value": "customized", "confidence": 1.0},
  {"key": "value", "value": "engraved", "confidence": 1.0},
  {"key": "value", "value": "sentimental", "confidence": 0.9},
  {"key": "value", "value": "handmade", "confidence": 0.7}         // If handcrafted
]
```

**Product**: "Minimalist Desk Organizer - Sleek Modern Design"
```json
[
  {"key": "value", "value": "minimalist", "confidence": 1.0},
  {"key": "value", "value": "modern", "confidence": 0.95},
  {"key": "value", "value": "practical", "confidence": 0.85},
  {"key": "value", "value": "functional", "confidence": 0.85}
]
```

### Theme Extraction

Themes describe **visual/aesthetic style**, not function.

#### How to Extract Themes

1. **Visual Appearance**
   - Look at product images (if available)
   - Materials: Wood → rustic, Metal → industrial, Glass → elegant

2. **Design Language**
   - "Clean lines" → minimalist, modern
   - "Ornate details" → elegant, vintage
   - "Weathered finish" → rustic, farmhouse

3. **Color Palette**
   - Earth tones → rustic, nature
   - Pastels → romantic, delicate, playful
   - Monochrome → minimalist, modern
   - Bright colors → playful, fun

4. **Keywords**
   - "Shabby chic" → vintage, romantic
   - "Mid-century modern" → retro, modern
   - "Industrial loft" → industrial, urban

#### Theme Confidence

- **1.0**: Product name includes theme ("Rustic Farmhouse Table")
- **0.8-0.9**: Description clearly describes theme
- **0.6-0.7**: Theme inferred from materials/style
- **0.4-0.5**: Weak theme signal

#### Examples

**Product**: "Reclaimed Wood Wall Art - Industrial Metal Frame"
```json
[
  {"key": "theme", "value": "rustic", "confidence": 0.9},
  {"key": "theme", "value": "industrial", "confidence": 0.85}
]
```

**Product**: "White Marble Vase - Sleek Contemporary Design"
```json
[
  {"key": "theme", "value": "modern", "confidence": 0.95},
  {"key": "theme", "value": "minimalist", "confidence": 0.85},
  {"key": "theme", "value": "elegant", "confidence": 0.75}
]
```

**Product**: "Tropical Flamingo Pool Float - Pink & Bright"
```json
[
  {"key": "theme", "value": "tropical", "confidence": 1.0},
  {"key": "theme", "value": "playful", "confidence": 0.9},
  {"key": "theme", "value": "fun", "confidence": 0.9}
]
```

---

## Confidence Scoring

### Confidence Scale

| Score | Meaning | Example |
|-------|---------|---------|
| **1.0** | Absolute certainty | Product title says "Men's Wallet" → recipient:him |
| **0.9** | Very high confidence | Description says "Perfect gift for him" |
| **0.8** | High confidence | Product in "Father's Day Collection" |
| **0.7** | Good confidence | Strong inference from context |
| **0.6** | Moderate confidence | Reasonable inference |
| **0.5** | Weak confidence | Possible but uncertain |
| **0.4** | Very weak | Minimal evidence |
| **0.3** | Speculative | Based on very weak signals |
| **<0.3** | Don't extract | Too uncertain to be useful |

### Confidence Calculation Factors

#### Factor 1: Evidence Strength

- **Explicit statement** = +0.4 to 1.0
- **Strong implication** = +0.3 to 0.6
- **Weak inference** = +0.1 to 0.3

#### Factor 2: Evidence Sources (cumulative)

- **Title mentions it** = +0.3
- **Description mentions it** = +0.2
- **Category implies it** = +0.1
- **Visual/material cues** = +0.1

#### Factor 3: Ambiguity Penalty

- **Ambiguous language** = -0.2 (e.g., "great for everyone")
- **Multiple interpretations** = -0.1
- **Conflicting signals** = -0.2

### Confidence Examples

#### Example 1: High Confidence Chain

**Product**: "Personalized Men's Fishing Rod - Custom Engraving"

**Recipient: him**
- Title says "Men's" = +0.4
- Fishing is male-coded activity = +0.2
- No conflicting signals = 0
- **Total: 0.9 → round to 0.9**

**Interest: fishing**
- Title says "Fishing Rod" = +0.5
- Primary function is fishing = +0.4
- No ambiguity = 0
- **Total: 0.95 → round to 0.95**

**Value: personalized**
- Title says "Personalized" = +0.5
- Offers "Custom Engraving" = +0.4
- Explicit feature = 0
- **Total: 1.0 (cap)**

#### Example 2: Medium Confidence

**Product**: "Bluetooth Speaker - Portable & Waterproof"

**Recipient: them**
- No gender signals = +0.5 (default neutral)
- Widely used by all = 0
- **Total: 0.7**

**Recipient: teen**
- Tech product popular with teens = +0.3
- But also used by adults = -0.1
- **Total: 0.6**

**Interest: music**
- Speaker → music = +0.4
- Primary function = +0.2
- **Total: 0.8**

**Value: practical**
- Waterproof = useful feature = +0.3
- Portable = functional = +0.3
- **Total: 0.7**

#### Example 3: Low Confidence (Don't Extract)

**Product**: "Blue T-Shirt - 100% Cotton"

**Recipient: him**
- Blue is somewhat masculine = +0.2
- But blue is worn by all genders = -0.1
- **Total: 0.25 → TOO LOW, don't extract**

**Better approach**: Mark as `them` (gender-neutral) with confidence 0.7

---

## Prompt Templates

### Template 1: Single Product Extraction

```
Analyze this product and extract gift-relevant facets:

Title: {product.title}
Description: {product.description}
Category: {product.category}
Vendor: {product.vendor}
Price: ${product.price}

Extract the following facets (only if clearly applicable):

1. **recipient**: Who is this gift appropriate for? (e.g., him, her, friend, mom, dad, kids)
2. **occasion**: What occasions is this suitable for? (e.g., birthday, wedding, christmas)
3. **interest**: What hobbies/activities does this relate to? (e.g., fishing, cooking, gaming)
4. **value**: What ethical/aesthetic values does this represent? (e.g., sustainable, handmade, luxury)
5. **theme**: What visual/conceptual style? (e.g., rustic, modern, playful)

For each facet:
- Provide confidence score 0.0-1.0 (minimum 0.5 to include)
- Can extract multiple values per facet key
- Be specific and conservative

Return JSON only:
{
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.9},
    {"key": "interest", "value": "fishing", "confidence": 0.95}
  ]
}
```

### Template 2: Batch Extraction (for efficiency)

```
Analyze these 10 products and extract gift-relevant facets for each.

Products:
1. Title: "{title1}", Description: "{desc1}", Category: "{cat1}"
2. Title: "{title2}", Description: "{desc2}", Category: "{cat2}"
...
10. Title: "{title10}", Description: "{desc10}", Category: "{cat10}"

For each product, extract:
- recipient (who to gift to)
- occasion (when to give)
- interest (hobbies/activities)
- value (ethical/aesthetic attributes)
- theme (visual style)

Only include facets with confidence ≥ 0.5.

Return JSON array:
[
  {
    "product_id": 1,
    "facets": [
      {"key": "recipient", "value": "him", "confidence": 0.9},
      ...
    ]
  },
  ...
]
```

### Template 3: Targeted Extraction (for specific facet type)

```
Analyze this product and identify all INTERESTS it relates to:

Title: {product.title}
Description: {product.description}
Category: {product.category}

What hobbies, activities, or lifestyle interests does this product serve?

Allowed values: fishing, cooking, gaming, gardening, art, music, reading, photography,
travel, fitness, pets, tech, fashion, home_decor, crafts, etc.

Return JSON:
{
  "interests": [
    {"value": "fishing", "confidence": 0.95, "reasoning": "Primary product function"},
    {"value": "outdoors", "confidence": 0.80, "reasoning": "Outdoor activity"}
  ]
}
```

---

## Examples: Step-by-Step Extraction

### Example 1: "Lure Making Kit - Handcrafted Artisan Set"

**Step 1: Read Product Data**
```
Title: "Lure Making Kit - Handcrafted Artisan Set"
Description: "Create your own custom fishing lures with this premium handmade kit.
Includes all materials needed for crafting 10 unique lures. Perfect gift for the
fisherman in your life who appreciates artisan quality."
Category: "Art & Crafts"
Vendor: "Artisan Workshop"
Price: $99.99
```

**Step 2: Extract Recipients**
- "fisherman in your life" → `him` (confidence: 0.85, fishing is male-coded)
- "Perfect gift for" → `friend` (confidence: 0.90, common gifting relationship)
- Fishing context → `dad` (confidence: 0.75, common Father's Day gift)

**Step 3: Extract Occasions**
- Not explicitly mentioned, but:
- Father's Day context → `father_day` (confidence: 0.75)
- Premium price → `birthday` (confidence: 0.70)
- No strong occasion signal → be conservative

**Step 4: Extract Interests**
- "fishing lures" → `fishing` (confidence: 0.95, primary function)
- "Create your own" → `diy` (confidence: 0.85)
- "crafting" → `crafts` (confidence: 0.80)
- Category "Art & Crafts" → `art` (confidence: 0.70)

**Step 5: Extract Values**
- "Handcrafted" → `handmade` (confidence: 1.0, explicit)
- "Artisan" → `artisan` (confidence: 1.0)
- "premium" → `luxury` (confidence: 0.70, premium ≠ luxury but high quality)
- Vendor "Artisan Workshop" → `small_business` (confidence: 0.75)

**Step 6: Extract Themes**
- "Artisan" + "Handcrafted" → `rustic` (confidence: 0.65)
- Creative/DIY aspect → `creative` (confidence: 0.70)

**Final Output**:
```json
{
  "product_id": "8739924738283",
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.85},
    {"key": "recipient", "value": "friend", "confidence": 0.90},
    {"key": "recipient", "value": "dad", "confidence": 0.75},
    {"key": "occasion", "value": "father_day", "confidence": 0.75},
    {"key": "occasion", "value": "birthday", "confidence": 0.70},
    {"key": "interest", "value": "fishing", "confidence": 0.95},
    {"key": "interest", "value": "diy", "confidence": 0.85},
    {"key": "interest", "value": "crafts", "confidence": 0.80},
    {"key": "interest", "value": "art", "confidence": 0.70},
    {"key": "value", "value": "handmade", "confidence": 1.0},
    {"key": "value", "value": "artisan", "confidence": 1.0},
    {"key": "value", "value": "luxury", "confidence": 0.70},
    {"key": "value", "value": "small_business", "confidence": 0.75},
    {"key": "theme", "value": "rustic", "confidence": 0.65},
    {"key": "theme", "value": "creative", "confidence": 0.70}
  ]
}
```

### Example 2: "Organic Fair Trade Coffee Beans"

**Product Data**:
```
Title: "Organic Fair Trade Coffee Beans - Small Batch Roasted"
Description: "Ethically sourced organic coffee beans from sustainable farms.
Fair trade certified. Perfect for coffee lovers who care about the environment."
Category: "Food & Beverages"
Price: $24.99
```

**Extraction**:

**Recipients**:
- "coffee lovers" → `them` (confidence: 0.85, gender-neutral)
- Could be anyone → `friend` (confidence: 0.70)
- Common coworker gift → `colleague` (confidence: 0.65)

**Occasions**:
- "Perfect for" implies gifting → `thank_you` (confidence: 0.70)
- Modest price → `just_because` (confidence: 0.65)

**Interests**:
- Coffee → `coffee` (confidence: 1.0)
- No other interests

**Values**:
- "Organic" → `organic` (confidence: 1.0)
- "Fair Trade" → `fair_trade` (confidence: 1.0)
- "sustainable farms" → `sustainable` (confidence: 0.95)
- "Ethically sourced" → `eco_friendly` (confidence: 0.85)
- "Small Batch" → `small_business` (confidence: 0.75)

**Themes**:
- Not applicable (food item, no visual theme)

**Final Output**:
```json
{
  "facets": [
    {"key": "recipient", "value": "them", "confidence": 0.85},
    {"key": "recipient", "value": "friend", "confidence": 0.70},
    {"key": "recipient", "value": "colleague", "confidence": 0.65},
    {"key": "occasion", "value": "thank_you", "confidence": 0.70},
    {"key": "occasion", "value": "just_because", "confidence": 0.65},
    {"key": "interest", "value": "coffee", "confidence": 1.0},
    {"key": "value", "value": "organic", "confidence": 1.0},
    {"key": "value", "value": "fair_trade", "confidence": 1.0},
    {"key": "value", "value": "sustainable", "confidence": 0.95},
    {"key": "value", "value": "eco_friendly", "confidence": 0.85},
    {"key": "value", "value": "small_business", "confidence": 0.75}
  ]
}
```

---

## Common Mistakes to Avoid

### Mistake 1: Over-Extraction (Too Many Low-Confidence Facets)

**Bad**:
```json
{
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.3},
    {"key": "recipient", "value": "her", "confidence": 0.3},
    {"key": "recipient", "value": "kids", "confidence": 0.2},
    {"key": "recipient", "value": "mom", "confidence": 0.25},
    // Too many weak signals!
  ]
}
```

**Good**:
```json
{
  "facets": [
    {"key": "recipient", "value": "them", "confidence": 0.85}
    // Gender-neutral, high confidence
  ]
}
```

**Rule**: Minimum confidence = 0.5. If unsure, use broader category (him/her → them).

### Mistake 2: Confusing Category with Interest

**Bad**:
```
Product: "Cookbook - Italian Recipes"
Interest: "books"  ❌
```

**Good**:
```
Interest: "cooking"  ✅
Interest: "reading" (secondary, confidence 0.6)
```

**Rule**: Interest = what hobby/activity, not product type. A cookbook is FOR cooking, not FOR book collecting.

### Mistake 3: Treating Budget as Value

**Bad**:
```
Product: "Affordable T-Shirt - $10"
Value: "cheap"  ❌
Value: "budget"  ❌
Value: "affordable"  ❌
```

**Good**:
```
Value: "practical" (if applicable)
(Budget is captured in price field, not value facet)
```

**Rule**: Values are qualities (sustainable, luxury), not price points.

### Mistake 4: Being Too Literal with Luxury

**Bad**:
```
Product: "$200 Designer Sunglasses"
Value: "luxury" confidence 1.0  ❌ (Not quite luxury tier)
```

**Good**:
```
Value: "premium" confidence 0.85  ✅
Value: "designer" confidence 0.90  ✅
```

**Rule**: Reserve "luxury" for truly high-end (Hermès, Tiffany, etc.). Use "premium" or "designer" for mid-to-high tier.

### Mistake 5: Ignoring Multi-Category Products

**Bad**:
```
Product: "Yoga Mat with Meditation Guide Book"
Interest: "yoga"  (missed "reading")
```

**Good**:
```
Interest: "yoga" confidence 0.95
Interest: "meditation" confidence 0.85
Interest: "reading" confidence 0.60  (it includes a book)
```

**Rule**: Extract ALL applicable interests, even secondary ones.

### Mistake 6: Gender Assumptions Without Evidence

**Bad**:
```
Product: "Blue Coffee Mug"
Recipient: "him" confidence 0.7  ❌ (Blue ≠ masculine)
```

**Good**:
```
Recipient: "them" confidence 0.85  ✅ (Gender-neutral product)
```

**Rule**: Only extract gendered recipients if there's STRONG evidence (explicit mention, clearly gendered category, overwhelmingly gendered use case).

### Mistake 7: Weak Theme Extraction

**Bad**:
```
Product: "Stainless Steel Water Bottle"
Theme: "modern" confidence 0.4  ❌ (Too weak, don't extract)
```

**Good**:
```
Value: "practical" confidence 0.85  ✅
(Skip theme if confidence < 0.5)
```

**Rule**: Themes need clear visual/aesthetic signals. Functional products may not have themes.

---

## Batch Processing Strategy

### Script: `scripts/auto-facet-extraction.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function extractFacetsWithLLM(product: Product) {
  const prompt = `Analyze this product and extract gift-relevant facets:

Title: ${product.title}
Description: ${product.description || 'N/A'}
Category: ${product.category || 'N/A'}
Vendor: ${product.vendor || 'N/A'}
Price: $${product.price}

Extract facets: recipient, occasion, interest, value, theme
Minimum confidence: 0.5

Return JSON only:
{
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.9}
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(text);
  return parsed.facets;
}

async function processBatch(products: Product[]) {
  const batchSize = 5; // Process 5 at a time
  const delay = 1000; // 1 second between batches

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    await Promise.all(batch.map(async (product) => {
      try {
        const facets = await extractFacetsWithLLM(product);

        // Upsert facets
        for (const facet of facets) {
          await pool.query(`
            INSERT INTO product_facets (product_id, facet_key, facet_value, confidence)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (product_id, facet_key, facet_value)
            DO UPDATE SET confidence = EXCLUDED.confidence
          `, [product.id, facet.key, facet.value, facet.confidence]);
        }

        console.log(`✅ Extracted ${facets.length} facets for product ${product.id}`);
      } catch (error) {
        console.error(`❌ Failed to extract facets for product ${product.id}:`, error);
      }
    }));

    // Rate limiting
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Run
const { rows: products } = await pool.query('SELECT * FROM products LIMIT 1000');
await processBatch(products);
await pool.end();
```

### Best Practices for Batch Processing

1. **Rate Limiting**: Add 1-2 second delays between batches to avoid API throttling
2. **Error Handling**: Catch and log errors, don't fail the entire batch
3. **Progress Tracking**: Log success/failure for each product
4. **Resumability**: Track processed product IDs to resume if interrupted
5. **Validation**: Check JSON parsing and facet schema before inserting

---

## Quality Assurance

### Validation Checklist

After extraction, validate:

- [ ] All facets have `key`, `value`, `confidence`
- [ ] Confidence is between 0.5 and 1.0
- [ ] Facet keys are from allowed list (recipient, occasion, interest, value, theme)
- [ ] Facet values are from allowed vocabularies (or reasonable extensions)
- [ ] No duplicates (same product_id + key + value)
- [ ] Confidence matches evidence (high confidence → strong evidence)

### Sample Quality Check Query

```sql
-- Find products with low-confidence facets (should be rare)
SELECT p.title, pf.facet_key, pf.facet_value, pf.confidence
FROM products p
JOIN product_facets pf ON p.id = pf.product_id
WHERE pf.confidence < 0.6
ORDER BY pf.confidence ASC
LIMIT 50;

-- Find products with no facets (may need manual review)
SELECT p.id, p.title, p.category
FROM products p
LEFT JOIN product_facets pf ON p.id = pf.product_id
WHERE pf.product_id IS NULL
LIMIT 50;

-- Find products with many facets (verify not over-extracted)
SELECT p.id, p.title, COUNT(*) as facet_count
FROM products p
JOIN product_facets pf ON p.id = pf.product_id
GROUP BY p.id, p.title
HAVING COUNT(*) > 15
ORDER BY facet_count DESC;
```

### Manual Spot Check

Regularly review 10-20 random products:
1. Do extracted facets make sense?
2. Are confidence scores reasonable?
3. Are important facets missing?
4. Are there too many weak facets?

### Iterative Improvement

1. **Week 1**: Extract facets for 1,000 products
2. **Week 2**: Spot check 50 products, identify issues
3. **Week 3**: Refine prompts, re-extract flagged products
4. **Week 4**: Expand to 10,000 products

---

## Summary

### Key Principles

1. **Be Conservative**: Only extract facets with confidence ≥ 0.5
2. **Be Specific**: "fishing" > "sports", "birthday" > "occasion"
3. **Be Comprehensive**: Extract all applicable facets (multi-interest products)
4. **Be Evidence-Based**: Confidence reflects evidence strength
5. **Be Consistent**: Use standardized vocabulary, not free text

### Quick Reference

| Facet Type | Purpose | Examples | Typical Count |
|------------|---------|----------|---------------|
| recipient | Who to gift to | him, her, friend, mom, dad | 1-4 per product |
| occasion | When to give | birthday, wedding, christmas | 2-5 per product |
| interest | Hobbies/activities | fishing, cooking, gaming | 1-4 per product |
| value | Ethical/aesthetic | sustainable, handmade, luxury | 1-6 per product |
| theme | Visual style | rustic, modern, playful | 1-2 per product |

### Next Steps

1. Review extraction examples in this guide
2. Test on 10 sample products manually
3. Refine prompts based on results
4. Run batch extraction on 100 products
5. Validate and iterate
6. Scale to full catalog

---

**See also**:
- `LLM_RECOMMENDATION_GUIDE.md` - How facets are used in recommendations
- `PERSONALIZATION_RECOMMENDATIONS.md` - Future personalization techniques
- `FACETS.md` - Facet system architecture
