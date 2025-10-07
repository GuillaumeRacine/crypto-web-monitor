/**
 * Test Personas and Scenarios for UX Analysis
 *
 * Generates realistic gift-finding conversations to identify UX improvements
 */

export interface Persona {
  id: string;
  name: string;
  age: number;
  background: string;
  giftGivingStyle: 'thoughtful' | 'practical' | 'last-minute' | 'budget-conscious' | 'generous';
  techSavviness: 'low' | 'medium' | 'high';
  communicationStyle: 'brief' | 'detailed' | 'conversational';
}

export interface Scenario {
  id: string;
  recipient: string;
  occasion: string;
  relationship: string;
  budget?: { min: number; max: number };
  interests?: string[];
  constraints?: string[];
  urgency: 'flexible' | 'moderate' | 'urgent';
  emotionalContext?: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'p1',
    name: 'Sarah - Busy Mom',
    age: 38,
    background: 'Working mother of two, limited time for shopping',
    giftGivingStyle: 'practical',
    techSavviness: 'medium',
    communicationStyle: 'brief',
  },
  {
    id: 'p2',
    name: 'James - Thoughtful Partner',
    age: 29,
    background: 'Software engineer, wants meaningful gifts',
    giftGivingStyle: 'thoughtful',
    techSavviness: 'high',
    communicationStyle: 'detailed',
  },
  {
    id: 'p3',
    name: 'Maria - Budget-Conscious Student',
    age: 22,
    background: 'College student with limited budget',
    giftGivingStyle: 'budget-conscious',
    techSavviness: 'high',
    communicationStyle: 'conversational',
  },
  {
    id: 'p4',
    name: 'Robert - Last-Minute Shopper',
    age: 45,
    background: 'Busy executive, often forgets occasions',
    giftGivingStyle: 'last-minute',
    techSavviness: 'low',
    communicationStyle: 'brief',
  },
  {
    id: 'p5',
    name: 'Emily - Generous Friend',
    age: 33,
    background: 'Marketing director, loves giving elaborate gifts',
    giftGivingStyle: 'generous',
    techSavviness: 'medium',
    communicationStyle: 'conversational',
  },
  {
    id: 'p6',
    name: 'David - Anxious Gift Giver',
    age: 27,
    background: 'First-time boyfriend, worried about getting it right',
    giftGivingStyle: 'thoughtful',
    techSavviness: 'medium',
    communicationStyle: 'detailed',
  },
  {
    id: 'p7',
    name: 'Lisa - Experienced Grandmother',
    age: 67,
    background: 'Retired teacher, not very tech-savvy',
    giftGivingStyle: 'thoughtful',
    techSavviness: 'low',
    communicationStyle: 'conversational',
  },
  {
    id: 'p8',
    name: 'Alex - Minimalist',
    age: 31,
    background: 'Designer, prefers quality over quantity',
    giftGivingStyle: 'thoughtful',
    techSavviness: 'high',
    communicationStyle: 'brief',
  },
  {
    id: 'p9',
    name: 'Carmen - Party Planner',
    age: 35,
    background: 'Event coordinator, needs multiple gifts',
    giftGivingStyle: 'practical',
    techSavviness: 'medium',
    communicationStyle: 'detailed',
  },
  {
    id: 'p10',
    name: 'Tom - New Parent',
    age: 32,
    background: 'Sleep-deprived dad, needs quick solutions',
    giftGivingStyle: 'last-minute',
    techSavviness: 'medium',
    communicationStyle: 'brief',
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 's1',
    recipient: 'wife',
    occasion: 'anniversary',
    relationship: 'spouse',
    budget: { min: 50, max: 200 },
    interests: ['cooking', 'wine', 'reading'],
    urgency: 'moderate',
    emotionalContext: 'wants to show appreciation',
  },
  {
    id: 's2',
    recipient: 'mom',
    occasion: 'birthday',
    relationship: 'mother',
    budget: { min: 30, max: 80 },
    interests: ['gardening', 'knitting', 'tea'],
    urgency: 'flexible',
    emotionalContext: 'wants to make her feel special',
  },
  {
    id: 's3',
    recipient: 'best friend',
    occasion: 'graduation',
    relationship: 'friend',
    budget: { min: 20, max: 50 },
    interests: ['travel', 'photography', 'coffee'],
    urgency: 'urgent',
    constraints: ['already has a camera'],
  },
  {
    id: 's4',
    recipient: 'girlfriend',
    occasion: 'first Valentine\'s Day',
    relationship: 'romantic partner',
    budget: { min: 40, max: 100 },
    interests: ['yoga', 'sustainability', 'art'],
    urgency: 'urgent',
    emotionalContext: 'nervous, wants to impress',
  },
  {
    id: 's5',
    recipient: 'dad',
    occasion: 'Father\'s Day',
    relationship: 'father',
    budget: { min: 50, max: 150 },
    interests: ['golf', 'grilling', 'woodworking'],
    urgency: 'moderate',
    emotionalContext: 'dad is hard to shop for',
  },
  {
    id: 's6',
    recipient: 'coworker',
    occasion: 'retirement',
    relationship: 'colleague',
    budget: { min: 25, max: 60 },
    urgency: 'urgent',
    constraints: ['office-appropriate', 'group gift'],
  },
  {
    id: 's7',
    recipient: 'grandson',
    occasion: 'high school graduation',
    relationship: 'grandchild',
    budget: { min: 100, max: 300 },
    interests: ['gaming', 'basketball', 'music'],
    urgency: 'flexible',
  },
  {
    id: 's8',
    recipient: 'sister',
    occasion: 'housewarming',
    relationship: 'sibling',
    budget: { min: 40, max: 90 },
    interests: ['interior design', 'plants', 'candles'],
    urgency: 'moderate',
  },
  {
    id: 's9',
    recipient: 'niece',
    occasion: 'sweet 16',
    relationship: 'niece',
    budget: { min: 30, max: 70 },
    interests: ['makeup', 'fashion', 'TikTok'],
    urgency: 'moderate',
    emotionalContext: 'wants to be the cool aunt',
  },
  {
    id: 's10',
    recipient: 'boss',
    occasion: 'promotion',
    relationship: 'professional',
    budget: { min: 30, max: 80 },
    urgency: 'urgent',
    constraints: ['professional', 'not too personal'],
  },
  // Additional scenarios for variety
  {
    id: 's11',
    recipient: 'husband',
    occasion: 'just because',
    relationship: 'spouse',
    budget: { min: 20, max: 60 },
    interests: ['tech', 'fitness', 'craft beer'],
    urgency: 'flexible',
  },
  {
    id: 's12',
    recipient: 'daughter',
    occasion: 'first apartment',
    relationship: 'child',
    budget: { min: 50, max: 150 },
    interests: ['cooking', 'organization', 'plants'],
    urgency: 'moderate',
  },
  {
    id: 's13',
    recipient: 'brother',
    occasion: 'new job',
    relationship: 'sibling',
    budget: { min: 30, max: 80 },
    interests: ['suits', 'coffee', 'productivity'],
    urgency: 'flexible',
  },
  {
    id: 's14',
    recipient: 'teacher',
    occasion: 'end of year',
    relationship: 'professional',
    budget: { min: 15, max: 35 },
    urgency: 'urgent',
    constraints: ['classroom appropriate'],
  },
  {
    id: 's15',
    recipient: 'aunt',
    occasion: 'thank you gift',
    relationship: 'family',
    budget: { min: 25, max: 60 },
    interests: ['books', 'jewelry', 'scarves'],
    urgency: 'flexible',
  },
];

export function generateConversationFlow(persona: Persona, scenario: Scenario): string[] {
  const messages: string[] = [];

  // Opening message based on communication style and urgency
  if (persona.communicationStyle === 'brief') {
    if (scenario.urgency === 'urgent') {
      messages.push(`Need a gift for my ${scenario.recipient} ASAP. ${scenario.occasion}. Budget around $${scenario.budget?.max || 50}.`);
    } else {
      messages.push(`Looking for ${scenario.occasion} gift for ${scenario.recipient}. Budget: $${scenario.budget?.min}-${scenario.budget?.max}.`);
    }
  } else if (persona.communicationStyle === 'detailed') {
    let msg = `Hi! I'm looking for a ${scenario.occasion} gift for my ${scenario.recipient}.`;
    if (scenario.emotionalContext) msg += ` ${scenario.emotionalContext}.`;
    if (scenario.interests) msg += ` They're really into ${scenario.interests.slice(0, 2).join(' and ')}.`;
    if (scenario.budget) msg += ` My budget is between $${scenario.budget.min} and $${scenario.budget.max}.`;
    if (scenario.constraints) msg += ` One thing - ${scenario.constraints[0]}.`;
    messages.push(msg);
  } else {
    // conversational
    messages.push(`Hey! So my ${scenario.recipient}'s ${scenario.occasion} is coming up and I could use some help finding the perfect gift.`);
  }

  // Follow-up questions based on persona style
  if (persona.giftGivingStyle === 'thoughtful') {
    messages.push("Does this gift feel meaningful? I want it to show I really know them.");
    messages.push("What makes this special compared to other options?");
  } else if (persona.giftGivingStyle === 'budget-conscious') {
    messages.push("Is there anything similar but more affordable?");
    messages.push("Can you show me the best value options?");
  } else if (persona.giftGivingStyle === 'last-minute') {
    messages.push("How quickly can I get this?");
    messages.push("Do you have other quick options?");
  } else if (persona.giftGivingStyle === 'practical') {
    messages.push("Is this actually useful or just decorative?");
    messages.push("What are the most practical options?");
  } else {
    messages.push("Can you show me something more premium?");
    messages.push("What's the most impressive gift you can recommend?");
  }

  // Tech-savviness affects clarity of requests
  if (persona.techSavviness === 'low') {
    messages.push("Can you explain what this product does?");
    messages.push("Is this easy to use for someone not great with technology?");
  }

  // Emotional context follow-ups
  if (scenario.emotionalContext) {
    if (scenario.emotionalContext.includes('nervous') || scenario.emotionalContext.includes('worried')) {
      messages.push("Will they definitely like this? I'm a bit nervous about getting it wrong.");
    }
    if (scenario.emotionalContext.includes('special')) {
      messages.push("How can I make the gift presentation more special?");
    }
  }

  return messages;
}

export function formatPersonaDescription(persona: Persona): string {
  return `${persona.name} (${persona.age}yo, ${persona.giftGivingStyle} gift-giver, ${persona.techSavviness} tech-savviness, ${persona.communicationStyle} communication)`;
}

export function formatScenarioDescription(scenario: Scenario): string {
  let desc = `${scenario.occasion} gift for ${scenario.recipient} (${scenario.relationship})`;
  if (scenario.budget) desc += ` | Budget: $${scenario.budget.min}-${scenario.budget.max}`;
  if (scenario.interests) desc += ` | Interests: ${scenario.interests.join(', ')}`;
  if (scenario.urgency === 'urgent') desc += ` | URGENT`;
  return desc;
}
