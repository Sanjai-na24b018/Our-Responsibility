import { Issue } from '../types';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateDurationScore(timestamp: number): number {
  const hoursSinceReported = (Date.now() - timestamp) / (1000 * 60 * 60);
  return Math.min(100, hoursSinceReported * 2);
}

export function calculateImpactScore(severityScore: number, safetyScore: number, populationScore: number, durationScore: number): number {
  return Math.round(
    0.4 * severityScore +
    0.3 * safetyScore +
    0.2 * populationScore +
    0.1 * durationScore
  );
}

export function calculateNeighborhoodHealth(issues: Issue[]): { score: number, breakdown: string } {
  let score = 100;
  let resolvedCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  issues.forEach(issue => {
    if (issue.status === 'Resolved') {
      resolvedCount++;
      score += 5;
    } else {
      if (issue.severity === 'High' || issue.severity === 'Critical') {
        highCount++;
        score -= 15;
      } else if (issue.severity === 'Medium') {
        mediumCount++;
        score -= 8;
      } else {
        lowCount++;
        score -= 3;
      }
    }
  });

  score = Math.max(0, Math.min(100, score)); // clamp 0-100

  // Build breakdown text
  const breakdownParts = [];
  const openCount = highCount + mediumCount + lowCount;
  
  if (openCount > 0 || resolvedCount > 0) {
     breakdownParts.push(`${openCount + resolvedCount} issues reported (${openCount} open, ${resolvedCount} resolved)`);
  }
  
  if (highCount > 0) breakdownParts.push(`${highCount} high severity open`);
  if (mediumCount > 0) breakdownParts.push(`${mediumCount} medium severity open`);
  if (lowCount > 0) breakdownParts.push(`${lowCount} low severity open`);

  return {
    score: Math.round(score),
    breakdown: breakdownParts.join(', ') || "No issues reported yet."
  };
}
