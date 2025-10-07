🎯 Overview
AI-powered relationship intelligence platform that transforms gift-giving through deep personalization and cultural sensitivity. Uses conversational AI - voice and text - to understand relationship dynamics and provide hyper-personalized and relevant gift recommendations in under 2 minutes. Our mission is to offer the most memorable gifting experiences for both the gifter and the recipient.

📊 Problem Validation
78% of people report gift-giving anxiety
$75B in unwanted gifts returned annually (US)
Average person spends 10+ hours annually searching for gifts
43% report gift disappointment damages relationships
Most people struggle at least partially with last minute gifts for recurring occasions (birthday, valentine's)

🔬 Core Assumptions to Test
Hybrid Intelligence > Pure Search: Recommendation engine that layers context and learns comprehensively about the user, their relationships, the occasions, and other qualitative and quantitative dimensions to refine quality and relevance. We explicitly compare against Amazon/Google Shopping on identical tasks (>70% preference target).
Memory Creates Compounding Value: System improves measurably with each interaction and becomes intuitive—even proactive—as you delegate gift decisions (>30% improvement in confidence and satisfaction).
Conversational UI collects better attributes and preferences. Users prefer a personal assistant that “knows them” and provides smart, succinct outputs with clear rationales. Encourage voice input or quick text capture to reduce friction.
Fast + Learning = Retention: Sub-2-minute path to confident suggestions, with >50% intention to return (plan next gift with our app).

Hypothesis vs Current Options: Generic shopping engines don’t model “who you’re shopping for,” what they like, or why you’re buying. A relationship- and context-centered algorithm can be more user-centric and deliver truly relevant gifts while alleviating pain points in planning, deciding, and remembering recurring occasions.

💡 Solution Approach
Relationship and user-context centered architecture that learns the complete dynamics for deciding on the best gift options.
Emotional intelligence understanding the "why" behind gifts, why products might be special for a given occation or person, etc. so that it feels like a considered, one of a kind gift experience.

Network effect learning from all user outcomes using deep learning to learn unsupervised
Generate proprietary data from users, products, curations, etc. and measure product market fit clearly with specific metrics over time 
e.g. Values-based matching (sustainable, local, handmade) - use vectors or dimensions that a typical recommendation engine wouldn't normally factor into the algoryth. Learn from user and recepient social media profiles for example.

📈 Business Model
Transaction-based (60%): commission on sales + premium delivery extras (and extra vip concierge deliveries)

🏗 Technical Architecture
5-Database Hybrid System:
PostgreSQL: Users, sessions, transactions
Neo4j: Relationship graphs, social patterns
Vector DB: Semantic embeddings, gift matching
Redis: Real-time state, hot recommendations
Event Store: Behavioral history, learning patterns
AI/ML Stack:
GPT-5 for conversation and reasoning
RAG system for gift catalog + cultural knowledge
Vector search for <100ms semantic matching
Multi-stage pipeline: <500ms end-to-end


Front End
- Use Next.JS + vercel for the chat and voice user interfaces. 
- Ultimately the user should be able to text the AI assistant from any channel: social media platforms, web, SMS, slack, email, whatsapp, etc. 
- Initially we just want to do a web UI and test the quality of recommendations, learning how to measure and improve success. The first few beta users will provide feedback to help guide improvements. 

Context & Memory (Updated)
- All inputs are natural language (voice or text); the assistant elicits and confirms minimal details (occasion, relationship, budgets, preferences/values) conversationally.
- We store a compact `user_context` with budgets, values, categories and short notes, and we upsert preferences to Neo4j (LIKES) to improve re‑ranking.
- Every recommendation merges stored context into retrieval; missing budgets or categories are filled from memory, and notes are appended to queries.
- Short, empathetic rationales accompany each suggestion; the system respects cultural sensitivity and avoids biased phrasing.
- Conversation turns are logged minimally for evaluation and iterative improvement.

📏 Measurement Plan
- Baselines: Amazon/Google Shopping on identical prompts (recipient, occasion, budget, constraints) with blind ratings.
- Metrics: perceived relevance, rationale quality, time-to-first-confident-choice, intention to return, task success (saved/purchased), NPS.
- Learning Loop: capture feedback and outcomes in the Event Store; iterate embeddings, graph features, and prompts to improve.
 - Memory Loop: quantify the lift from stored context (A/B on with/without memory), track share of sessions leveraging saved budgets or preferences, and measure reduction in clarifying turns.

—

See also:
- Prototype scope, setup, and developer instructions: `README.md`
- Agent and LLM operating guidelines for this repo: `AGENTS.md`
