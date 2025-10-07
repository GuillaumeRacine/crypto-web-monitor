#!/usr/bin/env node
/**
 * Conversation UX Analysis
 *
 * Analyzes 50 conversations to identify UX improvement opportunities
 */

import fs from 'fs';
import path from 'path';

interface ConversationTurn {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  recommendations?: any[];
  tookMs?: number;
}

interface ConversationLog {
  id: number;
  persona: any;
  scenario: any;
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

interface UXIssue {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  affectedConversations: number[];
  recommendation: string;
  priority: number;
}

function analyzeConversations(conversations: ConversationLog[]): {
  issues: UXIssue[];
  patterns: any;
  recommendations: any;
} {
  const issues: UXIssue[] = [];
  const patterns = {
    commonQuestions: new Map<string, number>(),
    frustrationTriggers: [] as string[],
    successPatterns: [] as string[],
    dropOffPoints: [] as string[],
    responseTimeIssues: [] as number[],
  };

  // Analyze each conversation
  for (const conv of conversations) {
    const { persona, scenario, turns, satisfactionIndicators } = conv;

    // Check for slow response times
    turns.forEach(turn => {
      if (turn.tookMs && turn.tookMs > 3000) {
        patterns.responseTimeIssues.push(conv.id);
      }
    });

    // Analyze user messages for patterns
    turns.filter(t => t.role === 'user').forEach((turn, idx) => {
      const msg = turn.message.toLowerCase();

      // Track common questions
      if (msg.includes('?')) {
        const question = extractQuestionType(msg);
        patterns.commonQuestions.set(question, (patterns.commonQuestions.get(question) || 0) + 1);
      }

      // Track frustration signals
      if (msg.includes('confused') || msg.includes('frustrated') || msg.includes('not what i') ||
          msg.includes('but') && msg.includes('wanted')) {
        patterns.frustrationTriggers.push(`Conversation ${conv.id}: ${msg}`);
      }

      // Track success signals
      if (msg.includes('perfect') || msg.includes('exactly') || msg.includes('love') || msg.includes('great')) {
        patterns.successPatterns.push(`Conversation ${conv.id}: ${msg}`);
      }

      // Track drop-off (short conversations)
      if (turns.length < 6) {
        patterns.dropOffPoints.push(`Conversation ${conv.id}: Only ${turns.length / 2} turns`);
      }
    });

    // Issue: Too many refinement requests
    if (satisfactionIndicators.refinementRequests > 2) {
      const existing = issues.find(i => i.category === 'refinement_overload');
      if (existing) {
        existing.affectedConversations.push(conv.id);
        existing.evidence.push(`${persona.name}: ${satisfactionIndicators.refinementRequests} refinements`);
      } else {
        issues.push({
          category: 'refinement_overload',
          severity: 'high',
          description: 'Users need too many refinements to find suitable gifts',
          evidence: [`${persona.name}: ${satisfactionIndicators.refinementRequests} refinements`],
          affectedConversations: [conv.id],
          recommendation: 'Improve initial recommendation accuracy with better context gathering upfront',
          priority: 95,
        });
      }
    }

    // Issue: Low-tech users struggling
    if (persona.techSavviness === 'low') {
      const techQuestions = turns.filter(t =>
        t.role === 'user' && (
          t.message.toLowerCase().includes('explain') ||
          t.message.toLowerCase().includes('how does') ||
          t.message.toLowerCase().includes('what is')
        )
      );

      if (techQuestions.length > 1) {
        const existing = issues.find(i => i.category === 'tech_savviness_barrier');
        if (existing) {
          existing.affectedConversations.push(conv.id);
        } else {
          issues.push({
            category: 'tech_savviness_barrier',
            severity: 'medium',
            description: 'Low-tech users need more product explanations',
            evidence: techQuestions.map(q => q.message),
            affectedConversations: [conv.id],
            recommendation: 'Add simplified product descriptions and visual guides for complex items',
            priority: 70,
          });
        }
      }
    }

    // Issue: Budget concerns
    const budgetMentions = turns.filter(t =>
      t.role === 'user' && (
        t.message.toLowerCase().includes('cheaper') ||
        t.message.toLowerCase().includes('affordable') ||
        t.message.toLowerCase().includes('too expensive') ||
        t.message.toLowerCase().includes('budget')
      )
    );

    if (budgetMentions.length > 0 && scenario.budget) {
      const existing = issues.find(i => i.category === 'budget_mismatch');
      if (existing) {
        existing.affectedConversations.push(conv.id);
        existing.evidence.push(`Budget $${scenario.budget.min}-${scenario.budget.max}, but asked for cheaper`);
      } else {
        issues.push({
          category: 'budget_mismatch',
          severity: 'high',
          description: 'Recommendations exceed stated budget or don\'t show value clearly',
          evidence: [`Budget $${scenario.budget.min}-${scenario.budget.max}, but asked for cheaper`],
          affectedConversations: [conv.id],
          recommendation: 'Prominently display price tiers and value propositions for each recommendation',
          priority: 90,
        });
      }
    }

    // Issue: Urgency not addressed
    if (scenario.urgency === 'urgent') {
      const shippingQuestions = turns.filter(t =>
        t.role === 'user' && (
          t.message.toLowerCase().includes('quick') ||
          t.message.toLowerCase().includes('fast') ||
          t.message.toLowerCase().includes('asap') ||
          t.message.toLowerCase().includes('shipping')
        )
      );

      if (shippingQuestions.length > 0) {
        const existing = issues.find(i => i.category === 'urgency_not_prioritized');
        if (existing) {
          existing.affectedConversations.push(conv.id);
        } else {
          issues.push({
            category: 'urgency_not_prioritized',
            severity: 'high',
            description: 'Urgent shoppers need shipping/delivery info upfront',
            evidence: shippingQuestions.map(q => q.message),
            affectedConversations: [conv.id],
            recommendation: 'Detect urgency signals and automatically filter/sort by delivery speed',
            priority: 85,
          });
        }
      }
    }

    // Issue: Emotional reassurance needed
    if (persona.giftGivingStyle === 'thoughtful' || scenario.emotionalContext?.includes('nervous')) {
      const reassuranceRequests = turns.filter(t =>
        t.role === 'user' && (
          t.message.toLowerCase().includes('definitely like') ||
          t.message.toLowerCase().includes('nervous') ||
          t.message.toLowerCase().includes('wrong') ||
          t.message.toLowerCase().includes('sure')
        )
      );

      if (reassuranceRequests.length > 0) {
        const existing = issues.find(i => i.category === 'emotional_support_needed');
        if (existing) {
          existing.affectedConversations.push(conv.id);
        } else {
          issues.push({
            category: 'emotional_support_needed',
            severity: 'medium',
            description: 'Anxious gift-givers need more reassurance and confidence-building',
            evidence: reassuranceRequests.map(q => q.message),
            affectedConversations: [conv.id],
            recommendation: 'Add social proof (reviews, ratings), success stories, and "why this works" explanations',
            priority: 75,
          });
        }
      }
    }

    // Issue: Comparison shopping
    const comparisonRequests = turns.filter(t =>
      t.role === 'user' && (
        t.message.toLowerCase().includes('compared to') ||
        t.message.toLowerCase().includes('other options') ||
        t.message.toLowerCase().includes('what else') ||
        t.message.toLowerCase().includes('alternatives')
      )
    );

    if (comparisonRequests.length > 1) {
      const existing = issues.find(i => i.category === 'comparison_difficulty');
      if (existing) {
        existing.affectedConversations.push(conv.id);
      } else {
        issues.push({
          category: 'comparison_difficulty',
          severity: 'medium',
          description: 'Users want easier side-by-side comparisons',
          evidence: comparisonRequests.map(q => q.message),
          affectedConversations: [conv.id],
          recommendation: 'Add comparison view showing key attributes side-by-side',
          priority: 65,
        });
      }
    }

    // Issue: Response time
    if (patterns.responseTimeIssues.includes(conv.id)) {
      const existing = issues.find(i => i.category === 'slow_response_time');
      if (existing) {
        existing.affectedConversations.push(conv.id);
      } else {
        issues.push({
          category: 'slow_response_time',
          severity: 'critical',
          description: 'Recommendation API takes too long (>3s)',
          evidence: [`Conversation ${conv.id} had slow responses`],
          affectedConversations: [conv.id],
          recommendation: 'Optimize recommendation pipeline, add loading states, show partial results',
          priority: 100,
        });
      }
    }
  }

  // Analyze persona-specific patterns
  const personaAnalysis = analyzeByPersona(conversations);
  const scenarioAnalysis = analyzeByScenario(conversations);

  // Sort issues by priority
  issues.sort((a, b) => b.priority - a.priority);

  return {
    issues,
    patterns: {
      commonQuestions: Array.from(patterns.commonQuestions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      frustrationTriggers: patterns.frustrationTriggers.slice(0, 10),
      successPatterns: patterns.successPatterns.slice(0, 10),
      dropOffPoints: patterns.dropOffPoints,
      responseTimeIssues: patterns.responseTimeIssues,
    },
    recommendations: {
      personaSpecific: personaAnalysis,
      scenarioSpecific: scenarioAnalysis,
    },
  };
}

function extractQuestionType(question: string): string {
  if (question.includes('ship') || question.includes('deliver') || question.includes('fast')) {
    return 'Shipping/Delivery';
  }
  if (question.includes('budget') || question.includes('cost') || question.includes('price')) {
    return 'Budget/Price';
  }
  if (question.includes('like') || question.includes('love') || question.includes('right')) {
    return 'Reassurance';
  }
  if (question.includes('explain') || question.includes('what is') || question.includes('how does')) {
    return 'Product Understanding';
  }
  if (question.includes('other') || question.includes('more') || question.includes('else')) {
    return 'Alternative Options';
  }
  if (question.includes('special') || question.includes('meaningful') || question.includes('unique')) {
    return 'Uniqueness/Meaning';
  }
  return 'General';
}

function analyzeByPersona(conversations: ConversationLog[]): any {
  const byPersona = new Map<string, ConversationLog[]>();

  conversations.forEach(conv => {
    const key = conv.persona.id;
    if (!byPersona.has(key)) {
      byPersona.set(key, []);
    }
    byPersona.get(key)!.push(conv);
  });

  const insights: any[] = [];

  byPersona.forEach((convs, personaId) => {
    const persona = convs[0].persona;
    const avgTurns = convs.reduce((sum, c) => sum + c.turns.length, 0) / convs.length / 2;
    const avgRefinements = convs.reduce((sum, c) => sum + c.satisfactionIndicators.refinementRequests, 0) / convs.length;
    const satisfactionRate = convs.filter(c => c.satisfactionIndicators.expressedSatisfaction).length / convs.length;

    insights.push({
      persona: persona.name,
      giftGivingStyle: persona.giftGivingStyle,
      techSavviness: persona.techSavviness,
      avgTurns,
      avgRefinements,
      satisfactionRate,
      insight: generatePersonaInsight(persona, avgTurns, avgRefinements, satisfactionRate),
    });
  });

  return insights;
}

function analyzeByScenario(conversations: ConversationLog[]): any {
  const byOccasion = new Map<string, ConversationLog[]>();

  conversations.forEach(conv => {
    const key = conv.scenario.occasion;
    if (!byOccasion.has(key)) {
      byOccasion.set(key, []);
    }
    byOccasion.get(key)!.push(conv);
  });

  const insights: any[] = [];

  byOccasion.forEach((convs, occasion) => {
    const avgTurns = convs.reduce((sum, c) => sum + c.turns.length, 0) / convs.length / 2;
    const avgRefinements = convs.reduce((sum, c) => sum + c.satisfactionIndicators.refinementRequests, 0) / convs.length;

    insights.push({
      occasion,
      count: convs.length,
      avgTurns,
      avgRefinements,
      insight: `${occasion} gifts require ${avgRefinements.toFixed(1)} refinements on average`,
    });
  });

  return insights.sort((a, b) => b.avgRefinements - a.avgRefinements);
}

function generatePersonaInsight(persona: any, avgTurns: number, avgRefinements: number, satisfactionRate: number): string {
  if (persona.giftGivingStyle === 'last-minute' && avgTurns > 4) {
    return 'Last-minute shoppers need faster, more decisive recommendations';
  }
  if (persona.giftGivingStyle === 'thoughtful' && avgRefinements > 2) {
    return 'Thoughtful gift-givers need richer context and storytelling around products';
  }
  if (persona.techSavviness === 'low' && avgTurns > 4) {
    return 'Low-tech users need simpler interfaces and clearer explanations';
  }
  if (satisfactionRate < 0.3) {
    return `Low satisfaction rate (${(satisfactionRate * 100).toFixed(0)}%) - needs investigation`;
  }
  if (avgRefinements > 2.5) {
    return 'High refinement rate suggests initial recommendations miss the mark';
  }
  return 'Standard interaction pattern';
}

function generateReport(analysis: any): string {
  const { issues, patterns, recommendations } = analysis;

  let report = `
# UX Analysis Report: Gift-Finding Conversations
Generated: ${new Date().toISOString()}

## Executive Summary

Analyzed 50 gift-finding conversations across diverse personas and scenarios.
Identified ${issues.length} key UX issues requiring attention.

---

## Critical Issues (Priority 90-100)

`;

  const critical = issues.filter((i: UXIssue) => i.priority >= 90);
  critical.forEach((issue: UXIssue, idx: number) => {
    report += `
### ${idx + 1}. ${issue.description}

**Category:** ${issue.category}
**Severity:** ${issue.severity}
**Priority:** ${issue.priority}
**Affected:** ${issue.affectedConversations.length} conversations

**Evidence:**
${issue.evidence.slice(0, 3).map(e => `- ${e}`).join('\n')}

**Recommendation:**
${issue.recommendation}

---
`;
  });

  report += `
## High Priority Issues (Priority 70-89)

`;

  const high = issues.filter((i: UXIssue) => i.priority >= 70 && i.priority < 90);
  high.forEach((issue: UXIssue, idx: number) => {
    report += `
### ${idx + 1}. ${issue.description}

**Priority:** ${issue.priority} | **Affected:** ${issue.affectedConversations.length} conversations

**Recommendation:** ${issue.recommendation}

`;
  });

  report += `
## Common User Questions

`;

  patterns.commonQuestions.slice(0, 10).forEach(([question, count]: [string, number]) => {
    report += `- **${question}**: ${count} occurrences\n`;
  });

  report += `
## Persona-Specific Insights

`;

  recommendations.personaSpecific.forEach((insight: any) => {
    report += `
### ${insight.persona} (${insight.giftGivingStyle}, ${insight.techSavviness} tech)

- Average turns: ${insight.avgTurns.toFixed(1)}
- Average refinements: ${insight.avgRefinements.toFixed(1)}
- Satisfaction rate: ${(insight.satisfactionRate * 100).toFixed(0)}%
- **Insight:** ${insight.insight}

`;
  });

  report += `
## Scenario Complexity Analysis

`;

  recommendations.scenarioSpecific.slice(0, 5).forEach((scenario: any) => {
    report += `- **${scenario.occasion}**: ${scenario.avgRefinements.toFixed(1)} refinements (${scenario.count} conversations)\n`;
  });

  report += `
## Recommended UX Improvements (Prioritized)

`;

  issues.forEach((issue: UXIssue, idx: number) => {
    report += `${idx + 1}. [P${issue.priority}] ${issue.recommendation}\n`;
  });

  report += `
## Success Patterns

`;

  patterns.successPatterns.slice(0, 5).forEach((pattern: string) => {
    report += `- ${pattern}\n`;
  });

  report += `
## Frustration Triggers

`;

  patterns.frustrationTriggers.slice(0, 5).forEach((trigger: string) => {
    report += `- ${trigger}\n`;
  });

  return report;
}

async function main() {
  console.log('📊 Analyzing Conversation Data...\n');

  // Find most recent conversation file
  const resultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(resultsDir)) {
    console.error('❌ No test results found. Run conversation tests first.');
    process.exit(1);
  }

  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('conversations-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('❌ No conversation files found.');
    process.exit(1);
  }

  const latestFile = files[0];
  console.log(`📁 Analyzing: ${latestFile}\n`);

  const data = JSON.parse(fs.readFileSync(path.join(resultsDir, latestFile), 'utf-8'));
  const analysis = analyzeConversations(data);

  // Generate and save report
  const report = generateReport(analysis);
  const reportPath = path.join(resultsDir, `ux-analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  fs.writeFileSync(reportPath, report);

  console.log(`✅ Analysis complete!`);
  console.log(`📄 Report saved to: ${reportPath}\n`);

  // Print summary
  console.log('🎯 Top 5 UX Issues:\n');
  analysis.issues.slice(0, 5).forEach((issue: UXIssue, idx: number) => {
    console.log(`${idx + 1}. [P${issue.priority}] ${issue.description}`);
    console.log(`   → ${issue.recommendation}\n`);
  });
}

main().catch(console.error);
