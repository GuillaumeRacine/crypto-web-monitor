/**
 * Occasion Auto-Detection
 *
 * Automatically detects likely gift-giving occasions based on current date and calendar.
 * Useful for proactive recommendations and occasion-based boosting.
 */

export interface DetectedOccasion {
  occasion: string;
  confidence: number; // 0.0-1.0
  daysUntil: number;
  displayName: string;
}

/**
 * Get upcoming occasions within the next N days
 */
export function getUpcomingOccasions(daysAhead = 30, currentDate: Date = new Date()): DetectedOccasion[] {
  const occasions: DetectedOccasion[] = [];
  const year = currentDate.getFullYear();

  // Define major gift-giving occasions with fixed dates
  const fixedOccasions = [
    { date: new Date(year, 0, 1), occasion: 'new_year', displayName: "New Year's Day" },
    { date: new Date(year, 1, 14), occasion: 'valentine', displayName: "Valentine's Day" },
    { date: new Date(year, 2, 17), occasion: 'st_patrick', displayName: "St. Patrick's Day" },
    { date: new Date(year, 3, 1), occasion: 'easter', displayName: 'Easter' }, // Approximate, Easter moves
    { date: new Date(year, 4, 12), occasion: 'mother_day', displayName: "Mother's Day" }, // 2nd Sunday of May (approximate)
    { date: new Date(year, 5, 16), occasion: 'father_day', displayName: "Father's Day" }, // 3rd Sunday of June (approximate)
    { date: new Date(year, 6, 4), occasion: 'independence_day', displayName: 'Independence Day (US)' },
    { date: new Date(year, 9, 31), occasion: 'halloween', displayName: 'Halloween' },
    { date: new Date(year, 10, 28), occasion: 'thanksgiving', displayName: 'Thanksgiving' }, // 4th Thursday of November (approximate)
    { date: new Date(year, 11, 24), occasion: 'christmas_eve', displayName: 'Christmas Eve' },
    { date: new Date(year, 11, 25), occasion: 'christmas', displayName: 'Christmas' },
    { date: new Date(year, 11, 31), occasion: 'new_year_eve', displayName: "New Year's Eve" },
  ];

  // Check each occasion
  for (const occ of fixedOccasions) {
    const daysUntil = Math.ceil((occ.date.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    // If occasion already passed this year, check next year
    let checkDate = occ.date;
    let days = daysUntil;

    if (daysUntil < 0) {
      checkDate = new Date(year + 1, occ.date.getMonth(), occ.date.getDate());
      days = Math.ceil((checkDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Only include if within daysAhead
    if (days >= 0 && days <= daysAhead) {
      // Confidence decreases as we get further from the occasion
      let confidence = 1.0;
      if (days > 14) {
        confidence = 0.7;
      } else if (days > 7) {
        confidence = 0.85;
      }

      occasions.push({
        occasion: occ.occasion,
        confidence,
        daysUntil: days,
        displayName: occ.displayName,
      });
    }
  }

  // Sort by days until (closest first)
  occasions.sort((a, b) => a.daysUntil - b.daysUntil);

  return occasions;
}

/**
 * Get the most likely current occasion (within next 14 days)
 */
export function getCurrentOccasion(currentDate: Date = new Date()): DetectedOccasion | null {
  const upcoming = getUpcomingOccasions(14, currentDate);

  if (upcoming.length === 0) {
    return null;
  }

  // Return the closest occasion
  return upcoming[0];
}

/**
 * Check if it's currently a specific season
 */
export function getCurrentSeason(currentDate: Date = new Date()): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = currentDate.getMonth();

  if (month >= 2 && month <= 4) return 'spring'; // Mar, Apr, May
  if (month >= 5 && month <= 7) return 'summer'; // Jun, Jul, Aug
  if (month >= 8 && month <= 10) return 'fall'; // Sep, Oct, Nov
  return 'winter'; // Dec, Jan, Feb
}

/**
 * Get occasion boost for recommendations
 */
export function getOccasionBoost(productOccasion: string, detectedOccasion: DetectedOccasion | null): number {
  if (!detectedOccasion) {
    return 0;
  }

  // Exact match
  if (productOccasion === detectedOccasion.occasion) {
    return 0.5 * detectedOccasion.confidence;
  }

  // Related occasions (e.g., christmas_eve and christmas)
  const related: Record<string, string[]> = {
    christmas: ['christmas_eve', 'new_year', 'new_year_eve'],
    valentine: ['anniversary'],
    mother_day: ['birthday'], // Mothers' birthdays near Mother's Day
    father_day: ['birthday'], // Fathers' birthdays near Father's Day
  };

  if (related[detectedOccasion.occasion]?.includes(productOccasion)) {
    return 0.25 * detectedOccasion.confidence;
  }

  return 0;
}

/**
 * Get seasonal product boost
 */
export function getSeasonalBoost(productTheme: string | null, currentSeason: string): number {
  if (!productTheme) {
    return 0;
  }

  const seasonalThemes: Record<string, string[]> = {
    winter: ['cozy', 'warm', 'festive', 'holiday'],
    spring: ['fresh', 'floral', 'pastel', 'garden'],
    summer: ['tropical', 'beach', 'outdoor', 'bright'],
    fall: ['rustic', 'harvest', 'autumn', 'warm'],
  };

  const themes = seasonalThemes[currentSeason] || [];

  if (themes.some((t) => productTheme.toLowerCase().includes(t))) {
    return 0.15;
  }

  return 0;
}

/**
 * Get display message for current occasion
 */
export function getOccasionMessage(occasion: DetectedOccasion | null): string | null {
  if (!occasion) {
    return null;
  }

  const { displayName, daysUntil } = occasion;

  if (daysUntil === 0) {
    return `Today is ${displayName}! 🎉`;
  } else if (daysUntil === 1) {
    return `${displayName} is tomorrow! 🎁`;
  } else if (daysUntil <= 7) {
    return `${displayName} is in ${daysUntil} days 📅`;
  } else if (daysUntil <= 14) {
    return `${displayName} is coming up in ${daysUntil} days`;
  }

  return null;
}

/**
 * Auto-suggest occasion based on query and current date
 */
export function suggestOccasion(query: string, currentDate: Date = new Date()): string | null {
  // Check if query mentions an occasion
  const queryLower = query.toLowerCase();

  const occasionKeywords: Record<string, string[]> = {
    birthday: ['birthday', 'bday', 'b-day'],
    christmas: ['christmas', 'xmas', 'holiday'],
    valentine: ['valentine', 'valentines'],
    mother_day: ['mother', 'mom', 'mum'],
    father_day: ['father', 'dad'],
    wedding: ['wedding', 'bride', 'groom', 'marriage'],
    anniversary: ['anniversary'],
    graduation: ['graduation', 'graduate', 'grad'],
    baby_shower: ['baby shower', 'new baby', 'expecting'],
    thank_you: ['thank', 'thanks', 'appreciation'],
  };

  for (const [occasion, keywords] of Object.entries(occasionKeywords)) {
    if (keywords.some((kw) => queryLower.includes(kw))) {
      return occasion;
    }
  }

  // If no explicit mention, use date-based detection
  const current = getCurrentOccasion(currentDate);
  if (current && current.confidence >= 0.85) {
    return current.occasion;
  }

  return null;
}
