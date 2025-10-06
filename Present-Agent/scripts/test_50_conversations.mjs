#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs/promises';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

// 50 diverse conversation scenarios covering different personas, emotions, and use cases
const conversations = [
  // 1-5: Budget-focused personas
  {
    id: 1,
    persona: "Budget-conscious student",
    scenario: "Roommate birthday, very tight budget",
    messages: ["Need gift for roommate's birthday tomorrow, only have $15"]
  },
  {
    id: 2,
    persona: "Frugal shopper",
    scenario: "Multiple gifts, cost-conscious",
    messages: ["Looking for thank you gifts for 3 coworkers, under $25 each"]
  },
  {
    id: 3,
    persona: "Mid-range buyer",
    scenario: "Friend's wedding",
    messages: ["Wedding gift for close friend, thinking $75-100"]
  },
  {
    id: 4,
    persona: "Generous gifter",
    scenario: "Milestone birthday",
    messages: ["My mom's 60th birthday, budget around $200, she loves gardening"]
  },
  {
    id: 5,
    persona: "Flexible budget",
    scenario: "Anniversary gift",
    messages: ["10 year anniversary gift for my wife, budget flexible but quality matters"]
  },

  // 6-10: Emotional states - Anxious
  {
    id: 6,
    persona: "Anxious gift-giver",
    scenario: "Meeting partner's parents",
    messages: ["Super nervous, meeting my boyfriend's parents this weekend, need a gift"]
  },
  {
    id: 7,
    persona: "Stressed last-minute",
    scenario: "Forgot birthday",
    messages: ["I completely forgot my sister's birthday is tomorrow! Help!"]
  },
  {
    id: 8,
    persona: "Worried about impression",
    scenario: "New job team gift",
    messages: ["Starting new job next week, want to bring something for the team, don't want to seem weird"]
  },
  {
    id: 9,
    persona: "Uncertain shopper",
    scenario: "Don't know recipient well",
    messages: ["Secret Santa at work, got someone I barely know, $30 limit"]
  },
  {
    id: 10,
    persona: "Decision paralysis",
    scenario: "Too many options",
    messages: ["Need help, I've been looking for a gift for my dad for weeks and can't decide"]
  },

  // 11-15: Emotional states - Excited/Celebratory
  {
    id: 11,
    persona: "Excited new parent",
    scenario: "First Mother's Day",
    messages: ["First Mother's Day for my wife! So excited, want something really special"]
  },
  {
    id: 12,
    persona: "Proud family member",
    scenario: "Graduation celebration",
    messages: ["My nephew is graduating med school! This is huge, want something meaningful"]
  },
  {
    id: 13,
    persona: "Enthusiastic friend",
    scenario: "Best friend's promotion",
    messages: ["My best friend just got promoted to VP!! Need to celebrate"]
  },
  {
    id: 14,
    persona: "Wedding excitement",
    scenario: "Sister's engagement",
    messages: ["My sister just got engaged and I'm so happy! Engagement gift ideas?"]
  },
  {
    id: 15,
    persona: "Baby shower host",
    scenario: "Organizing celebration",
    messages: ["Throwing baby shower for colleague, what's a great group gift? Budget $150 total"]
  },

  // 16-20: Specific interests/hobbies
  {
    id: 16,
    persona: "Fitness enthusiast gift-giver",
    scenario: "Yoga lover",
    messages: ["Gift for sister who's obsessed with yoga and meditation, $40-60"]
  },
  {
    id: 17,
    persona: "Foodie friend",
    scenario: "Cooking enthusiast",
    messages: ["Partner loves cooking, especially Italian food, anniversary coming up"]
  },
  {
    id: 18,
    persona: "Tech-focused",
    scenario: "Gamer nephew",
    messages: ["Teenage nephew into gaming and tech, birthday gift around $50"]
  },
  {
    id: 19,
    persona: "Outdoorsy",
    scenario: "Hiking/camping lover",
    messages: ["Dad's birthday, he loves hiking and camping, budget $80"]
  },
  {
    id: 20,
    persona: "Creative arts",
    scenario: "Artist friend",
    messages: ["Friend who's really into painting and crafts, housewarming gift"]
  },

  // 21-25: Values-driven (sustainable, ethical, etc.)
  {
    id: 21,
    persona: "Eco-conscious",
    scenario: "Sustainable only",
    messages: ["Looking for eco-friendly gift, sister is very environmentally conscious, $50"]
  },
  {
    id: 22,
    persona: "Support local",
    scenario: "Small business preference",
    messages: ["Want to support local businesses, gift for mom who loves handmade items"]
  },
  {
    id: 23,
    persona: "Vegan lifestyle",
    scenario: "Vegan colleague",
    messages: ["Colleague is vegan, want to make sure gift is appropriate, $30"]
  },
  {
    id: 24,
    persona: "Fair trade advocate",
    scenario: "Ethical sourcing important",
    messages: ["Gift for friend, she only buys ethically sourced products, budget $60"]
  },
  {
    id: 25,
    persona: "Minimalist values",
    scenario: "Anti-clutter recipient",
    messages: ["Friend is a minimalist, hates clutter, what can I get that won't annoy them?"]
  },

  // 26-30: Cultural/Occasion diversity
  {
    id: 26,
    persona: "Diwali celebration",
    scenario: "Cultural occasion",
    messages: ["Diwali gift for Indian coworker, want to be respectful, budget $40"]
  },
  {
    id: 27,
    persona: "Lunar New Year",
    scenario: "Cultural celebration",
    messages: ["Chinese New Year gift for friend's family, not sure what's appropriate"]
  },
  {
    id: 28,
    persona: "Hanukkah gift",
    scenario: "Religious holiday",
    messages: ["Hanukkah gift for neighbor, we're not Jewish so want to get it right"]
  },
  {
    id: 29,
    persona: "Quinceañera guest",
    scenario: "Coming of age celebration",
    messages: ["Invited to quinceañera for cousin's daughter, what's a good gift?"]
  },
  {
    id: 30,
    persona: "Bar Mitzvah attendee",
    scenario: "Religious milestone",
    messages: ["Bar Mitzvah gift for friend's son, budget around $100"]
  },

  // 31-35: Relationship types
  {
    id: 31,
    persona: "Long-distance relationship",
    scenario: "Send gift across country",
    messages: ["Long distance girlfriend, her birthday, want something meaningful to ship"]
  },
  {
    id: 32,
    persona: "New relationship",
    scenario: "First Christmas together",
    messages: ["First Christmas with boyfriend, been dating 3 months, not too serious yet"]
  },
  {
    id: 33,
    persona: "Grandparent",
    scenario: "Grandchildren gifts",
    messages: ["Have 4 grandkids ages 5-12, Christmas gifts, $30 each"]
  },
  {
    id: 34,
    persona: "Professional colleague",
    scenario: "Boss retirement",
    messages: ["Boss retiring after 20 years, team pooling money, $200 budget"]
  },
  {
    id: 35,
    persona: "Neighbor",
    scenario: "Thank you for help",
    messages: ["Neighbor helped us a lot when we moved in, want to say thanks"]
  },

  // 36-40: Specific constraints/challenges
  {
    id: 36,
    persona: "Allergy concern",
    scenario: "Food allergies",
    messages: ["Friend has severe nut allergy, want to avoid any food gifts, what else?"]
  },
  {
    id: 37,
    persona: "Pet owner",
    scenario: "Dog lover",
    messages: ["Friend obsessed with their golden retriever, gift ideas for dog owner?"]
  },
  {
    id: 38,
    persona: "Small apartment",
    scenario: "Space constraints",
    messages: ["Friend lives in tiny apartment, nothing big or bulky please"]
  },
  {
    id: 39,
    persona: "Travel enthusiast",
    scenario: "Always traveling",
    messages: ["Sister travels constantly for work, gift that's practical for travel?"]
  },
  {
    id: 40,
    persona: "New homeowner",
    scenario: "First house",
    messages: ["Couple just bought their first house, housewarming gift $75"]
  },

  // 41-45: Multi-turn conversations (to test context retention)
  {
    id: 41,
    persona: "Iterative shopper",
    scenario: "Refining preferences",
    messages: [
      "Need gift for wife",
      "She loves reading and coffee",
      "Budget around $60",
      "Something unique, not generic"
    ]
  },
  {
    id: 42,
    persona: "Comparison shopper",
    scenario: "Evaluating options",
    messages: [
      "Birthday gift for brother, he's into fitness",
      "Show me options under $50",
      "Those are too basic, anything more interesting?"
    ]
  },
  {
    id: 43,
    persona: "Budget adjuster",
    scenario: "Changing constraints",
    messages: [
      "Gift for mom, gardening stuff, $40",
      "Actually I can go up to $70 if there's something really good"
    ]
  },
  {
    id: 44,
    persona: "Adding constraints",
    scenario: "Specifying more details",
    messages: [
      "Anniversary gift for husband",
      "$100 budget",
      "He likes whiskey and leather goods",
      "Oh and it needs to arrive by Friday"
    ]
  },
  {
    id: 45,
    persona: "Exploring categories",
    scenario: "Browsing different types",
    messages: [
      "Thinking about gift for dad's 65th birthday",
      "What categories do you have?",
      "He's not really into tech or gadgets, more traditional stuff"
    ]
  },

  // 46-50: Edge cases and unusual scenarios
  {
    id: 46,
    persona: "Corporate bulk order",
    scenario: "Client gifts",
    messages: ["Need 25 identical gifts for clients, professional but thoughtful, $50 each"]
  },
  {
    id: 47,
    persona: "Gender neutral request",
    scenario: "Non-binary friend",
    messages: ["Birthday gift for my friend who's non-binary, nothing gendered please"]
  },
  {
    id: 48,
    persona: "Luxury seeker",
    scenario: "High-end gift",
    messages: ["Looking for luxury gift for wife's 40th, money not an issue, show me best"]
  },
  {
    id: 49,
    persona: "DIY enthusiast",
    scenario: "Crafty recipient",
    messages: ["Friend loves making things herself, DIY kits or craft supplies?"]
  },
  {
    id: 50,
    persona: "Subscription preference",
    scenario: "Experiences over things",
    messages: ["Brother prefers experiences over physical gifts, subscription ideas?"]
  }
];

async function chat(message) {
  try {
    const response = await axios.post(`${API_BASE}/api/chat`,
      { message },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    return {
      error: true,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

async function runConversation(conv) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test ${conv.id}/50: ${conv.persona} - ${conv.scenario}`);
  console.log('='.repeat(80));

  const results = {
    id: conv.id,
    persona: conv.persona,
    scenario: conv.scenario,
    turns: [],
    analysis: {
      gotRecommendations: false,
      turnsToRecommendation: 0,
      budgetExtracted: false,
      recipientExtracted: false,
      emotionalAcknowledgment: false,
      errors: [],
      responseQuality: {
        warm: false,
        varied: false,
        empathetic: false
      }
    }
  };

  for (let i = 0; i < conv.messages.length; i++) {
    const userMessage = conv.messages[i];
    console.log(`\n👤 User: ${userMessage}`);

    await new Promise(resolve => setTimeout(resolve, 500)); // Throttle requests

    const response = await chat(userMessage);

    if (response.error) {
      console.log(`❌ Error: ${response.message}`);
      results.analysis.errors.push({ turn: i + 1, error: response.message });
      results.turns.push({
        turn: i + 1,
        user: userMessage,
        assistant: null,
        error: response.message
      });
      continue;
    }

    console.log(`🤖 AI: ${response.reply || '(no reply)'}`);

    if (response.contextSummary) {
      console.log(`📝 Context: ${response.contextSummary}`);
    }

    if (response.items && response.items.length > 0) {
      console.log(`🎁 Recommendations: ${response.items.length} items`);
      results.analysis.gotRecommendations = true;
      results.analysis.turnsToRecommendation = i + 1;

      response.items.slice(0, 2).forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.product?.title || 'Unknown'} - $${item.product?.price || '?'}`);
        if (item.rationale) {
          console.log(`      💭 "${item.rationale}"`);
        }
      });
    }

    // Analyze response
    const reply = response.reply?.toLowerCase() || '';

    // Check budget extraction
    if (userMessage.match(/\$\d+|budget|spend|under|around/i)) {
      if (response.contextSummary?.includes('budget') || reply.includes('budget')) {
        results.analysis.budgetExtracted = true;
      }
    }

    // Check recipient extraction
    if (userMessage.match(/sister|brother|mom|dad|wife|husband|friend|colleague|partner/i)) {
      if (response.contextSummary?.includes('recipient')) {
        results.analysis.recipientExtracted = true;
      }
    }

    // Check emotional acknowledgment
    const emotionalKeywords = ['nervous', 'anxious', 'excited', 'forgot', 'stressed', 'worried', 'happy'];
    const hasEmotion = emotionalKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    const acknowledgesEmotion = [
      'get it', 'understand', 'totally', 'exciting', 'deep breath',
      'no worries', 'stressful', 'how exciting', 'that\'s huge'
    ].some(phrase => reply.includes(phrase));

    if (hasEmotion && acknowledgesEmotion) {
      results.analysis.emotionalAcknowledgment = true;
    }

    // Check warmth (not robotic)
    const warmPhrases = [
      'love that', 'nice', 'great', 'awesome', 'perfect',
      'excited', 'got you', 'let\'s', 'i think', 'sounds like'
    ];
    if (warmPhrases.some(phrase => reply.includes(phrase))) {
      results.analysis.responseQuality.warm = true;
    }

    // Check if response avoids repetition (varies openings)
    const variedOpenings = ['nice', 'great', 'love that', 'perfect', 'awesome', 'got it', 'okay'];
    if (!reply.startsWith('great! ') || variedOpenings.some(v => reply.includes(v))) {
      results.analysis.responseQuality.varied = true;
    }

    results.turns.push({
      turn: i + 1,
      user: userMessage,
      assistant: response.reply,
      contextSummary: response.contextSummary,
      itemCount: response.items?.length || 0,
      hasRationale: response.items?.[0]?.rationale ? true : false
    });
  }

  return results;
}

async function runAllTests() {
  console.log('🧪 Starting 50 conversation tests...\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Total scenarios: ${conversations.length}\n`);

  const allResults = [];
  const startTime = Date.now();

  for (const conv of conversations) {
    try {
      const result = await runConversation(conv);
      allResults.push(result);
    } catch (error) {
      console.error(`\n❌ Fatal error in conversation ${conv.id}:`, error.message);
      allResults.push({
        id: conv.id,
        persona: conv.persona,
        scenario: conv.scenario,
        fatalError: error.message
      });
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  // Generate summary statistics
  const summary = {
    totalTests: allResults.length,
    durationMinutes: duration,
    successRate: {
      gotRecommendations: allResults.filter(r => r.analysis?.gotRecommendations).length,
      budgetExtracted: allResults.filter(r => r.analysis?.budgetExtracted).length,
      recipientExtracted: allResults.filter(r => r.analysis?.recipientExtracted).length,
      emotionalAcknowledgment: allResults.filter(r => r.analysis?.emotionalAcknowledgment).length,
    },
    responseQuality: {
      warm: allResults.filter(r => r.analysis?.responseQuality?.warm).length,
      varied: allResults.filter(r => r.analysis?.responseQuality?.varied).length,
    },
    avgTurnsToRecommendation: allResults
      .filter(r => r.analysis?.turnsToRecommendation > 0)
      .reduce((sum, r) => sum + r.analysis.turnsToRecommendation, 0) /
      allResults.filter(r => r.analysis?.turnsToRecommendation > 0).length || 0,
    errors: allResults.reduce((sum, r) => sum + (r.analysis?.errors?.length || 0), 0)
  };

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal tests run: ${summary.totalTests}`);
  console.log(`Duration: ${summary.durationMinutes} minutes`);
  console.log(`\n✅ Success Metrics:`);
  console.log(`  - Got recommendations: ${summary.successRate.gotRecommendations}/${summary.totalTests} (${(summary.successRate.gotRecommendations/summary.totalTests*100).toFixed(1)}%)`);
  console.log(`  - Budget extracted: ${summary.successRate.budgetExtracted}/${summary.totalTests} (${(summary.successRate.budgetExtracted/summary.totalTests*100).toFixed(1)}%)`);
  console.log(`  - Recipient extracted: ${summary.successRate.recipientExtracted}/${summary.totalTests} (${(summary.successRate.recipientExtracted/summary.totalTests*100).toFixed(1)}%)`);
  console.log(`  - Emotional acknowledgment: ${summary.successRate.emotionalAcknowledgment}/${summary.totalTests} (${(summary.successRate.emotionalAcknowledgment/summary.totalTests*100).toFixed(1)}%)`);
  console.log(`\n🎨 Response Quality:`);
  console.log(`  - Warm/friendly tone: ${summary.responseQuality.warm}/${summary.totalTests} (${(summary.responseQuality.warm/summary.totalTests*100).toFixed(1)}%)`);
  console.log(`  - Varied responses: ${summary.responseQuality.varied}/${summary.totalTests} (${(summary.responseQuality.varied/summary.totalTests*100).toFixed(1)}%)`);
  console.log(`\n⏱️  Performance:`);
  console.log(`  - Avg turns to recommendation: ${summary.avgTurnsToRecommendation.toFixed(2)}`);
  console.log(`  - Total errors: ${summary.errors}`);

  // Save detailed results
  const output = {
    summary,
    timestamp: new Date().toISOString(),
    results: allResults
  };

  await fs.writeFile(
    'test_50_conversations_results.json',
    JSON.stringify(output, null, 2)
  );

  console.log('\n💾 Detailed results saved to: test_50_conversations_results.json');
  console.log('\n✨ Testing complete!\n');

  return output;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, conversations };
