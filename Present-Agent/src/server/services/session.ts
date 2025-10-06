/**
 * Session-Based Recommendation Tracking
 *
 * Tracks user interactions within a session to adapt recommendations in real-time:
 * - Clicked categories (infer category preferences)
 * - Viewed price ranges (infer budget preferences)
 * - Abandoned products (avoid showing again)
 * - Interaction patterns (clicks vs views)
 */

export interface SessionState {
  id: string;
  userId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  currentQuery?: string;

  // Interaction tracking
  viewedProducts: string[];
  clickedProducts: string[];
  abandonedProducts: string[]; // Viewed but not clicked after 3+ views

  // Inferred preferences
  inferredIntent?: {
    recipientKey?: string;
    occasion?: string;
    priceRange?: { min: number; max: number };
    categories?: string[];
    interests?: string[];
    values?: string[];
  };

  // Metadata
  interactionCount: number;
  deviceType?: string;
}

export interface SessionInteraction {
  type: 'view' | 'click' | 'search' | 'add_to_cart';
  productId?: string;
  query?: string;
  timestamp: Date;
}

/**
 * In-memory session store (use Redis in production)
 */
class SessionStore {
  private sessions: Map<string, SessionState> = new Map();
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create session
   */
  getSession(sessionId: string, userId?: string): SessionState {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        userId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        viewedProducts: [],
        clickedProducts: [],
        abandonedProducts: [],
        interactionCount: 0,
      };
      this.sessions.set(sessionId, session);
    } else {
      // Update last activity
      session.lastActivityAt = new Date();
    }

    return session;
  }

  /**
   * Update session with interaction
   */
  updateSession(sessionId: string, interaction: SessionInteraction): SessionState {
    const session = this.getSession(sessionId);
    session.interactionCount++;

    if (interaction.type === 'view' && interaction.productId) {
      if (!session.viewedProducts.includes(interaction.productId)) {
        session.viewedProducts.push(interaction.productId);
      }
    }

    if (interaction.type === 'click' && interaction.productId) {
      if (!session.clickedProducts.includes(interaction.productId)) {
        session.clickedProducts.push(interaction.productId);
      }
    }

    if (interaction.type === 'search' && interaction.query) {
      session.currentQuery = interaction.query;
    }

    return session;
  }

  /**
   * Infer preferences from interaction patterns
   */
  async inferPreferences(
    sessionId: string,
    catalogService: any
  ): Promise<SessionState['inferredIntent']> {
    const session = this.getSession(sessionId);

    if (!session.inferredIntent) {
      session.inferredIntent = {};
    }

    // Infer category preferences from clicked products
    if (session.clickedProducts.length > 0) {
      const clickedCategories = new Set<string>();
      const prices: number[] = [];

      for (const productId of session.clickedProducts) {
        const product = await catalogService.getById(productId);
        if (product) {
          if (product.category) {
            clickedCategories.add(product.category);
          }
          prices.push(product.price);
        }
      }

      // Update inferred categories
      if (clickedCategories.size > 0) {
        session.inferredIntent.categories = Array.from(clickedCategories);
      }

      // Infer price range (with 20% buffer)
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        session.inferredIntent.priceRange = {
          min: Math.floor(minPrice * 0.8),
          max: Math.ceil(maxPrice * 1.2),
        };
      }
    }

    // Detect abandonment (viewed but not clicked after 3+ views)
    if (session.viewedProducts.length >= 3) {
      const viewedNotClicked = session.viewedProducts.filter(
        (id) => !session.clickedProducts.includes(id)
      );
      if (viewedNotClicked.length >= 3) {
        session.abandonedProducts = viewedNotClicked.slice(-5); // Keep last 5
      }
    }

    return session.inferredIntent;
  }

  /**
   * Get session recommendations context
   */
  getRecommendationContext(sessionId: string): {
    categoryBoost?: string[];
    priceRange?: { min: number; max: number };
    excludeIds?: string[];
  } {
    const session = this.sessions.get(sessionId);
    if (!session || !session.inferredIntent) {
      return {};
    }

    return {
      categoryBoost: session.inferredIntent.categories,
      priceRange: session.inferredIntent.priceRange,
      excludeIds: session.abandonedProducts.length > 0 ? session.abandonedProducts : undefined,
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastActivityAt.getTime();
      if (age > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

// Singleton instance
export const sessionStore = new SessionStore();

// Auto-cleanup every 5 minutes
setInterval(() => {
  const removed = sessionStore.cleanupExpiredSessions();
  if (removed > 0) {
    console.log(`[session] Cleaned up ${removed} expired sessions`);
  }
}, 5 * 60 * 1000);

/**
 * Helper: Extract session ID from request headers or cookies
 */
export function getSessionId(req: any): string {
  // Try to get from cookie
  const cookies = req.headers.cookie?.split(';').map((c: string) => c.trim());
  const sessionCookie = cookies?.find((c: string) => c.startsWith('sessionId='));
  if (sessionCookie) {
    return sessionCookie.split('=')[1];
  }

  // Try to get from header
  if (req.headers['x-session-id']) {
    return req.headers['x-session-id'];
  }

  // Generate new session ID
  return `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper: Track product view event
 */
export async function trackProductView(
  sessionId: string,
  productId: string,
  catalogService: any
): Promise<void> {
  sessionStore.updateSession(sessionId, {
    type: 'view',
    productId,
    timestamp: new Date(),
  });

  // Infer preferences after each interaction
  await sessionStore.inferPreferences(sessionId, catalogService);
}

/**
 * Helper: Track product click event
 */
export async function trackProductClick(
  sessionId: string,
  productId: string,
  catalogService: any
): Promise<void> {
  sessionStore.updateSession(sessionId, {
    type: 'click',
    productId,
    timestamp: new Date(),
  });

  // Infer preferences after each interaction
  await sessionStore.inferPreferences(sessionId, catalogService);
}

/**
 * Helper: Track search event
 */
export function trackSearch(sessionId: string, query: string): void {
  sessionStore.updateSession(sessionId, {
    type: 'search',
    query,
    timestamp: new Date(),
  });
}
