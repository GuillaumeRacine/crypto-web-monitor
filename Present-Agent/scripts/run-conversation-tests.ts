#!/usr/bin/env node
/**
 * Conversation Test Runner
 *
 * Runs 50 realistic gift-finding conversations and saves them for UX analysis
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

import fs from 'fs';
import {
  PERSONAS,
  SCENARIOS,
  generateConversationFlow,
  formatPersonaDescription,
  formatScenarioDescription,
  type Persona,
  type Scenario,
} from './test-personas.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

interface ConversationTurn {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  recommendations?: any[];
  tookMs?: number;
}

interface ConversationLog {
  id: number;
  persona: Persona;
  scenario: Scenario;
  turns: ConversationTurn[];
  startTime: string;
  endTime: string;
  totalDuration: number;
  satisfactionIndicators: {
    questionsAsked: number;
    recommendationsViewed: number;
    refinementRequests: number;
    clarificationNeeded: boolean;
    expressedFrustration: boolean;
    expressedSatisfaction: boolean;
  };
}

async function callRecommendationAPI(query: string, context: {
  userId?: string;
  recipientId?: string;
  occasion?: string;
  interests?: string[];
  budget?: { min: number; max: number };
}): Promise<{ items: any[]; tookMs: number }> {
  try {
    const response = await fetch(`${API_BASE}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: context.userId || `test_user_${Date.now()}`,
        recipientId: context.recipientId,
        occasion: context.occasion,
        interests: context.interests,
        query: {
          text: query,
          budgetMin: context.budget?.min,
          budgetMax: context.budget?.max,
          limit: 5,
        },
      }),
    });

    if (!response.ok) {
      console.error('API error:', response.status);
      return { items: [], tookMs: 0 };
    }

    const data = await response.json();
    return { items: data.items || [], tookMs: data.tookMs || 0 };
  } catch (error: any) {
    console.error('API call failed:', error.message);
    return { items: [], tookMs: 0 };
  }
}

function simulateAssistantResponse(
  userMessage: string,
  recommendations: any[],
  persona: Persona,
  scenario: Scenario,
  turnNumber: number
): string {
  const lowerMsg = userMessage.toLowerCase();

  // Handle greetings
  if (turnNumber === 0) {
    return `I'd be happy to help you find the perfect ${scenario.occasion} gift for your ${scenario.recipient}! Let me show you some thoughtful options.`;
  }

  // Handle budget questions
  if (lowerMsg.includes('affordable') || lowerMsg.includes('cheaper') || lowerMsg.includes('value')) {
    return `Here are some great value options within your budget. All of these offer excellent quality for the price.`;
  }

  // Handle shipping/urgency questions
  if (lowerMsg.includes('quickly') || lowerMsg.includes('fast') || lowerMsg.includes('shipping')) {
    return `Most of these items offer express shipping options. I can help you filter for items with the fastest delivery times.`;
  }

  // Handle quality/comparison questions
  if (lowerMsg.includes('special') || lowerMsg.includes('meaningful') || lowerMsg.includes('compared')) {
    if (recommendations.length > 0) {
      const firstItem = recommendations[0];
      return `This ${firstItem.product.title} stands out because ${firstItem.rationale}. It's particularly well-suited for someone who enjoys ${scenario.interests?.[0] || 'their hobbies'}.`;
    }
    return `Each of these gifts has been chosen based on your recipient's interests and your relationship. They're all meaningful options that show you've put thought into this.`;
  }

  // Handle practical/useful questions
  if (lowerMsg.includes('practical') || lowerMsg.includes('useful') || lowerMsg.includes('actually use')) {
    return `These are all practical items that your ${scenario.recipient} will use regularly. I've prioritized functionality alongside thoughtfulness.`;
  }

  // Handle premium/impressive questions
  if (lowerMsg.includes('premium') || lowerMsg.includes('impressive') || lowerMsg.includes('luxur')) {
    return `Let me show you some more premium options that really make a statement. These are our top-tier gifts in this category.`;
  }

  // Handle tech/usability questions
  if (lowerMsg.includes('easy to use') || lowerMsg.includes('explain') || lowerMsg.includes('how does')) {
    return `This product is very user-friendly and straightforward to use. It's designed to be intuitive, even for people who aren't particularly tech-savvy.`;
  }

  // Handle anxiety/reassurance
  if (lowerMsg.includes('nervous') || lowerMsg.includes('definitely like') || lowerMsg.includes('getting it wrong')) {
    return `This is a safe and thoughtful choice! Based on their interests in ${scenario.interests?.join(' and ')}, this gift aligns perfectly with what they enjoy. You're making a great choice.`;
  }

  // Handle presentation questions
  if (lowerMsg.includes('presentation') || lowerMsg.includes('wrap') || lowerMsg.includes('package')) {
    return `Many of these items come with gift-ready packaging. You could also add a personal touch with a handwritten note mentioning why you chose this based on their love of ${scenario.interests?.[0]}.`;
  }

  // Default responses
  const defaults = [
    `Based on what you've told me, I think these options would be perfect. Each one connects to their interests and stays within your budget.`,
    `Here are some refined suggestions that match what you're looking for. Let me know if you'd like to see more options in a specific direction.`,
    `Great question! These recommendations take into account both their interests and the significance of the occasion.`,
  ];

  return defaults[turnNumber % defaults.length];
}

async function runConversation(
  conversationId: number,
  persona: Persona,
  scenario: Scenario
): Promise<ConversationLog> {
  const startTime = new Date().toISOString();
  const turns: ConversationTurn[] = [];
  const userId = `test_${persona.id}_${conversationId}`;
  const recipientId = scenario.recipient.replace(/\s+/g, '_');

  console.log(`\n[${ conversationId}] Running conversation:`);
  console.log(`  Persona: ${formatPersonaDescription(persona)}`);
  console.log(`  Scenario: ${formatScenarioDescription(scenario)}`);

  // Generate conversation flow
  const userMessages = generateConversationFlow(persona, scenario);

  // Limit to 3-5 turns for realistic conversations
  const numTurns = Math.min(3 + Math.floor(Math.random() * 3), userMessages.length);

  let questionsAsked = 0;
  let recommendationsViewed = 0;
  let refinementRequests = 0;
  let clarificationNeeded = false;
  let expressedFrustration = false;
  let expressedSatisfaction = false;

  for (let i = 0; i < numTurns; i++) {
    const userMessage = userMessages[i];

    // Track user message
    turns.push({
      role: 'user',
      message: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Check for indicators
    if (userMessage.includes('?')) questionsAsked++;
    if (userMessage.toLowerCase().includes('other') || userMessage.toLowerCase().includes('more')) {
      refinementRequests++;
    }
    if (userMessage.toLowerCase().includes('frustrated') || userMessage.toLowerCase().includes('confused')) {
      expressedFrustration = true;
    }
    if (userMessage.toLowerCase().includes('perfect') || userMessage.toLowerCase().includes('love')) {
      expressedSatisfaction = true;
    }

    // Call recommendation API on first turn and refinement requests
    let recommendations: any[] = [];
    let tookMs = 0;

    if (i === 0 || refinementRequests > 0) {
      const result = await callRecommendationAPI(userMessage, {
        userId,
        recipientId,
        occasion: scenario.occasion,
        interests: scenario.interests,
        budget: scenario.budget,
      });
      recommendations = result.items;
      tookMs = result.tookMs;
      recommendationsViewed += recommendations.length;
    }

    // Simulate assistant response
    const assistantMessage = simulateAssistantResponse(
      userMessage,
      recommendations,
      persona,
      scenario,
      i
    );

    turns.push({
      role: 'assistant',
      message: assistantMessage,
      timestamp: new Date().toISOString(),
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      tookMs: tookMs > 0 ? tookMs : undefined,
    });

    // Small delay between turns
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const endTime = new Date().toISOString();
  const totalDuration = new Date(endTime).getTime() - new Date(startTime).getTime();

  console.log(`  ✓ Completed in ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  → ${turns.length / 2} turns, ${recommendationsViewed} recommendations viewed`);

  return {
    id: conversationId,
    persona,
    scenario,
    turns,
    startTime,
    endTime,
    totalDuration,
    satisfactionIndicators: {
      questionsAsked,
      recommendationsViewed,
      refinementRequests,
      clarificationNeeded,
      expressedFrustration,
      expressedSatisfaction,
    },
  };
}

async function generatePersonaScenarioPairs(count: number): Promise<Array<{ persona: Persona; scenario: Scenario }>> {
  const pairs: Array<{ persona: Persona; scenario: Scenario }> = [];

  // Ensure good distribution
  const personasPerScenario = Math.ceil(count / SCENARIOS.length);

  for (let i = 0; i < count; i++) {
    const personaIdx = i % PERSONAS.length;
    const scenarioIdx = Math.floor(i / personasPerScenario) % SCENARIOS.length;

    pairs.push({
      persona: PERSONAS[personaIdx],
      scenario: SCENARIOS[scenarioIdx],
    });
  }

  // Shuffle for variety
  return pairs.sort(() => Math.random() - 0.5);
}

async function main() {
  console.log('🎁 Starting 50 Gift-Finding Conversation Tests\n');
  console.log('=' .repeat(70));

  const pairs = await generatePersonaScenarioPairs(50);
  const conversations: ConversationLog[] = [];

  // Run conversations sequentially to avoid overloading API
  for (let i = 0; i < pairs.length; i++) {
    const { persona, scenario } = pairs[i];
    try {
      const conversation = await runConversation(i + 1, persona, scenario);
      conversations.push(conversation);

      // Small delay between conversations
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ Completed ${conversations.length}/50 conversations\n`);

  // Save all conversations
  const outputDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `conversations-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(conversations, null, 2));
  console.log(`📝 Saved conversations to: ${outputPath}\n`);

  // Generate summary statistics
  const stats = {
    totalConversations: conversations.length,
    avgTurns: conversations.reduce((sum, c) => sum + c.turns.length, 0) / conversations.length / 2,
    avgDuration: conversations.reduce((sum, c) => sum + c.totalDuration, 0) / conversations.length,
    avgRecommendations: conversations.reduce((sum, c) => sum + c.satisfactionIndicators.recommendationsViewed, 0) / conversations.length,
    avgQuestions: conversations.reduce((sum, c) => sum + c.satisfactionIndicators.questionsAsked, 0) / conversations.length,
    refinementRate: conversations.filter(c => c.satisfactionIndicators.refinementRequests > 0).length / conversations.length,
    frustrationRate: conversations.filter(c => c.satisfactionIndicators.expressedFrustration).length / conversations.length,
    satisfactionRate: conversations.filter(c => c.satisfactionIndicators.expressedSatisfaction).length / conversations.length,
  };

  console.log('📊 Summary Statistics:');
  console.log(`  Average turns per conversation: ${stats.avgTurns.toFixed(1)}`);
  console.log(`  Average duration: ${(stats.avgDuration / 1000).toFixed(1)}s`);
  console.log(`  Average recommendations viewed: ${stats.avgRecommendations.toFixed(1)}`);
  console.log(`  Average questions asked: ${stats.avgQuestions.toFixed(1)}`);
  console.log(`  Refinement rate: ${(stats.refinementRate * 100).toFixed(1)}%`);
  console.log(`  Satisfaction rate: ${(stats.satisfactionRate * 100).toFixed(1)}%`);
  console.log(`  Frustration rate: ${(stats.frustrationRate * 100).toFixed(1)}%`);

  console.log(`\n✅ Test complete! Now run analysis script to identify UX improvements.\n`);
}

main().catch(console.error);
