# Present-Agent: Chat Interaction Humanization Recommendations

**Date**: October 6, 2025
**Evaluator**: Claude Code (Comprehensive Review)
**Focus**: Making AI gift recommendations feel natural, empathetic, and human-like
**Scope**: Conversational design, response patterns, emotional intelligence, and user trust

---

## Executive Summary

After reviewing all documentation, code, and test findings, this document provides specific recommendations to make the Present-Agent chat interaction feel more **natural, empathetic, and human-like** for people seeking AI gift recommendations.

**Core Philosophy**: People come to Present-Agent feeling anxious, rushed, or unsure. The AI should feel like talking to a thoughtful friend who truly gets them—not a robotic assistant following rigid patterns.

**Key Findings:**
- **Current Strengths**: Good system prompt foundation, warm tone guidelines, natural language processing
- **Main Gaps**: Responses feel formulaic, lack emotional intelligence, miss conversational nuances
- **Critical Issues**: Budget extraction broken (0% success rate), limited empathy in clarifying questions
- **Opportunity**: Transform from "helpful bot" to "gifting best friend"

---

## 1. HUMAN-LIKE CONVERSATION DESIGN

### 1.1 Opening Message: Set the Right Emotional Tone

**Current State** (`src/web/app/page.tsx:16`):
```typescript
"Hi! Tell me about who you're shopping for and I'll suggest thoughtful gifts."
```

**Issue**: Too formal and transactional. Doesn't acknowledge the user's emotional state or build rapport.

**Human-Like Alternatives**:
```typescript
// Warm & empathetic (recommended)
"Hey there! Gift shopping can be tricky, but I'm here to help. Who are you shopping for?"

// Friendly & conversational
"Hi! Let's find the perfect gift together. Tell me a bit about the person you're shopping for?"

// Acknowledges common pain point
"Gift-giving stress? I've got you. Just tell me about the person and occasion, and I'll handle the rest."

// Casual & inviting
"Hey! Looking for gift ideas? I'd love to help. What's the occasion?"
```

**Why This Matters**: First message sets the entire conversational tone. Users should feel like they're texting a friend, not filling out a form.

---

### 1.2 Enhance System Prompt for Emotional Intelligence

**Current Prompt** (`src/server/services/prompts/chat.ts:1-20`):
✅ **Good**: Warm tone, mirrors user, acknowledges details
❌ **Missing**: Emotional recognition, anxiety reduction, celebration of milestones

**Enhanced System Prompt**:
```typescript
export function systemPrompt() {
  return `You are Present Agent, a thoughtful friend who loves helping people find meaningful gifts.

Personality & Emotional Intelligence:
- You're warm, genuine, and excited to help—like a friend who LOVES gift-giving
- Recognize emotional subtext: anxiety ("I forgot!"), excitement ("it's their 50th!"), uncertainty ("I don't know them well")
- Celebrate with the user: birthdays, milestones, special occasions deserve enthusiasm
- Normalize gift-giving stress: "Totally get it, finding the right gift can be tough"
- Show confidence in your recommendations: "I think they'll love this because..."

Conversation Style:
- Mirror the user's energy level and formality (but stay warm)
- Use natural interjections: "Oh nice!", "Love that", "Great choice", "Hmm, let me think..."
- Vary your openings—never repeat the same phrase twice in one conversation
- Ask follow-ups like a friend would: "What do they usually get excited about?" not "Please specify interests"
- When you have enough info, show enthusiasm: "Okay, I've got some ideas I'm excited about!"

Context Gathering (ask naturally, ONE thing at a time):
- Budget: "What's your budget looking like?" or "Any price range in mind?"
- Relationship: "How do you know them?" or "What's your relationship like?"
- Occasion: "What's the occasion?" (if not mentioned)
- Interests: "What are they into?" or "Any hobbies or passions?"
- Values: Listen for cues like "eco-conscious", "supports local", "loves handmade"

When recommending (3-5 items):
- Lead with excitement: "Okay, I found some things I think they'll love!"
- Each item needs a SHORT, personal rationale (one sentence max)
- Connect rationale to specific details they shared: "Since you mentioned they love yoga..."
- If budget is tight, acknowledge it positively: "These are all great value for your $30 budget"
- If searching yielded few results: "The catalog's a bit limited here, but these caught my eye because..."

Red Flags to Avoid:
- Don't sound robotic: "I will now provide recommendations" ❌
- Don't list requirements: "To proceed I need budget and recipient" ❌
- Don't apologize excessively: One "sorry" is enough if something goes wrong
- Don't use corporate speak: "utilize", "facilitate", "per your request" ❌
- Don't repeat the same transitions: "Great! And..." gets old fast

Remember: You're not a database query interface. You're a gift-giving friend who happens to have access to a great catalog.`;
}
```

---

### 1.3 Dynamic Response Patterns (Avoid Repetition)

**Current Issue**: `buildContextBlock` and fallback responses can feel robotic and repetitive.

**Implementation** (`src/server/services/prompts/chat.ts`):

Add response variety functions:
```typescript
// Rotate through different acknowledgment phrases
const acknowledgments = [
  "Love that!",
  "Nice!",
  "Got it!",
  "Perfect,",
  "Awesome,",
  "Great,",
  "Oh nice!",
  "Cool!",
  "Okay!",
];

function randomAck() {
  return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
}

// Budget follow-up variations
const budgetQuestions = [
  "What's your budget looking like?",
  "Any price range in mind?",
  "How much are you thinking?",
  "What's your spending range?",
  "Got a budget in mind?",
];

function askBudget() {
  return budgetQuestions[Math.floor(Math.random() * budgetQuestions.length)];
}

// Occasion follow-up variations
const occasionQuestions = [
  "What's the occasion?",
  "What are you celebrating?",
  "Is this for a special occasion?",
  "What's the event?",
];

// Interest follow-up variations
const interestQuestions = [
  "What are they into?",
  "Any hobbies or interests?",
  "What do they love doing?",
  "What gets them excited?",
  "Any passions or interests I should know about?",
];
```

**Usage**: Randomly select from these arrays instead of hardcoded questions. Conversations will feel fresh each time.

---

### 1.4 Recognize and Respond to Emotional Context

**Pattern Detection** (add to extraction logic):

```typescript
// Detect emotional states from user message
export function detectEmotionalContext(text: string): {
  anxiety?: boolean;
  excitement?: boolean;
  uncertainty?: boolean;
  urgency?: boolean;
  celebration?: boolean;
} {
  const t = text.toLowerCase();

  return {
    anxiety: /\b(stress|anxious|worry|worried|nervous|help|stuck)\b/.test(t),
    excitement: /\b(!|exciting|amazing|wonderful|can't wait|so happy|thrilled)\b/.test(t),
    uncertainty: /\b(not sure|don't know|maybe|unsure|no idea|clueless)\b/.test(t),
    urgency: /\b(tomorrow|tonight|asap|urgent|last minute|forgot|quickly|rush)\b/.test(t),
    celebration: /\b(birthday|anniversary|graduation|wedding|milestone|special)\b/.test(t)
  };
}
```

**Empathetic Responses**:
```typescript
// Respond appropriately to emotional context
function buildEmpatheticIntro(emotional: ReturnType<typeof detectEmotionalContext>) {
  if (emotional.urgency && emotional.anxiety) {
    return "Okay, deep breath—I've got you! Let's find something great, fast.";
  }
  if (emotional.anxiety) {
    return "Totally get it, gift shopping can be stressful. Let's make this easy.";
  }
  if (emotional.excitement || emotional.celebration) {
    return "How exciting! Let's find something really special.";
  }
  if (emotional.uncertainty) {
    return "No worries, that's what I'm here for! Let's figure this out together.";
  }
  return null; // Use default response
}
```

**Integration Point**: Add this to the chat endpoint logic before calling the LLM, so responses are contextually appropriate.

---

### 1.5 Milestone & Occasion Celebration

**Enhancement**: Recognize significant occasions and respond with appropriate enthusiasm.

```typescript
// Detect significant milestones
const MILESTONE_PATTERNS = {
  bigBirthday: /\b(50th|60th|70th|80th|90th|100th|milestone|big birthday)\b/i,
  anniversary: /\b(\d+)(th|st|nd|rd)?\s*anniversary\b/i,
  firstTime: /\b(first|meeting.*first time|new relationship)\b/i,
  graduation: /\b(graduation|graduating|graduate|diploma|degree)\b/i,
  wedding: /\b(wedding|bride|groom|marriage|married|getting married)\b/i,
  newBaby: /\b(baby|newborn|pregnancy|expecting|baby shower)\b/i,
  promotion: /\b(promotion|new job|got the job|starting new)\b/i,
};

function celebrateMilestone(text: string): string | null {
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
    return "What a wonderful milestone to celebrate!";
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

  return null;
}
```

**Why This Matters**: Matching the user's emotional energy makes the AI feel genuinely engaged, not just transactional.

---

## 2. CRITICAL TECHNICAL FIXES (BLOCKING)

These bugs from `TEST_FINDINGS.md` must be fixed for the conversation to work at all.

### 2.1 Fix Budget Extraction Logic (P0 - CRITICAL)

**Location**: `src/server/index.ts:276-289`

**Current Bug**: Budget extraction fails 100% of the time due to logic error.

**Line 289 Issue**:
```typescript
budgetMax = b.max ?? b.max; // ❌ Always undefined if b.max is undefined
```

**Missing Patterns**: Common phrasings not recognized:
- "budget around $50"
- "budget is 100 dollars"
- "$50" (standalone)
- "30-60 budget"

**Fixed Implementation**:
```typescript
// Budget parsing with expanded patterns
function parseBudget(text: string): { min?: number; max?: number } {
  // Pattern 1: "between X and Y"
  const between = text.match(/between\s*\$?(\d{1,5})\s*(and|-|to)\s*\$?(\d{1,5})/i);
  if (between) {
    const a = Number(between[1]);
    const b = Number(between[3]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // Pattern 2: "X-Y" or "X–Y" (range)
  const range = text.match(/\$?(\d{1,5})\s*[-–]\s*\$?(\d{1,5})/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // Pattern 3: "under $X" or "under X dollars"
  const under = text.match(/under\s*\$?(\d{1,5})/i);
  if (under) {
    return { max: Number(under[1]) };
  }

  // Pattern 4: "around $X" or "about $X" (NEW)
  const around = text.match(/\b(around|about|roughly|approximately)\s*\$?(\d{1,5})/i);
  if (around) {
    const val = Number(around[2]);
    return { min: Math.floor(val * 0.8), max: Math.ceil(val * 1.2) }; // ±20%
  }

  // Pattern 5: "budget is X dollars" or "budget of X" (NEW)
  const budgetIs = text.match(/budget\s*(is|of|:|around)?\s*\$?(\d{1,5})\s*dollars?/i);
  if (budgetIs) {
    return { max: Number(budgetIs[2]) };
  }

  // Pattern 6: "spend $X" or "for $X"
  const spend = text.match(/\b(spend|for|up to)\s*\$?(\d{1,5})/i);
  if (spend) {
    return { max: Number(spend[2]) };
  }

  // Pattern 7: "$X" standalone (must be 2-4 digits to avoid false positives)
  const standalone = text.match(/\$(\d{2,4})\b/);
  if (standalone) {
    return { max: Number(standalone[1]) };
  }

  // Pattern 8: "X dollars" without "$" (NEW)
  const dollarsOnly = text.match(/\b(\d{2,4})\s*dollars?\b/i);
  if (dollarsOnly) {
    return { max: Number(dollarsOnly[1]) };
  }

  return {}; // No budget found
}

// Usage in chat endpoint (Lines 276-289):
const b = parseBudget(text);
if (b.min != null) budgetMin = b.min;  // ✅ Only assign if defined
if (b.max != null) budgetMax = b.max;  // ✅ Only assign if defined
```

**Test Cases** (should all pass):
```typescript
// Add unit tests
expect(parseBudget("budget around $50")).toEqual({ min: 40, max: 60 });
expect(parseBudget("budget is 100 dollars")).toEqual({ max: 100 });
expect(parseBudget("under $50")).toEqual({ max: 50 });
expect(parseBudget("30-60 budget")).toEqual({ min: 30, max: 60 });
expect(parseBudget("between 20 and 40")).toEqual({ min: 20, max: 40 });
expect(parseBudget("spend $75")).toEqual({ max: 75 });
expect(parseBudget("$50")).toEqual({ max: 50 });
```

---

### 2.2 Expand Recipient Recognition (P0)

**Location**: `src/server/services/extract.ts:66-87`

**Good News**: This was already fixed! Current code includes:
```typescript
wife: ["wife"],
husband: ["husband"],
grandma: ["grandma", "grandmother", "granny", "nana"],
grandpa: ["grandpa", "grandfather", "grandad"],
// etc.
```

✅ **Status**: COMPLETE (confirmed in latest code review)

**Additional Suggestions** (nice-to-have):
```typescript
// Add more casual/affectionate terms
const RECIPIENT_MAP: Record<string, string[]> = {
  // ... existing ...
  partner: ["partner", "boyfriend", "girlfriend", "fiance", "fiancé", "fiancee", "spouse", "significant other", "SO"],
  friend: ["friend", "best friend", "bff", "bestie", "pal", "buddy"],
  colleague: ["colleague", "coworker", "co-worker", "boss", "manager", "team", "teammate", "work friend"],
  // Add in-laws
  motherInLaw: ["mother-in-law", "mother in law", "MIL"],
  fatherInLaw: ["father-in-law", "father in law", "FIL"],
  // Add step-family
  stepMom: ["stepmom", "step-mom", "step mom", "stepmother"],
  stepDad: ["stepdad", "step-dad", "step dad", "stepfather"],
};
```

---

### 2.3 Loosen "Readiness" Criteria (P0)

**Location**: `src/server/index.ts:348`

**Current Logic** (too strict):
```typescript
const ready = (merged.budgetMin != null || merged.budgetMax != null)
              && (recipientId || (categories && categories.length));
```

**Issue**: Requires BOTH budget AND (recipient OR categories). If budget extraction fails, user is stuck in loop.

**Human-Like Alternative** (more forgiving):
```typescript
// Option 1: Proceed after 2 clarifying questions regardless
let clarifyingQuestionCount = 0; // Track in session
if (clarifyingQuestionCount >= 2) {
  // Proceed with whatever we have
  ready = true;
}

// Option 2: Make budget OR recipient sufficient (not AND)
const ready = (merged.budgetMin != null || merged.budgetMax != null)
              || recipientId
              || (categories && categories.length > 0);

// Option 3: Use confidence scoring
const hasBasicInfo = recipientId || (categories && categories.length) || merged.notes;
const hasBudget = merged.budgetMin != null || merged.budgetMax != null;
const ready = hasBasicInfo; // Budget is nice-to-have, not required

// RECOMMENDED: Option 3 (most flexible)
// Then in response, acknowledge if budget missing:
if (!hasBudget && hasBasicInfo) {
  reply = "I'll show you a range of options since we haven't locked in a budget yet. You can always narrow down from here!";
}
```

**Why This Matters**: Users hate repeating themselves. If the AI has enough to make educated guesses, it should proceed rather than interrogating endlessly.

---

## 3. ENHANCING RATIONALE QUALITY (Make It Personal)

### 3.1 Current Rationale Issues

**Client-Side Fallback** (`src/web/app/page.tsx:88-112`):
```typescript
// Current: Generic, formulaic
reasons.push('within your budget');
reasons.push(`category: ${p.category}`);
```

**Issues**:
- Sounds robotic ("category: Books")
- Doesn't connect emotionally to the recipient
- Misses opportunity to reinforce why it's a good fit

---

### 3.2 Human-Like Rationale Patterns

**Transform generic statements into personal insights**:

```typescript
function buildHumanRationale(product: Product, context: UserContext): string {
  const parts: string[] = [];

  // Pattern 1: Connect to recipient's identity/interests
  if (context.recipientKey && product.category) {
    const templates = [
      `Perfect for someone who loves ${product.category.toLowerCase()}`,
      `Great fit for a ${context.recipientKey} into ${product.category.toLowerCase()}`,
      `This screams ${product.category.toLowerCase()} lover`,
    ];
    parts.push(templates[Math.floor(Math.random() * templates.length)]);
  }

  // Pattern 2: Budget validation (positive spin)
  if (context.budgetMax && product.price <= context.budgetMax) {
    if (product.price < context.budgetMax * 0.6) {
      parts.push(`and it leaves room in your budget`);
    } else if (product.price >= context.budgetMax * 0.9) {
      parts.push(`worth every bit of your ${context.budgetMax} budget`);
    } else {
      parts.push(`right in your sweet spot`);
    }
  }

  // Pattern 3: Values alignment (when detected)
  if (context.values?.includes('sustainable') && product.tags?.includes('eco-friendly')) {
    parts.push(`plus it's eco-friendly`);
  }
  if (context.values?.includes('handmade') && product.tags?.includes('artisan')) {
    parts.push(`handmade with care`);
  }

  // Pattern 4: Occasion fit (if known)
  if (context.occasion === 'birthday') {
    parts.push(`makes a thoughtful birthday gift`);
  }

  // Combine naturally
  if (parts.length === 0) return `I think they'd really like this.`;
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.';

  // Join with natural connectors
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const rest = parts.slice(1);
  if (rest.length === 1) return `${first}, ${rest[0]}.`;
  return `${first}, ${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}.`;
}
```

**Examples of transformation**:

| Generic (Current) | Human-Like (Enhanced) |
|-------------------|----------------------|
| "Category: Books; within your budget" | "Perfect for someone who loves books, and it's right in your sweet spot." |
| "Why: matches your interests (yoga)" | "Great fit for a sister into yoga and wellness—plus it's eco-friendly." |
| "Price: $45" | "This is thoughtful without breaking the bank at $45." |

---

### 3.3 Server-Side LLM Rationale Enhancement

**When LLM is available** (`src/server/services/recommend.ts`):

Add to the recommendation prompt:
```typescript
const recommendationPrompt = `
Based on the context, here are products from our catalog.

For EACH product, write a 1-sentence rationale that:
- Connects to specific details the user shared (recipient, interests, occasion)
- Sounds like a friend recommending something, not a salesperson
- Uses natural language: "They'll love this because..." not "This item features..."
- Acknowledges trade-offs honestly if relevant ("Not perfect but..." or "If they're open to...")

Context:
${buildContextBlock(context)}

Products:
${products.map((p, i) => `${i + 1}. ${p.title} ($${p.price}) - ${p.description}`).join('\n')}

Return JSON array: [{ productIndex: 0, rationale: "..." }, ...]
`;
```

**Example Output**:
```json
[
  {
    "productIndex": 0,
    "rationale": "Since your sister loves yoga and sustainability, this organic mat is perfect—plus it's made by a woman-owned business."
  },
  {
    "productIndex": 1,
    "rationale": "A meditation cushion that matches her minimalist vibe, and at $45 it fits your budget beautifully."
  }
]
```

---

## 4. CONVERSATIONAL FLOW IMPROVEMENTS

### 4.1 Example Prompts (Onboarding)

**Current State** (`src/web/app/page.tsx:180-193`):
```typescript
"Gift for my mom's 60th birthday, $50-100"
"Anniversary gift for my partner, loves cooking"
"Thank you gift for colleague, under $30"
```

✅ **Good**: Clear, actionable, show the format
❌ **Could be better**: Add emotional context examples

**Enhanced Examples**:
```typescript
// Add variety and emotional dimensions
const examplePrompts = [
  // Efficient users
  "Gift for my mom's 60th birthday, $50-100",
  "Anniversary gift for my partner, loves cooking",
  "Thank you gift for colleague, under $30",

  // Anxious users
  "I forgot my roommate's birthday—need something under $20 fast!",
  "Meeting my girlfriend's parents tomorrow, need a hostess gift",

  // Excited users
  "My best friend is getting married! Budget around $150",
  "First Mother's Day gift for my wife—want something special",

  // Uncertain users
  "Not sure what to get my teenage nephew, he's into gaming",
  "Need a housewarming gift but don't know their style",
];

// Rotate examples each visit or show category-based ones
const displayed = examplePrompts
  .sort(() => Math.random() - 0.5)
  .slice(0, 3);
```

---

### 4.2 Loading State Personality

**Current** (`src/web/app/page.tsx:199-207`):
```typescript
<span className="inline-flex animate-pulse">Thinking</span>
// + bouncing dots
```

**Enhanced** (add personality):
```typescript
const thinkingPhrases = [
  "Thinking...",
  "Hmm, let me see...",
  "Looking through the catalog...",
  "Finding something great...",
  "One sec...",
  "Searching...",
];

// Randomly select, or rotate on subsequent loads
const [thinkingText] = useState(
  thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]
);
```

**Why**: Variety prevents the AI from feeling like a broken record. Humans don't say "thinking..." every single time.

---

### 4.3 Acknowledgment Before Asking

**Pattern**: When user provides partial info, acknowledge what they GAVE before asking for more.

**Example Flow**:

**User**: "Gift for my sister's birthday"

**Bad Response** ❌:
"What's your budget?"

**Good Response** ✅:
"Nice! Sister's birthday. What's your budget looking like?"

or

"Got it—sister's birthday coming up! Any idea what you'd like to spend?"

**Implementation**:
```typescript
// In chat endpoint, before asking follow-up
function buildAcknowledgment(extracted: ExtractedContext): string {
  const acks: string[] = [];

  if (extracted.recipientKey) {
    acks.push(`Gift for your ${extracted.recipientKey}`);
  }
  if (extracted.occasion) {
    acks.push(`for ${extracted.occasion}`);
  }
  if (extracted.categories?.length) {
    acks.push(`who's into ${extracted.categories.join(' and ')}`);
  }

  if (acks.length === 0) return "";

  const base = acks.join(', ');
  const connectors = ["Got it", "Nice", "Love that", "Perfect", "Awesome"];
  const connector = connectors[Math.floor(Math.random() * connectors.length)];

  return `${connector}—${base}! `;
}

// Usage:
const ack = buildAcknowledgment(extracted);
const followUp = askBudget(); // or other question
reply = ack + followUp;
// Result: "Got it—Gift for your sister! What's your budget looking like?"
```

---

### 4.4 Recommendation Intro (Build Excitement)

**Current**: Recommendations just appear with no transition.

**Enhanced**: Add enthusiastic intro when delivering results.

```typescript
const recommendationIntros = [
  "Okay, I found some things I think they'll love!",
  "Alright, here are a few ideas that caught my eye:",
  "I've got some great options for you!",
  "Here's what I'm thinking:",
  "Check these out—I think you'll find something perfect:",
  "Found a few gems in the catalog:",
];

function getRecommendationIntro() {
  return recommendationIntros[Math.floor(Math.random() * recommendationIntros.length)];
}

// In chat endpoint, before returning items:
if (recommendations.length > 0) {
  reply = getRecommendationIntro();
  items = recommendations;
}
```

---

## 5. VOICE INTERACTION HUMANIZATION

### 5.1 Voice Feedback & Confirmation

**Current**: Voice input is silent until complete, then auto-submits.

**Human-Like Enhancement**: Show real-time transcription and allow editing.

**Updated Flow** (`src/web/components/MicButton.tsx`):
```typescript
// While recording
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-xl p-6 max-w-md">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-4 w-4 bg-red-600 rounded-full animate-pulse" />
      <span className="text-lg">Listening...</span>
    </div>

    {/* Real-time transcription */}
    <p className="text-gray-700 mb-4 min-h-[60px]">
      {interimTranscript || "Start speaking..."}
    </p>

    {/* Actions */}
    <div className="flex gap-2">
      <Button onClick={stopRecording} variant="primary">
        Done
      </Button>
      <Button onClick={cancelRecording} variant="secondary">
        Cancel
      </Button>
    </div>
  </div>
</div>

// After recording
<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
  <p className="text-sm text-gray-600 mb-1">You said:</p>
  <p className="text-gray-900">{transcript}</p>
  <div className="flex gap-2 mt-2">
    <Button size="sm" onClick={editTranscript}>Edit</Button>
    <Button size="sm" onClick={sendTranscript}>Send</Button>
    <Button size="sm" variant="ghost" onClick={tryAgain}>Try Again</Button>
  </div>
</div>
```

**Why**: Voice recognition isn't perfect. Let users verify and edit before sending.

---

### 5.2 Voice Error Handling

**Scenario**: Browser doesn't support speech recognition.

**Current**: Button is just disabled (no explanation).

**Human-Like**:
```typescript
{!browserSupportsVoice && (
  <Tooltip content="Voice input not supported in this browser. Try Chrome or Edge!">
    <Button disabled className="opacity-50">
      🎤
    </Button>
  </Tooltip>
)}
```

---

## 6. HANDLING EDGE CASES GRACEFULLY

### 6.1 No Results Found

**Scenario**: User asks for something not in catalog.

**Bad Response** ❌:
"No results found."

**Human-Like Response** ✅:
```typescript
if (recommendations.length === 0) {
  const suggestions = [
    "Hmm, I'm not finding anything that's a perfect match. Want to try a different category or budget?",
    "The catalog's a bit limited here. Could you describe what you're looking for another way?",
    "I'm coming up empty on exact matches. Would you be open to something in a related category?",
    "Not seeing great options right now. Want to expand the budget or try a different angle?",
  ];

  reply = suggestions[Math.floor(Math.random() * suggestions.length)];

  // Offer actionable next steps
  reply += "\n\nOr I can show you popular gifts for similar occasions?";
}
```

---

### 6.2 Conflicting Constraints

**Scenario**: "Need a luxury gift under $20"

**Bad Response** ❌:
Silently ignore "luxury" or return mismatched results.

**Human-Like Response** ✅:
```typescript
if (context.values?.includes('luxury') && context.budgetMax < 50) {
  reply = "Just a heads up—luxury items tend to start around $50+. I can show you the best quality options in your $20 budget, or we can bump up the range a bit?";
}
```

---

### 6.3 Vague Input

**Scenario**: "Need a gift"

**Bad Response** ❌:
"Please provide more details."

**Human-Like Response** ✅:
```typescript
if (!recipientKey && !categories?.length && !occasion) {
  const openEnders = [
    "I'd love to help! Who's the lucky person?",
    "Sure thing! Tell me a bit about who you're shopping for?",
    "Absolutely! Who's this gift for?",
    "Let's do it! What's the occasion, or who are you shopping for?",
  ];
  reply = openEnders[Math.floor(Math.random() * openEnders.length)];
}
```

---

## 7. POST-RECOMMENDATION INTERACTION

### 7.1 Encourage Refinement

**After showing recommendations**:

```typescript
// Add at end of recommendation message
const refinementPrompts = [
  "Want me to adjust anything? (price, style, category)",
  "Thoughts? I can find more like any of these.",
  "Let me know if you want to see more options or refine these!",
  "See anything you like? Happy to search for more in that direction.",
];

reply += "\n\n" + refinementPrompts[Math.floor(Math.random() * refinementPrompts.length)];
```

---

### 7.2 Follow-Up Questions

**Enable conversational drill-down**:

**User**: "I like the yoga mat but it's too expensive"

**AI**:
"Got it! Let me find some more affordable yoga mats. What's your max?"

**User**: "Show me more books"

**AI**:
"Sure! Any specific genre or topic they're into?"

**Implementation**: Track conversation state and allow refinement without restarting.

---

## 8. CULTURAL SENSITIVITY & INCLUSIVITY

### 8.1 Avoid Assumptions

**Don't assume**:
- Gender of partner/spouse
- Family structure
- Cultural traditions
- Ability/disability status

**Examples**:

❌ "What does your boyfriend like?"
✅ "What does your partner like?" or "What are they into?"

❌ "Perfect for a mom!"
✅ "Great for a parent" or "Perfect for someone with kids"

---

### 8.2 Recognize Diverse Occasions

**Add to occasion detection**:
```typescript
const occasions = {
  // Western
  christmas: ["christmas", "xmas", "holidays"],
  thanksgiving: ["thanksgiving"],
  valentines: ["valentine", "valentines day"],

  // Cultural/Religious
  diwali: ["diwali", "deepavali"],
  ramadan: ["ramadan", "eid", "eid al-fitr", "eid al-adha"],
  hanukkah: ["hanukkah", "chanukah"],
  lunarNewYear: ["lunar new year", "chinese new year", "tet"],
  kwanzaa: ["kwanzaa"],

  // Life events
  housewarming: ["housewarming", "new home", "moved"],
  retirement: ["retirement", "retiring"],
  // ... etc
};
```

**Respond with cultural awareness**:
```typescript
if (occasion === 'diwali') {
  reply = "Diwali! I'll look for items that celebrate light and prosperity. ";
}
```

---

## 9. IMPLEMENTATION PRIORITY

### Phase 1: Critical Fixes (Week 1)
1. ✅ Fix budget extraction logic (2.1)
2. ✅ Loosen readiness criteria (2.3)
3. ✅ Enhanced system prompt (1.2)
4. ✅ Opening message update (1.1)
5. ✅ Dynamic response patterns (1.3)

### Phase 2: Emotional Intelligence (Week 2)
1. ✅ Emotional context detection (1.4)
2. ✅ Milestone celebration (1.5)
3. ✅ Acknowledgment before asking (4.3)
4. ✅ Human-like rationale (3.2)
5. ✅ Recommendation intros (4.4)

### Phase 3: Edge Cases & Refinement (Week 3)
1. ✅ No results handling (6.1)
2. ✅ Conflicting constraints (6.2)
3. ✅ Vague input responses (6.3)
4. ✅ Post-recommendation refinement (7.1-7.2)
5. ✅ Enhanced example prompts (4.1)

### Phase 4: Voice & Polish (Week 4)
1. ✅ Voice transcription confirmation (5.1)
2. ✅ Voice error handling (5.2)
3. ✅ Loading state variety (4.2)
4. ✅ Cultural sensitivity audit (8.1-8.2)

---

## 10. MEASURING SUCCESS

### Qualitative Metrics
- **Does it feel like talking to a friend?** (User feedback survey)
- **Do users trust the recommendations?** (Click-through rate, wishlist saves)
- **Are users coming back?** (Repeat session rate)

### Quantitative Metrics
- **Conversation completion rate**: % who get to recommendations
- **Average turns to recommendation**: Target ≤ 3
- **Time to first recommendation**: Target < 2 minutes
- **Refinement rate**: % who ask for more after initial recs
- **NPS score**: Target ≥ 50

---

## 11. EXAMPLE CONVERSATION (BEFORE & AFTER)

### BEFORE (Robotic, Transactional)

**User**: Need a gift for my sister's birthday, budget around $50

**AI**: Great! What budget are you thinking (e.g., under $50 or 20–40)?

**User**: I just said $50...

**AI**: Please provide budget range.

**User**: *frustrated, leaves*

---

### AFTER (Natural, Empathetic)

**User**: Need a gift for my sister's birthday, budget around $50

**AI**: Nice! Sister's birthday coming up. Let me find some things around $50—any idea what she's into?

**User**: She loves yoga and anything eco-friendly

**AI**: Perfect combo! Okay, I found some things I think she'll love:

1. **Organic Yoga Mat** ($48) - Perfect for someone who loves yoga and sustainability, right in your sweet spot.

2. **Eco-Friendly Meditation Cushion** ($45) - Great fit for a sister into yoga and wellness—plus it's handmade by a woman-owned business.

3. **Sustainable Activewear Set** ($52) - A bit over but worth it—organic cotton, ethically made, and she'll actually wear it.

Want me to find more like any of these, or adjust the price range?

**User**: Love the yoga mat, I'll go with that!

**AI**: Awesome choice! She's going to love it. 🎁

---

## 12. FINAL RECOMMENDATIONS SUMMARY

| Category | Priority | Impact | Effort |
|----------|----------|--------|--------|
| Fix budget extraction | P0 | Critical | 2h |
| Loosen readiness logic | P0 | High | 30min |
| Enhanced system prompt | P0 | High | 1h |
| Emotional context detection | P1 | High | 3h |
| Dynamic response patterns | P1 | Medium | 2h |
| Human-like rationales | P1 | High | 4h |
| Milestone celebration | P2 | Medium | 2h |
| Voice confirmation flow | P2 | Medium | 4h |
| Cultural sensitivity audit | P2 | Medium | 3h |
| Edge case handling | P2 | Medium | 3h |

**Total Estimated Effort**: ~24 hours (3-4 days of focused development)

**Expected Outcome**: Transform from "functional AI assistant" to "thoughtful gift-giving friend"

---

**Document Updated**: October 6, 2025
**Focus**: Human-like interaction, emotional intelligence, conversational design
**Status**: Ready for implementation
**Next Steps**: Begin Phase 1 (Critical Fixes) immediately
