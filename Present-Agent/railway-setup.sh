#!/bin/bash
# Railway deployment setup script for Present-Agent

echo "🚂 Setting up Railway deployment for Present-Agent"
echo ""

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Initialize project if not already done
if [ ! -f "railway.toml" ]; then
    echo "📦 Initializing Railway project..."
    railway init
fi

echo ""
echo "🎯 Next steps to complete deployment:"
echo ""
echo "1. Go to railway.app dashboard"
echo "2. In your project, add these services:"
echo "   - Click 'New' → 'Database' → 'PostgreSQL'"
echo "   - Click 'New' → 'Database' → 'Redis'"
echo "   - Click 'New' → 'Template' → Search 'Neo4j' → Deploy"
echo "   - Click 'New' → 'Template' → Search 'Qdrant' → Deploy"
echo ""
echo "3. Add environment variables to your backend service:"
echo "   - OPENAI_API_KEY=<your-key>"
echo "   - MODE=five-db"
echo "   - PORT=3001"
echo ""
echo "4. The databases will auto-populate these variables:"
echo "   - POSTGRES_URL (from PostgreSQL service)"
echo "   - REDIS_URL (from Redis service)"
echo "   - NEO4J_URL (from Neo4j template)"
echo "   - NEO4J_USER=neo4j"
echo "   - NEO4J_PASSWORD (from Neo4j template)"
echo "   - VECTOR_DB_URL (from Qdrant template)"
echo ""
echo "5. Deploy your backend:"
echo "   railway up"
echo ""
echo "6. Get your public URL:"
echo "   railway domain"
echo ""
echo "7. Update Vercel frontend environment variable:"
echo "   NEXT_PUBLIC_API_BASE=<your-railway-backend-url>"
echo ""
