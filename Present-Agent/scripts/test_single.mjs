#!/usr/bin/env node
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

async function testSingleScenario() {
  console.log('🧪 Testing single scenario...\n');

  const message = "Need a gift for my sister's 30th birthday, she loves yoga and sustainability, budget around $50";

  console.log(`💬 User: "${message}"`);

  try {
    const response = await axios.post(`${API_BASE}/api/chat`,
      { message },
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      }
    );

    console.log('\n🤖 AI Response:');
    console.log('  Reply:', response.data.reply || '(none)');

    if (response.data.contextSummary) {
      console.log('  Context:', response.data.contextSummary);
    }

    if (response.data.items && response.data.items.length > 0) {
      console.log(`\n🎁 Recommendations (${response.data.items.length}):`);
      response.data.items.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.product?.title || 'Unknown'} - $${item.product?.price || 0}`);
        if (item.rationale) {
          console.log(`     💭 "${item.rationale}"`);
        }
      });
    } else {
      console.log('\n⚠️  No recommendations returned');
    }

    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSingleScenario();
