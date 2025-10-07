# Present-Agent: Test Personas & Scenarios

**Purpose**: Standardized personas and test scenarios for evaluating chat quality, recommendation accuracy, and user experience.

**Usage**: Use these personas to test the conversational AI, measure success metrics, and identify UX issues.

---

## Test Personas

### Persona 1: "Busy Professional Sarah"
**Demographics**: 34, Marketing Director, lives in Seattle
**Context**:
- Time-poor, values efficiency
- Tech-savvy, comfortable with voice input
- Shopping for multiple people regularly (team gifts, family)
- Budget-conscious but willing to pay for quality

**Test Scenario 1A: Sister's Birthday**
```
Initial prompt: "Need a gift for my sister's 30th birthday, she loves yoga and sustainability, budget around $50"

Expected context extraction:
- Recipient: sister
- Occasion: birthday (30th)
- Interests: yoga, sustainability
- Budget: ~$50
- Values: sustainable

Success criteria:
- ✓ Recommendations include yoga-related items
- ✓ Items tagged as sustainable/eco-friendly prioritized
- ✓ Price range $40-60
- ✓ Rationale mentions sustainability and yoga
- ✓ < 2 minutes to confident choice
```

**Test Scenario 1B: Team Gift (Multi-turn)**
```
Turn 1: "Looking for a thank you gift for my team"
Expected AI: Ask for budget, team size, or interests

Turn 2: "There are 5 people, budget is about $25 each"
Expected AI: Ask for context (what kind of work, any known preferences)

Turn 3: "We're a marketing team, pretty creative folks, one is vegan"
Expected AI: Provide recommendations with note about vegan option

Success criteria:
- ✓ AI asks clarifying questions
- ✓ Remembers budget ($25/person) across turns
- ✓ Notes dietary restriction (vegan)
- ✓ Suggests appropriate quantity (5 items or bulk option)
- ✓ Rationale mentions team/work context
```

---

### Persona 2: "Traditional Grandpa Joe"
**Demographics**: 68, Retired teacher, lives in rural Ohio
**Context**:
- Not tech-savvy, prefers simple interfaces
- Values tradition, quality craftsmanship
- Shopping for grandchildren, wife, old friends
- Fixed income, budget-sensitive

**Test Scenario 2A: Granddaughter's Graduation**
```
Initial prompt: "My granddaughter is graduating high school, need something special, she wants to be a doctor, I can spend up to 100 dollars"

Expected context extraction:
- Recipient: granddaughter
- Occasion: high school graduation
- Future goal: medical career
- Budget: up to $100
- Tone: sentimental/special

Success criteria:
- ✓ Recommendations include inspirational/educational items
- ✓ Medical/science-themed gifts prioritized
- ✓ Price range $75-100 (using full budget for special occasion)
- ✓ Rationale emphasizes sentimental value and career support
- ✓ No overly technical jargon in rationale
```

**Test Scenario 2B: Wedding Anniversary (50th)**
```
Initial prompt: "50th wedding anniversary coming up for my wife, she loves gardening and cooking, traditional anniversary gift"

Expected context extraction:
- Recipient: wife
- Occasion: 50th anniversary (golden)
- Interests: gardening, cooking
- Style: traditional

Success criteria:
- ✓ Recognizes 50th = golden anniversary
- ✓ Suggests traditional gold-themed items OR modern interpretation
- ✓ Garden/cooking related items highlighted
- ✓ Rationale mentions milestone significance
- ✓ Recommendations feel timeless, not trendy
```

---

### Persona 3: "Anxious First-Timer Mia"
**Demographics**: 22, College student, lives in Boston
**Context**:
- Meeting boyfriend's parents for first time
- High anxiety about making good impression
- Limited budget (student)
- Overthinks decisions

**Test Scenario 3A: Meeting The Parents**
```
Initial prompt: "I'm meeting my boyfriend's parents for the first time and need to bring a gift, I don't know much about them, maybe like $30?"

Expected AI response: Ask for any known information (interests, dietary restrictions, cultural background)

Turn 2: "His mom likes wine I think, and they're pretty outdoorsy, they live in Vermont"

Expected context extraction:
- Recipient: boyfriend's parents (couple)
- Occasion: first meeting (important!)
- Interests: wine, outdoors
- Location: Vermont (local/regional angle?)
- Budget: ~$30
- Emotional state: nervous/want to impress

Success criteria:
- ✓ AI shows empathy ("Great that you want to make a good impression!")
- ✓ Suggests safe, universally appealing options
- ✓ Avoids risky gifts (alcohol directly, overly personal items)
- ✓ Recommends Vermont-local or outdoor-themed items
- ✓ Rationale explains why choice is "safe" and thoughtful
- ✓ Maybe suggests wine accessories instead of wine itself
```

**Test Scenario 3B: Roommate Birthday (Budget Stressed)**
```
Initial prompt: "It's my roommate's birthday tomorrow and I totally forgot, need something under $20"

Expected context extraction:
- Recipient: roommate
- Occasion: birthday
- Urgency: TOMORROW
- Budget: under $20
- Emotional state: stressed/forgot

Success criteria:
- ✓ AI acknowledges urgency
- ✓ Suggests readily available items (or digital gifts if too late)
- ✓ Recommendations in $15-20 range
- ✓ Ideas that don't look "last minute" (thoughtful despite urgency)
- ✓ Fast decision (< 1 minute to recommendation)
```

---

### Persona 4: "Perfectionist David"
**Demographics**: 41, Software engineer, lives in San Francisco
**Context**:
- Detail-oriented, analytical
- High expectations for personalization
- Will test edge cases
- Generous budget, values uniqueness

**Test Scenario 4A: Wife's Birthday (Specific Requirements)**
```
Initial prompt: "Birthday gift for my wife, she's into minimalist design, practices meditation, allergic to nickel, doesn't like clutter, we're trying to reduce plastic in our home, budget is flexible but let's say $100-200"

Expected context extraction:
- Recipient: wife
- Occasion: birthday
- Style: minimalist
- Interests: meditation
- Constraint: nickel allergy
- Value: anti-clutter, eco-conscious, plastic-free
- Budget: $100-200 (flexible)

Success criteria:
- ✓ ALL constraints honored (no nickel, no plastic, minimal)
- ✓ Meditation-related items prioritized
- ✓ Rationale explicitly addresses each constraint
- ✓ Recommendations are unique/curated (not generic)
- ✓ Price range matches stated budget
- ✓ If constraints conflict, AI explains trade-offs
```

**Test Scenario 4B: Testing Memory Feature**
```
Turn 1: "Looking for a gift for my nephew who loves robotics, budget $50"
[Save to memory, get recommendations]

Turn 2 (New conversation, same session): "Another gift idea for my nephew"

Expected behavior:
- ✓ AI recalls nephew likes robotics
- ✓ AI suggests budget around $50 (from memory)
- ✓ Recommendations build on previous interaction
- ✓ Context summary shows: "Using your context (recipient: nephew; interests: robotics; budget: ~$50)"

Turn 3: "Actually, I want something cheaper this time, under $25"

Expected behavior:
- ✓ AI overrides budget to $25
- ✓ Still remembers robotics interest
- ✓ Adjusts recommendations accordingly
```

---

### Persona 5: "Cultural-Conscious Amara"
**Demographics**: 29, Non-profit worker, lives in Atlanta
**Context**:
- Values cultural sensitivity and representation
- Supports small businesses and artisans
- Budget-conscious but values ethical sourcing
- Shopping for diverse friend group

**Test Scenario 5A: Diwali Gift**
```
Initial prompt: "Need a Diwali gift for my colleague, she's Indian-American, I want to be respectful and thoughtful, budget $40"

Expected context extraction:
- Recipient: colleague (Indian-American)
- Occasion: Diwali (Hindu festival of lights)
- Priority: cultural respect
- Budget: $40

Success criteria:
- ✓ Recommendations culturally appropriate for Diwali
- ✓ Avoids stereotypes or appropriation
- ✓ Rationale shows cultural awareness
- ✓ Suggests traditional items OR modern interpretations
- ✓ If catalog lacks specific items, AI suggests alternatives respectfully
- ✓ Bonus: Highlights items from Indian/South Asian vendors
```

**Test Scenario 5B: Friend's Baby Shower (Gender-Neutral)**
```
Initial prompt: "My friend is having a baby shower, they're not revealing the gender, want something practical and not gendered, support Black-owned businesses if possible, budget $50-75"

Expected context extraction:
- Recipient: friend (expecting parent)
- Occasion: baby shower
- Constraint: gender-neutral
- Value: support Black-owned businesses
- Budget: $50-75

Success criteria:
- ✓ All recommendations gender-neutral colors/themes
- ✓ Practical items (not just cute decorative)
- ✓ If Black-owned vendor data available, prioritize in results
- ✓ Rationale mentions practical use and inclusivity
- ✓ Price range matches budget
```

---

## Automated Testing Script

### Setup Instructions
1. Ensure API server is running (`npm run dev`)
2. Install dependencies: `npm install axios dotenv`
3. Run script: `node scripts/test_personas.mjs`

### Script: `scripts/test_personas.mjs`

```javascript
import axios from 'axios';
import fs from 'fs/promises';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

// Test scenarios mapped to personas
const scenarios = [
  {
    persona: 'Busy Professional Sarah',
    scenario: '1A: Sister Birthday',
    turns: [
      { role: 'user', message: "Need a gift for my sister's 30th birthday, she loves yoga and sustainability, budget around $50" }
    ],
    expectations: {
      budget: { min: 40, max: 60 },
      keywords: ['yoga', 'sustainable', 'eco'],
      recipientType: 'sister',
      occasion: 'birthday'
    },
    successCriteria: [
      'Contains yoga-related items',
      'Sustainability mentioned in rationale',
      'Price within $40-60',
      'Time to recommendation < 2 min'
    ]
  },
  {
    persona: 'Busy Professional Sarah',
    scenario: '1B: Team Gift (Multi-turn)',
    turns: [
      { role: 'user', message: "Looking for a thank you gift for my team" },
      { role: 'user', message: "There are 5 people, budget is about $25 each" },
      { role: 'user', message: "We're a marketing team, pretty creative folks, one is vegan" }
    ],
    expectations: {
      budget: { min: 20, max: 30 },
      quantity: 5,
      keywords: ['creative', 'team', 'vegan'],
    },
    successCriteria: [
      'AI asks clarifying questions',
      'Remembers budget across turns',
      'Notes vegan requirement',
      'Appropriate quantity or bulk option'
    ]
  },
  {
    persona: 'Traditional Grandpa Joe',
    scenario: '2A: Granddaughter Graduation',
    turns: [
      { role: 'user', message: "My granddaughter is graduating high school, need something special, she wants to be a doctor, I can spend up to 100 dollars" }
    ],
    expectations: {
      budget: { min: 75, max: 100 },
      keywords: ['medical', 'doctor', 'science', 'graduation', 'education'],
      occasion: 'graduation'
    },
    successCriteria: [
      'Medical/science themed items',
      'Sentimental/inspirational tone',
      'Uses full budget (~$100)',
      'No technical jargon'
    ]
  },
  {
    persona: 'Traditional Grandpa Joe',
    scenario: '2B: 50th Anniversary',
    turns: [
      { role: 'user', message: "50th wedding anniversary coming up for my wife, she loves gardening and cooking, traditional anniversary gift" }
    ],
    expectations: {
      keywords: ['gold', 'golden', 'anniversary', 'garden', 'cooking'],
      occasion: '50th anniversary'
    },
    successCriteria: [
      'Recognizes golden anniversary',
      'Traditional or gold-themed items',
      'Garden/cooking related',
      'Milestone significance in rationale'
    ]
  },
  {
    persona: 'Anxious First-Timer Mia',
    scenario: '3A: Meeting Parents',
    turns: [
      { role: 'user', message: "I'm meeting my boyfriend's parents for the first time and need to bring a gift, I don't know much about them, maybe like $30?" },
      { role: 'user', message: "His mom likes wine I think, and they're pretty outdoorsy, they live in Vermont" }
    ],
    expectations: {
      budget: { min: 25, max: 35 },
      keywords: ['wine', 'outdoor', 'vermont', 'parents'],
    },
    successCriteria: [
      'Empathetic AI response',
      'Safe, universally appealing options',
      'Wine accessories (not wine directly)',
      'Vermont-local or outdoor items',
      'Rationale explains "safe" choice'
    ]
  },
  {
    persona: 'Anxious First-Timer Mia',
    scenario: '3B: Last Minute Roommate',
    turns: [
      { role: 'user', message: "It's my roommate's birthday tomorrow and I totally forgot, need something under $20" }
    ],
    expectations: {
      budget: { max: 20 },
      urgency: true,
      keywords: ['birthday', 'roommate']
    },
    successCriteria: [
      'Acknowledges urgency',
      'Readily available items',
      'Doesn\'t look last-minute',
      'Fast decision (< 1 min)'
    ]
  },
  {
    persona: 'Perfectionist David',
    scenario: '4A: Wife with Constraints',
    turns: [
      { role: 'user', message: "Birthday gift for my wife, she's into minimalist design, practices meditation, allergic to nickel, doesn't like clutter, we're trying to reduce plastic in our home, budget is flexible but let's say $100-200" }
    ],
    expectations: {
      budget: { min: 100, max: 200 },
      keywords: ['minimalist', 'meditation', 'plastic-free'],
      constraints: ['no nickel', 'no plastic', 'minimal']
    },
    successCriteria: [
      'All constraints honored',
      'Meditation-related items',
      'Rationale addresses each constraint',
      'Unique/curated recommendations'
    ]
  },
  {
    persona: 'Cultural-Conscious Amara',
    scenario: '5A: Diwali Gift',
    turns: [
      { role: 'user', message: "Need a Diwali gift for my colleague, she's Indian-American, I want to be respectful and thoughtful, budget $40" }
    ],
    expectations: {
      budget: { min: 35, max: 45 },
      keywords: ['diwali', 'festival', 'lights'],
      culturalSensitivity: true
    },
    successCriteria: [
      'Culturally appropriate for Diwali',
      'Avoids stereotypes',
      'Cultural awareness in rationale',
      'Traditional or modern interpretations'
    ]
  },
  {
    persona: 'Cultural-Conscious Amara',
    scenario: '5B: Gender-Neutral Baby Shower',
    turns: [
      { role: 'user', message: "My friend is having a baby shower, they're not revealing the gender, want something practical and not gendered, support Black-owned businesses if possible, budget $50-75" }
    ],
    expectations: {
      budget: { min: 50, max: 75 },
      keywords: ['baby', 'practical', 'gender-neutral'],
      values: ['black-owned', 'inclusive']
    },
    successCriteria: [
      'Gender-neutral items only',
      'Practical (not just decorative)',
      'Vendor diversity if possible',
      'Inclusive language in rationale'
    ]
  }
];

// Helper to call chat API
async function sendMessage(message, sessionCookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const response = await axios.post(`${API_BASE}/api/chat`,
    { message },
    { headers, withCredentials: true }
  );

  return {
    data: response.data,
    cookie: response.headers['set-cookie']?.[0]
  };
}

// Evaluate recommendations against expectations
function evaluateRecommendations(recommendations, expectations) {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Check budget
  if (expectations.budget && recommendations.length > 0) {
    const prices = recommendations.map(r => r.product?.price || 0);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    if (expectations.budget.min && avgPrice < expectations.budget.min) {
      results.warnings.push(`Average price $${avgPrice.toFixed(2)} below expected min $${expectations.budget.min}`);
    }
    if (expectations.budget.max && avgPrice > expectations.budget.max) {
      results.failed.push(`Average price $${avgPrice.toFixed(2)} exceeds max $${expectations.budget.max}`);
    } else {
      results.passed.push(`Price range appropriate (~$${avgPrice.toFixed(2)})`);
    }
  }

  // Check keywords in recommendations
  if (expectations.keywords && recommendations.length > 0) {
    const allText = recommendations.map(r =>
      `${r.product?.title} ${r.product?.description} ${r.product?.category} ${r.rationale}`.toLowerCase()
    ).join(' ');

    expectations.keywords.forEach(keyword => {
      if (allText.includes(keyword.toLowerCase())) {
        results.passed.push(`Keyword "${keyword}" found in recommendations`);
      } else {
        results.warnings.push(`Keyword "${keyword}" not found in recommendations`);
      }
    });
  }

  // Check recommendation count
  if (recommendations.length === 0) {
    results.failed.push('No recommendations returned');
  } else if (recommendations.length < 3) {
    results.warnings.push(`Only ${recommendations.length} recommendations (expected 3-5)`);
  } else {
    results.passed.push(`${recommendations.length} recommendations provided`);
  }

  return results;
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting persona testing...\n');

  const testResults = [];

  for (const scenario of scenarios) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👤 ${scenario.persona}`);
    console.log(`📋 ${scenario.scenario}`);
    console.log('='.repeat(60));

    let sessionCookie = null;
    let conversationLog = [];
    const startTime = Date.now();

    try {
      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];
        console.log(`\n💬 Turn ${i + 1}: "${turn.message}"`);

        const response = await sendMessage(turn.message, sessionCookie);
        if (response.cookie) sessionCookie = response.cookie;

        conversationLog.push({
          turn: i + 1,
          user: turn.message,
          assistant: response.data.reply,
          items: response.data.items || []
        });

        console.log(`🤖 AI: ${response.data.reply}`);

        if (response.data.contextSummary) {
          console.log(`📝 Context: ${response.data.contextSummary}`);
        }

        if (response.data.items && response.data.items.length > 0) {
          console.log(`\n🎁 Recommendations (${response.data.items.length}):`);
          response.data.items.forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.product.title} - $${item.product.price}`);
            if (item.rationale) {
              console.log(`     💭 "${item.rationale}"`);
            }
          });
        }

        // Small delay between turns
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      // Get final recommendations from last turn
      const lastTurn = conversationLog[conversationLog.length - 1];
      const recommendations = lastTurn.items || [];

      // Evaluate
      const evaluation = evaluateRecommendations(recommendations, scenario.expectations);

      console.log(`\n⏱️  Time to recommendation: ${duration}s`);
      console.log('\n✅ Passed Criteria:');
      evaluation.passed.forEach(p => console.log(`  ✓ ${p}`));

      if (evaluation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        evaluation.warnings.forEach(w => console.log(`  ! ${w}`));
      }

      if (evaluation.failed.length > 0) {
        console.log('\n❌ Failed Criteria:');
        evaluation.failed.forEach(f => console.log(`  ✗ ${f}`));
      }

      // Success criteria check
      console.log('\n📊 Success Criteria:');
      scenario.successCriteria.forEach(criteria => {
        console.log(`  - ${criteria}`);
      });

      testResults.push({
        persona: scenario.persona,
        scenario: scenario.scenario,
        duration,
        conversationLog,
        evaluation,
        successCriteria: scenario.successCriteria,
        passed: evaluation.failed.length === 0
      });

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      testResults.push({
        persona: scenario.persona,
        scenario: scenario.scenario,
        error: error.message,
        passed: false
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📈 TEST SUMMARY');
  console.log('='.repeat(60));

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;

  console.log(`\nTotal scenarios: ${totalCount}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${totalCount - passedCount}`);
  console.log(`Success rate: ${((passedCount / totalCount) * 100).toFixed(1)}%`);

  // Save detailed results to JSON
  await fs.writeFile(
    'test-results.json',
    JSON.stringify(testResults, null, 2)
  );

  console.log('\n💾 Detailed results saved to test-results.json');

  return testResults;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, scenarios };
```

---

## Manual Testing Checklist

For each persona scenario, manually verify:

### Conversation Quality
- [ ] AI responses are natural and empathetic
- [ ] AI asks appropriate clarifying questions
- [ ] AI remembers context across turns
- [ ] AI handles ambiguity gracefully

### Recommendation Quality
- [ ] Recommendations match stated preferences
- [ ] Price range aligns with budget
- [ ] Rationale is specific and thoughtful
- [ ] Rationale addresses key constraints/values
- [ ] 3-5 recommendations provided

### UX Observations
- [ ] Time to first recommendation < 2 minutes
- [ ] No errors or system failures
- [ ] Loading states visible and appropriate
- [ ] Context summary displayed correctly
- [ ] Memory drawer shows saved context

### Technical Check
- [ ] API responses within 500ms
- [ ] No console errors
- [ ] Images load properly
- [ ] Links functional
- [ ] Feedback buttons work

---

## Success Metrics Tracking

For each test run, record:

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Time to recommendation | < 2 min | __ s | __ |
| Clarifying questions needed | 0-2 | __ | __ |
| Recommendation relevance (1-5) | ≥ 4 | __ | __ |
| Rationale quality (1-5) | ≥ 4 | __ | __ |
| Price accuracy | ±20% | __ | __ |
| Constraint adherence | 100% | __ | __ |

---

## Running the Tests

### Quick Start
```bash
# Start servers
npm run dev:all

# In another terminal
node scripts/test_personas.mjs

# Review results
cat test-results.json
```

### CI Integration (Future)
```bash
# Add to package.json
"test:personas": "node scripts/test_personas.mjs",
"test:e2e": "playwright test personas.spec.ts"
```

---

## Next Steps

1. **Run initial baseline tests** with current implementation
2. **Document failures** and pain points
3. **Prioritize fixes** based on persona impact
4. **Re-test after improvements** to measure progress
5. **Expand personas** as new use cases emerge

---

**Last Updated**: October 1, 2025
**Personas Ready**: 5
**Scenarios Ready**: 9
**Automated**: Yes
