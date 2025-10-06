#!/usr/bin/env node

/**
 * Automated Persona Testing Script
 * Tests conversational AI with standardized personas and scenarios
 *
 * Usage: node scripts/test_personas.mjs
 * Requires: API server running on localhost:3001
 */

import axios from 'axios';
import fs from 'fs/promises';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const OUTPUT_FILE = 'test-results.json';

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

  try {
    const response = await axios.post(`${API_BASE}/api/chat`,
      { message },
      {
        headers,
        withCredentials: true,
        validateStatus: () => true // Accept any status for error handling
      }
    );

    return {
      data: response.data,
      status: response.status,
      cookie: response.headers['set-cookie']?.[0]
    };
  } catch (error) {
    throw new Error(`API request failed: ${error.message}`);
  }
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
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (expectations.budget.min && avgPrice < expectations.budget.min) {
      results.warnings.push(`Average price $${avgPrice.toFixed(2)} below expected min $${expectations.budget.min}`);
    }
    if (expectations.budget.max && avgPrice > expectations.budget.max) {
      results.failed.push(`Average price $${avgPrice.toFixed(2)} exceeds max $${expectations.budget.max}`);
    } else {
      results.passed.push(`Price range appropriate (avg: $${avgPrice.toFixed(2)}, range: $${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)})`);
    }
  }

  // Check keywords in recommendations
  if (expectations.keywords && recommendations.length > 0) {
    const allText = recommendations.map(r =>
      `${r.product?.title || ''} ${r.product?.description || ''} ${r.product?.category || ''} ${r.rationale || ''}`.toLowerCase()
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

  // Check for rationale presence
  const withRationale = recommendations.filter(r => r.rationale && r.rationale.length > 10);
  if (withRationale.length === recommendations.length) {
    results.passed.push('All recommendations have rationale');
  } else if (withRationale.length === 0) {
    results.failed.push('No recommendations have rationale');
  } else {
    results.warnings.push(`${withRationale.length}/${recommendations.length} recommendations have rationale`);
  }

  return results;
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting persona testing...');
  console.log(`📡 API Base: ${API_BASE}\n`);

  // Check if server is running
  try {
    await axios.get(`${API_BASE}/api/categories`, { timeout: 3000 });
    console.log('✅ API server is reachable\n');
  } catch (error) {
    console.error('❌ Cannot reach API server. Make sure it\'s running on', API_BASE);
    console.error('   Run: npm run dev\n');
    process.exit(1);
  }

  const testResults = [];

  for (const scenario of scenarios) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`👤 ${scenario.persona}`);
    console.log(`📋 ${scenario.scenario}`);
    console.log('='.repeat(70));

    let sessionCookie = null;
    let conversationLog = [];
    const startTime = Date.now();
    let hasError = false;

    try {
      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];
        console.log(`\n💬 Turn ${i + 1}: "${turn.message}"`);

        const response = await sendMessage(turn.message, sessionCookie);

        if (response.status !== 200) {
          throw new Error(`API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        if (response.cookie) sessionCookie = response.cookie;

        conversationLog.push({
          turn: i + 1,
          user: turn.message,
          assistant: response.data.reply || '',
          contextSummary: response.data.contextSummary || '',
          items: response.data.items || []
        });

        console.log(`🤖 AI: ${response.data.reply || '(no reply)'}`);

        if (response.data.contextSummary) {
          console.log(`📝 Context: ${response.data.contextSummary}`);
        }

        if (response.data.items && response.data.items.length > 0) {
          console.log(`\n🎁 Recommendations (${response.data.items.length}):`);
          response.data.items.forEach((item, idx) => {
            const title = item.product?.title || 'Unknown';
            const price = item.product?.price || 0;
            console.log(`  ${idx + 1}. ${title} - $${price.toFixed(2)}`);
            if (item.rationale) {
              console.log(`     💭 "${item.rationale}"`);
            }
          });
        }

        // Small delay between turns for realistic conversation
        if (i < scenario.turns.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      // Get final recommendations from last turn with items
      let recommendations = [];
      for (let i = conversationLog.length - 1; i >= 0; i--) {
        if (conversationLog[i].items && conversationLog[i].items.length > 0) {
          recommendations = conversationLog[i].items;
          break;
        }
      }

      // Evaluate
      const evaluation = evaluateRecommendations(recommendations, scenario.expectations);

      console.log(`\n⏱️  Time to recommendation: ${duration}s`);

      if (evaluation.passed.length > 0) {
        console.log('\n✅ Passed Criteria:');
        evaluation.passed.forEach(p => console.log(`  ✓ ${p}`));
      }

      if (evaluation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        evaluation.warnings.forEach(w => console.log(`  ! ${w}`));
      }

      if (evaluation.failed.length > 0) {
        console.log('\n❌ Failed Criteria:');
        evaluation.failed.forEach(f => console.log(`  ✗ ${f}`));
      }

      // Success criteria check
      console.log('\n📊 Expected Success Criteria:');
      scenario.successCriteria.forEach(criteria => {
        console.log(`  - ${criteria}`);
      });

      testResults.push({
        persona: scenario.persona,
        scenario: scenario.scenario,
        duration: parseFloat(duration),
        conversationLog,
        evaluation,
        successCriteria: scenario.successCriteria,
        passed: evaluation.failed.length === 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      hasError = true;
      testResults.push({
        persona: scenario.persona,
        scenario: scenario.scenario,
        error: error.message,
        passed: false,
        timestamp: new Date().toISOString()
      });
    }

    // Delay between scenarios to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📈 TEST SUMMARY');
  console.log('='.repeat(70));

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  const errorCount = testResults.filter(r => r.error).length;

  console.log(`\nTotal scenarios: ${totalCount}`);
  console.log(`Passed: ${passedCount} (${((passedCount / totalCount) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${totalCount - passedCount}`);
  console.log(`Errors: ${errorCount}`);

  const successfulTests = testResults.filter(r => !r.error && r.duration);
  if (successfulTests.length > 0) {
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    console.log(`\nAverage time to recommendation: ${avgDuration.toFixed(2)}s`);
    console.log(`Target: < 120s (2 minutes)`);
    if (avgDuration < 120) {
      console.log('✅ Meeting time target!');
    } else {
      console.log('⚠️  Exceeding time target');
    }
  }

  // Save detailed results to JSON
  const outputPath = OUTPUT_FILE;
  await fs.writeFile(
    outputPath,
    JSON.stringify({
      metadata: {
        testDate: new Date().toISOString(),
        apiBase: API_BASE,
        totalScenarios: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        successRate: ((passedCount / totalCount) * 100).toFixed(1) + '%'
      },
      results: testResults
    }, null, 2)
  );

  console.log(`\n💾 Detailed results saved to ${outputPath}`);
  console.log('\nTo view results:');
  console.log(`  cat ${outputPath} | jq .metadata`);
  console.log(`  cat ${outputPath} | jq '.results[] | {persona, scenario, passed}'`);

  return testResults;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then((results) => {
      const failedCount = results.filter(r => !r.passed).length;
      process.exit(failedCount > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runTests, scenarios };
