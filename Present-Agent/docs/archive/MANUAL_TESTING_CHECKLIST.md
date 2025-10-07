# Manual Testing Checklist - UX Fixes Verification

**Date:** 2025-10-07
**Purpose:** Verify P100 (Performance) and P90 (Budget Transparency) fixes are working correctly

---

## Prerequisites

✅ Dev server running on http://localhost:3000
✅ Backend server running on http://localhost:8080
✅ Browser with DevTools available

---

## Test 1: Budget Badge Display (P90)

### Test Case 1.1: Within Budget Badge

**Steps:**
1. Navigate to http://localhost:3000
2. Enter: "Gift for my mom, budget $50"
3. Submit query

**Expected Results:**
- [ ] Products priced ≤$50 display green badge: `✓ In Budget`
- [ ] Badge has green background (`bg-green-100`) and green text (`text-green-800`)
- [ ] Badge is positioned next to price display
- [ ] Badge is readable and properly styled

**Screenshot Location:** `test-screenshots/budget-within-badge.png`

---

### Test Case 1.2: Near Budget Badge

**Steps:**
1. Continue from previous test
2. Observe products priced between $50-$60 (within 20% of max budget)

**Expected Results:**
- [ ] Products priced $50.01-$60.00 display yellow badge: `Near Budget`
- [ ] Badge has yellow background (`bg-yellow-100`) and yellow text (`text-yellow-800`)
- [ ] No green "In Budget" badge on these products
- [ ] Badge clearly distinguishes near-budget from within-budget items

**Screenshot Location:** `test-screenshots/budget-near-badge.png`

---

### Test Case 1.3: Over Budget (No Badge)

**Steps:**
1. Continue from previous test
2. Observe products priced >$60 (more than 20% over budget)

**Expected Results:**
- [ ] Products priced >$60 display NO budget badge
- [ ] Price is still clearly visible
- [ ] User can distinguish these are over budget by lack of badge

**Screenshot Location:** `test-screenshots/budget-over-no-badge.png`

---

### Test Case 1.4: Value Indicator

**Steps:**
1. From budget $50 test, observe products within budget
2. Look for value indicator below price

**Expected Results:**
- [ ] Products within budget display: `💰 Great Value`
- [ ] Text is green (`text-green-700`) and medium font weight
- [ ] Positioned below price and badge
- [ ] Only shows for products marked as good value (within budget)

**Screenshot Location:** `test-screenshots/value-indicator.png`

---

### Test Case 1.5: Budget Range Display

**Steps:**
1. After submitting query with budget
2. Look at bottom of screen near input field

**Expected Results:**
- [ ] Budget range displayed: `Budget: $min–$max`
- [ ] Shows in gray pill/badge style
- [ ] Persists across conversation
- [ ] Updates when user states new budget

**Screenshot Location:** `test-screenshots/budget-range-display.png`

---

## Test 2: Performance Metrics (P100)

### Test Case 2.1: API Performance Tracking

**Steps:**
1. Open Browser DevTools (F12)
2. Go to Network tab
3. Enter: "Birthday gift for dad, loves golf"
4. Submit query
5. Find `/api/recommend` request
6. Click to view response

**Expected Results:**
- [ ] Response includes `performanceMetrics` object
- [ ] Contains `contextLoadMs` field (number)
- [ ] Contains `recommendationMs` field (number)
- [ ] Contains `totalMs` field (number)
- [ ] `totalMs` ≈ `contextLoadMs + recommendationMs`
- [ ] All values are reasonable (e.g., contextLoadMs < 500ms)

**Screenshot Location:** `test-screenshots/performance-metrics-response.png`

**Example Response:**
```json
{
  "items": [...],
  "reply": "...",
  "performanceMetrics": {
    "contextLoadMs": 120,
    "recommendationMs": 1680,
    "totalMs": 1800
  }
}
```

---

### Test Case 2.2: Loading State Display

**Steps:**
1. Clear browser cache (to slow down request slightly)
2. Enter a query
3. Observe UI immediately after clicking Send

**Expected Results:**
- [ ] Loading animation appears
- [ ] Shows "Thinking" text with animated dots
- [ ] Shows 3 skeleton loading cards (gray pulsing rectangles)
- [ ] Send button changes to "Thinking..." with spinner
- [ ] Loading state clears when results arrive

**Screenshot Location:** `test-screenshots/loading-state.png`

---

### Test Case 2.3: Fast Mode (Optional)

**Steps:**
1. Open DevTools Console
2. Run: `fetch('/api/recommend', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: 'gift for mom', fastMode: true})})`
3. Check response time vs normal mode

**Expected Results:**
- [ ] Fast mode request completes faster
- [ ] Still returns valid recommendations
- [ ] Performance metrics show lower contextLoadMs
- [ ] May skip some personalization features

---

## Test 3: Integration Tests

### Test Case 3.1: Multiple Budget Queries

**Steps:**
1. Enter: "Gift under $30"
2. Observe results
3. Enter: "Actually, show me things between $50 and $100"
4. Observe new results

**Expected Results:**
- [ ] First query shows products ≤$30 with green badges
- [ ] Budget display shows: `Budget: —–$30`
- [ ] Second query updates badges for new range
- [ ] Budget display updates to: `Budget: $50–$100`
- [ ] Badges are accurate for new budget
- [ ] Previous budget is replaced, not additive

**Screenshot Location:** `test-screenshots/budget-update.png`

---

### Test Case 3.2: Trending + Budget Badges

**Steps:**
1. Enter: "Popular gift around $40"
2. Observe products

**Expected Results:**
- [ ] Some products show both 🔥 Trending badge AND budget badge
- [ ] Badges don't overlap or obscure each other
- [ ] Trending badge is top-right, budget badge is next to price
- [ ] Both badges are readable

**Screenshot Location:** `test-screenshots/trending-budget-combo.png`

---

### Test Case 3.3: No Budget Specified

**Steps:**
1. Clear localStorage (to reset context)
2. Enter: "Gift for book lover"
3. Observe results

**Expected Results:**
- [ ] No budget badges shown (since no budget specified)
- [ ] No "Great Value" indicators
- [ ] Products still display normally
- [ ] No budget range display at bottom
- [ ] No errors in console

**Screenshot Location:** `test-screenshots/no-budget-specified.png`

---

## Test 4: Responsive Design

### Test Case 4.1: Mobile View

**Steps:**
1. Open DevTools
2. Toggle device emulation (Cmd+Shift+M on Mac)
3. Select iPhone 12 Pro or similar
4. Enter query with budget
5. Observe product cards

**Expected Results:**
- [ ] Budget badges scale appropriately
- [ ] Text remains readable at mobile size
- [ ] Badges don't break layout on narrow screens
- [ ] Product cards stack vertically
- [ ] All functionality works on mobile

**Screenshot Location:** `test-screenshots/mobile-budget-badges.png`

---

## Test 5: Accessibility

### Test Case 5.1: Color Contrast

**Steps:**
1. Use browser accessibility checker or manual inspection
2. Check green "In Budget" badge contrast
3. Check yellow "Near Budget" badge contrast

**Expected Results:**
- [ ] Green text on green background meets WCAG AA (4.5:1 ratio)
- [ ] Yellow text on yellow background meets WCAG AA
- [ ] Text is readable for colorblind users
- [ ] Badge shape/position provides non-color cues

**Contrast Ratios:**
- Green badge: `text-green-800` on `bg-green-100` = ~7.2:1 ✅
- Yellow badge: `text-yellow-800` on `bg-yellow-100` = ~6.8:1 ✅

---

## Test 6: Error Cases

### Test Case 6.1: Invalid Budget

**Steps:**
1. Enter: "Gift for $abc dollars"
2. Observe results

**Expected Results:**
- [ ] No crash or console errors
- [ ] Budget parsing fails gracefully
- [ ] Products display without badges
- [ ] User can continue conversation

---

### Test Case 6.2: API Error with Performance Metrics

**Steps:**
1. Stop backend server temporarily
2. Enter query
3. Observe error handling

**Expected Results:**
- [ ] Error message displays
- [ ] No performance metrics shown (API failed)
- [ ] Retry button works
- [ ] When server restarts, next request includes metrics

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1.1 Within Budget Badge | ⬜ | |
| 1.2 Near Budget Badge | ⬜ | |
| 1.3 Over Budget No Badge | ⬜ | |
| 1.4 Value Indicator | ⬜ | |
| 1.5 Budget Range Display | ⬜ | |
| 2.1 Performance Metrics | ⬜ | |
| 2.2 Loading State | ⬜ | |
| 2.3 Fast Mode | ⬜ | |
| 3.1 Multiple Budgets | ⬜ | |
| 3.2 Trending + Budget | ⬜ | |
| 3.3 No Budget | ⬜ | |
| 4.1 Mobile View | ⬜ | |
| 5.1 Color Contrast | ⬜ | |
| 6.1 Invalid Budget | ⬜ | |
| 6.2 API Error | ⬜ | |

---

## Pass/Fail Criteria

**PASS:** 13+ of 15 test cases pass
**CONDITIONAL PASS:** 10-12 test cases pass (minor issues to fix)
**FAIL:** <10 test cases pass (major issues)

---

## Next Steps After Testing

### If PASS:
1. Document test results
2. Take screenshots
3. Update UX_FIXES_IMPLEMENTED.md with verification
4. Proceed to implement P85 (Urgency Detection)

### If CONDITIONAL PASS:
1. Document failing test cases
2. Fix critical issues
3. Re-test
4. Then proceed to next fixes

### If FAIL:
1. Review implementation
2. Debug issues
3. Check browser console for errors
4. Re-test individual fixes
5. Get help if needed

---

## Manual Tester Notes

**Date Tested:** _____________
**Tester:** _____________
**Browser:** _____________
**Overall Result:** PASS / CONDITIONAL PASS / FAIL

**Key Findings:**

**Issues Discovered:**

**Screenshots Attached:** YES / NO
