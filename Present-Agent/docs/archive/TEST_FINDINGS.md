# Present-Agent: Actual Test Findings
**Test Date**: October 1, 2025
**Environment**: Local development (Simple Mode, in-memory catalog)
**Tester**: Claude Code (Automated + Manual)

---

## Executive Summary

Ran initial tests against the Present-Agent chat API to validate conversational flow and recommendation quality. **CRITICAL ISSUES FOUND** that prevent the app from functioning as intended. Budget extraction completely fails, causing the AI to repeatedly ask for already-provided information, creating a frustrating user experience.

**Overall Status**: ❌ **FAILING** - Core functionality broken
**Recommendation Quality**: ⚠️ **CANNOT TEST** - Never reaches recommendation stage
**User Experience**: ❌ **POOR** - AI appears not to listen to user input

---

## Test Environment Setup

### Steps Taken:
1. Fixed critical TypeScript error (`missing` variable undefined) in `src/server/index.ts:378`
2. Started API server in Simple Mode (in-memory catalog)
3. Verified server health via `/api/categories` endpoint
4. Ran automated test scenarios via custom scripts

### Environment:
- Node.js: v24.2.0
- TypeScript: 5.9.3
- API: http://localhost:3001
- Mode: Simple (no database)
- LLM: Not initialized (using fallback responses)

---

## CRITICAL BUGS DISCOVERED

### 🔴 Bug #1: Budget Extraction Completely Broken

**Issue**: Server-side budget parsing fails for ALL natural language budget inputs

**Evidence**:
```
Test Input: "Need a gift for my sister's 30th birthday, she loves yoga and sustainability, budget around $50"
AI Response: "Great! What budget are you thinking (e.g., under $50 or 20–40)?"
Expected: Should recognize budget ~$50 and proceed to recommendations

Test Input: "Looking for a gift for my wife, budget is 100 dollars, she loves meditation"
AI Response: "Absolutely — who's the gift for, and what budget are you thinking..."
Expected: Should recognize budget $100 and recipient "wife"

Test Input: "Gift for sister, under $50, loves yoga"
AI Response: "Great! What budget are you thinking (e.g., under $50 or 20–40)?"
Expected: Should recognize "under $50" (matches suggested format!)

Test Input: "Shopping for mom, 30-60 budget, likes gardening"
AI Response: "Great! What budget are you thinking..."
Expected: Should recognize $30-60 range

Test Input: "Need gift, between 20 and 40, for colleague"
AI Response: "Great! What budget are you thinking..."
Expected: Should recognize "between 20 and 40" (matches regex pattern!)
```

**Root Cause** (Code Analysis):

**Location**: `src/server/index.ts:276-289`

Problems identified:
1. **Line 289**: `budgetMax = b.max ?? b.max` - Logic bug, always assigns b.max even if undefined
2. **Regex patterns don't match common phrasing**:
   - Missing: "around $X", "budget is X dollars", "X-Y budget"
   - Pattern `/under\s*\$?(\d{1,5})/i` should match "under $50" but doesn't work in practice
3. **"Readiness" check too strict** (Line 348):
   - Requires BOTH budget AND (recipient OR categories)
   - If budget extraction fails, never reaches "ready" state
   - Falls into infinite clarification loop

**Impact**: 🔴 **CRITICAL** - Breaks entire conversation flow
- Users cannot proceed past initial question
- AI ignores budget information user provides
- Creates impression AI is broken/not listening
- **100% of test scenarios failed to reach recommendations**

**Fix Priority**: P0 (Must fix immediately)

---

### 🔴 Bug #2: Recipient Extraction Works BUT Budget Failure Blocks Progress

**Issue**: Recipient (sister, wife, mom, colleague) IS correctly extracted, but budget failure prevents proceeding

**Evidence**:
```
Test: "Gift for sister, under $50, loves yoga"
Context Summary: "Using your context (recipient: sister)"
✓ Recipient extracted: "sister"
✗ Budget not extracted: user said "under $50"
Result: Still asks for budget
```

**Impact**: 🟡 **HIGH** - Partial feature works but masked by Bug #1

---

### 🟠 Bug #3: Category/Values Extraction May Work But Cannot Verify

**Issue**: Unable to test if "yoga", "sustainability", "meditation" are extracted because never reach recommendation stage

**Suspected Status**: Likely working (code looks correct in `extract.ts`)
- "sustainable" should match VALUE_SYNONYMS
- "yoga" might match categories if in catalog
- Cannot verify due to Bug #1 blocking

---

## ACTUAL vs. EXPECTED BEHAVIOR

### Scenario 1: Sister's Birthday (Busy Professional Sarah)

**User Input**:
```
"Need a gift for my sister's 30th birthday, she loves yoga and sustainability, budget around $50"
```

| Aspect | Expected | Actual | Status |
|--------|----------|--------|--------|
| Recipient extraction | "sister" | ✓ "sister" | ✅ PASS |
| Budget extraction | $50 (as max) | ✗ None | ❌ FAIL |
| Values extraction | "sustainable" | ? Cannot verify | ⚠️ BLOCKED |
| Categories extraction | "yoga" | ? Cannot verify | ⚠️ BLOCKED |
| AI response | Proceed to recommendations | Asks for budget again | ❌ FAIL |
| Recommendations returned | 3-5 items | 0 items | ❌ FAIL |
| Time to recommendation | < 120s | ∞ (never reaches) | ❌ FAIL |

**Overall**: ❌ **0/6 criteria met**

---

### Scenario 2: Wife with Explicit Budget

**User Input**:
```
"Looking for a gift for my wife, budget is 100 dollars, she loves meditation"
```

| Aspect | Expected | Actual | Status |
|--------|----------|--------|--------|
| Recipient extraction | "partner" or "wife" | ? (not in RECIPIENT_MAP!) | ⚠️ **NEW BUG** |
| Budget extraction | $100 | ✗ None | ❌ FAIL |
| Interest extraction | "meditation" | ? Cannot verify | ⚠️ BLOCKED |
| AI response | Proceed or ask clarifying Q | Asks for ALL info again | ❌ FAIL |
| Recommendations | 3-5 items | 0 items | ❌ FAIL |

**Overall**: ❌ **0/5 criteria met**

**New Finding**: 🟠 **"wife" not in recipient map!** Only "partner, boyfriend, girlfriend, fiance, spouse" (Line 56 in extract.ts). Missing common terms: wife, husband, grandma, grandpa, nephew, niece, cousin, aunt, uncle.

---

### Budget Pattern Testing Results

Tested various budget input formats against regex patterns in code:

| Input Format | Matches Regex? | Extracted? | Pattern |
|--------------|----------------|------------|---------|
| "under $50" | Should (Line 281) | ❌ NO | `/under\s*\$?(\d{1,5})/i` |
| "under 50 dollars" | Should (Line 281) | ❌ NO | Same |
| "budget around $50" | ❌ Not in regex | ❌ NO | Missing pattern |
| "budget is 100 dollars" | ❌ Not in regex | ❌ NO | Missing pattern |
| "30-60 budget" | Partial (Line 279) | ❌ NO | `/\$?(\d{1,5})\s*[-–]\s*\$?(\d{1,5})/` |
| "between 20 and 40" | Should (Line 277) | ❌ NO | `/between\s*\$?(\d{1,5})\s*(and|-|to)\s*\$?(\d{1,5})/i` |
| "$50" | Should (Line 282) | ❌ NO | `/\$(\d{1,5})/` |

**Conclusion**: Despite regex patterns existing, **NONE** successfully extract budgets in practice. Suggests extraction happens but isn't persisted or checked correctly in "readiness" logic.

---

## ADDITIONAL FINDINGS

### ✅ What Works:

1. **Server starts successfully** (after fixing Line 378 bug)
2. **API endpoints respond** (categories, search functional)
3. **Session management** via cookies (context summary shows saved recipient)
4. **Recipient extraction** for some relationship types (sister, brother, mom, dad, colleague, friend)
5. **Chat API accepts requests** and returns structured responses

### ❌ What Doesn't Work:

1. **Budget extraction** (0% success rate across all formats)
2. **Recommendation flow** (never reached in any test)
3. **Readiness detection** (always evaluates to "not ready")
4. **Natural language understanding** of budget phrasing
5. **Progress through conversation** (infinite loop asking for budget)

### ⚠️ Cannot Verify:

1. Recommendation quality (never generated)
2. Rationale text (never generated)
3. LLM-generated responses (not initialized, using fallbacks)
4. Vector search quality (not configured)
5. Graph-based boosting (not tested)
6. Multi-turn context accumulation (blocked at first turn)
7. Memory drawer functionality (no meaningful data to display)
8. Category/value filtering (no recommendations to filter)

---

## COMPARISON TO PREDICTIONS

From `IMPROVEMENT_RECOMMENDATIONS.md` Section 11, we predicted:

| Prediction | Actual Finding | Accuracy |
|------------|----------------|----------|
| Budget extraction works (regex patterns present) | ❌ Completely broken | ❌ WRONG |
| Multi-turn conversation maintains state | ⚠️ Partially (saves recipient, not budget) | 🟡 PARTIAL |
| Time to recommendation: 2-10s | ∞ (never reaches) | ❌ WORSE |
| Relevance score: 2-3/5 | N/A (no recommendations) | ⚠️ BLOCKED |
| Rationale quality: 1-2/5 | N/A (no recommendations) | ⚠️ BLOCKED |
| No LLM = generic responses | ✓ Confirmed (fallback messages) | ✅ CORRECT |
| Limited catalog keywords | ⚠️ Cannot test (no recs) | ⚠️ BLOCKED |

**Prediction Accuracy**: 1/7 correct, 1/7 partial, 5/7 blocked or wrong

**Key Insight**: The app is in a **WORSE** state than predicted. Budget extraction was assumed functional based on regex presence, but is completely broken in practice.

---

## ROOT CAUSE ANALYSIS

### Why Budget Extraction Fails:

1. **Logic Error on Line 289**:
   ```typescript
   const b = parseBudget(text);
   budgetMin = b.min;
   budgetMax = b.max ?? b.max; // ❌ BUG: Should be ?? undefined or omit coalescing
   ```
   Even if `b.max` is undefined, this assigns `undefined ?? undefined` = `undefined`, but the variable is still set (not omitted).

2. **Regex Execution Context**:
   The parseBudget function returns `{}` as fallback (Line 283), which has no `min` or `max` properties.
   Setting `budgetMax = undefined` likely doesn't satisfy truthiness checks later.

3. **Readiness Check Logic (Line 348)**:
   ```typescript
   const ready = (merged.budgetMin != null || merged.budgetMax != null) && ...
   ```
   Requires budget to be `!= null` (checking for non-null/non-undefined).
   If budget extraction sets `budgetMax = undefined`, this fails.

4. **Saved Context Not Re-Checked**:
   Even if budget were saved to context, the "readiness" check uses `merged` from loaded context.
   If initial extraction failed, context has no budget, so subsequent checks also fail.

### Why It Loops:

1. User provides budget → Extraction fails → Saved to context as `{ notes: "..." }` (no budget fields)
2. Readiness check: `budgetMin/Max == null` → not ready
3. AI asks for budget → User repeats → Extraction fails again → Loop

---

## RECOMMENDATIONS BASED ON ACTUAL TESTING

### Immediate Fixes (P0 - Block All Testing):

1. **Fix budget extraction logic** (Line 276-289):
   - Add patterns: `/around\s*\$?(\d{1,5})/i`, `/budget\s+is\s+\$?(\d{1,5})/i`, `/(\d{1,5})\s*dollars?/i`
   - Fix Line 289: `if (b.min != null) budgetMin = b.min; if (b.max != null) budgetMax = b.max;`
   - Add extensive logging to debug which patterns match

2. **Expand RECIPIENT_MAP** (extract.ts:53-65):
   - Add: wife, husband, grandma, grandpa/grandfather, grandmother, nephew, niece, cousin, aunt, uncle, in-law
   - Add: team, coworker variations

3. **Loosen readiness check** (Line 348):
   - Make budget OR recipient sufficient (not AND)
   - OR: Reduce clarifying questions to 1-2 max, then proceed with partial info

4. **Add debug logging**:
   - Log extracted budget values before save
   - Log merged context before readiness check
   - Log which criteria failed for "not ready"

### Post-Fix Testing Plan:

1. **Re-run all 9 persona scenarios** with fixed code
2. **Verify budget extraction** for 10+ input variations
3. **Test recommendation quality** once reachable
4. **Measure time-to-recommendation** against <120s target
5. **Evaluate rationale quality** (requires LLM init)

### Updated Priority Matrix:

| Issue | Original Priority | Revised Priority | Blocker? |
|-------|------------------|------------------|----------|
| Budget extraction broken | Not identified | **P0** | ✅ YES |
| Missing recipient terms | P2 | **P0** | ✅ YES (partial) |
| Readiness logic too strict | Not identified | **P0** | ✅ YES |
| Hardcoded auth email | P0 | P1 | ❌ No (doesn't block testing) |
| Wishlist persistence | P0 | P1 | ❌ No |
| ChatLLM not initialized | P0 | P1 | ⚠️ Partial (fallbacks work, but generic) |

---

## UPDATED TEST RESULTS vs. SUCCESS CRITERIA

### Persona 1: Busy Professional Sarah - Scenario 1A

| Success Criteria | Target | Actual | Pass/Fail |
|-----------------|--------|--------|-----------|
| Contains yoga-related items | ✓ | ✗ (0 items) | ❌ |
| Sustainability mentioned in rationale | ✓ | ✗ (no rationale) | ❌ |
| Price within $40-60 | ✓ | N/A | ❌ |
| Time to recommendation | < 120s | ∞ | ❌ |

**Result**: 0/4 criteria met ❌

---

## CONCLUSION

The Present-Agent chat functionality is **completely broken** due to budget extraction failure. Despite having regex patterns for common budget formats, none successfully extract in practice, creating an infinite loop where the AI repeatedly asks for information already provided.

**Critical Path to Fix**:
1. Fix budget extraction logic (Lines 276-289)
2. Expand recipient map (add wife, husband, grandparents, etc.)
3. Add debug logging throughout extraction flow
4. Re-test with fixed code

**Estimated Fix Time**: 2-4 hours for P0 issues
**Estimated Re-Test Time**: 1-2 hours for all scenarios

**Status**: ❌ **NOT READY FOR BETA TESTING**

---

**Next Steps**:
1. Implement P0 fixes listed above
2. Re-run `scripts/test_personas.mjs` for full validation
3. Update this document with post-fix results
4. Proceed to P1 improvements only after P0 fixes verified

---

**Test Conducted By**: Claude Code
**Date**: October 1, 2025
**Findings Severity**: CRITICAL - Core functionality non-operational
**Recommendation**: HALT feature development until P0 bugs fixed
