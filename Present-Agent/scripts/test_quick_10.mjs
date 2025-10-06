#!/usr/bin/env node
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

// 10 key representative scenarios
const tests = [
  { id: 1, msg: "Need gift for roommate's birthday tomorrow, only have $15", expect: "budget" },
  { id: 2, msg: "Super nervous, meeting my boyfriend's parents this weekend, need a gift", expect: "emotion" },
  { id: 3, msg: "First Mother's Day for my wife! So excited, want something really special", expect: "emotion" },
  { id: 4, msg: "Gift for sister who's obsessed with yoga and meditation, $40-60", expect: "interest+budget" },
  { id: 5, msg: "Looking for eco-friendly gift, sister is very environmentally conscious, $50", expect: "values" },
  { id: 6, msg: "Diwali gift for Indian coworker, want to be respectful, budget $40", expect: "cultural" },
  { id: 7, msg: "I completely forgot my sister's birthday is tomorrow! Help!", expect: "urgency" },
  { id: 8, msg: "Wedding gift for close friend, thinking $75-100", expect: "occasion" },
  { id: 9, msg: "Need gift", expect: "vague" },
  { id: 10, msg: "budget around $50 for my mom", expect: "budget_extraction" }
];

async function chat(message) {
  try {
    const res = await axios.post(`${API_BASE}/api/chat`, { message }, { timeout: 15000 });
    return res.data;
  } catch (err) {
    return { error: err.message };
  }
}

console.log('🧪 Running 10 Quick Conversation Tests\n');

const results = [];

for (const test of tests) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test ${test.id}: ${test.expect}`);
  console.log(`👤 "${test.msg}"`);

  const response = await chat(test.msg);

  if (response.error) {
    console.log(`❌ Error: ${response.error}`);
    results.push({ ...test, status: 'ERROR', error: response.error });
    continue;
  }

  console.log(`🤖 "${response.reply}"`);
  if (response.contextSummary) console.log(`📝 Context: ${response.contextSummary}`);
  if (response.items?.length) console.log(`🎁 Got ${response.items.length} recommendations`);

  const analysis = {
    hasReply: !!response.reply,
    hasItems: (response.items?.length || 0) > 0,
    itemCount: response.items?.length || 0,
    hasContext: !!response.contextSummary,
    replyLength: response.reply?.length || 0,
    appearsWarm: /nice|great|love|perfect|got it|excited/i.test(response.reply || ''),
    appearsEmpathetic: /get it|understand|totally|exciting|breath|worry|stressful/i.test(response.reply || ''),
    askedFollowUp: /\?/.test(response.reply || ''),
    budgetInContext: /budget/i.test(response.contextSummary || ''),
    recipientInContext: /recipient/i.test(response.contextSummary || '')
  };

  results.push({ ...test, response: response.reply, analysis });

  await new Promise(r => setTimeout(r, 500));
}

console.log('\n\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));

const stats = {
  total: results.length,
  errors: results.filter(r => r.status === 'ERROR').length,
  gotRecs: results.filter(r => r.analysis?.hasItems).length,
  warm: results.filter(r => r.analysis?.appearsWarm).length,
  empathetic: results.filter(r => r.analysis?.appearsEmpathetic).length,
  askedFollowUp: results.filter(r => r.analysis?.askedFollowUp).length,
  budgetExtracted: results.filter(r => r.analysis?.budgetInContext).length,
  recipientExtracted: results.filter(r => r.analysis?.recipientInContext).length
};

console.log(`\nTotal: ${stats.total}`);
console.log(`Errors: ${stats.errors}`);
console.log(`Got recommendations: ${stats.gotRecs}/${stats.total} (${(stats.gotRecs/stats.total*100).toFixed(0)}%)`);
console.log(`Warm tone: ${stats.warm}/${stats.total} (${(stats.warm/stats.total*100).toFixed(0)}%)`);
console.log(`Empathetic: ${stats.empathetic}/${stats.total} (${(stats.empathetic/stats.total*100).toFixed(0)}%)`);
console.log(`Asked follow-up: ${stats.askedFollowUp}/${stats.total} (${(stats.askedFollowUp/stats.total*100).toFixed(0)}%)`);
console.log(`Budget extracted: ${stats.budgetExtracted}/${stats.total} (${(stats.budgetExtracted/stats.total*100).toFixed(0)}%)`);
console.log(`Recipient extracted: ${stats.recipientExtracted}/${stats.total} (${(stats.recipientExtracted/stats.total*100).toFixed(0)}%)`);

console.log('\n✅ Quick test complete!\n');
