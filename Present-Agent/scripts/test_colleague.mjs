#!/usr/bin/env node
// Quick test: colleague gift should return professional items, not costumes/party supplies

const base = 'http://localhost:3001';

async function testColleague() {
  console.log('\n🧪 Testing colleague gift recommendations...\n');

  // First message: establish colleague context
  const r1 = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'I need a gift for a colleague, budget is $30' })
  });
  const d1 = await r1.json();

  console.log('User: I need a gift for a colleague, budget is $30');
  console.log(`Bot: ${d1.reply}\n`);

  if (d1.items) {
    console.log('📦 Recommended items:');
    d1.items.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.product.name} ($${item.product.price})`);
      console.log(`     Category: ${item.product.category || 'N/A'}`);
      console.log(`     ${item.rationale || ''}\n`);
    });

    // Check for inappropriate items
    const inappropriate = d1.items.filter(item => {
      const name = (item.product.name || '').toLowerCase();
      const category = (item.product.category || '').toLowerCase();
      return name.includes('costume') ||
             name.includes('party') ||
             name.includes('pirate') ||
             category.includes('costume') ||
             category.includes('party');
    });

    if (inappropriate.length > 0) {
      console.log('❌ FAIL: Found inappropriate items for colleague gift:');
      inappropriate.forEach(item => {
        console.log(`   - ${item.product.name} (${item.product.category})`);
      });
      return false;
    } else {
      console.log('✅ PASS: All items appear appropriate for colleague gifts');
      return true;
    }
  } else {
    console.log('⚠️  No recommendations returned');
    return false;
  }
}

testColleague().then(success => {
  process.exit(success ? 0 : 1);
});
