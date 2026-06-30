export interface ImpactScoreBreakdown {
  severityScore: number;
  safetyScore: number;
  populationScore: number;
  durationScore: number;
  impactScore: number;
}

export interface Agent2Output {
  estimatedHouseholdsAffected: number;
  estimatedDailyPeopleImpacted: number;
  safetyRisk: string;
  waterLitersWastedPerDay?: number | null;
  severityScore: number;
  safetyScore: number;
  populationScore: number;
  impactScoreExplanation: string;
}

export interface Agent3Output {
  immediateAction: string;
  permanentFix: string;
  estimatedResolutionTime: string;
  responsibleAuthority: string;
  escalationUrgency: string;
}

export interface Issue {
  id: string;
  category: string;
  severity: string;
  description: string;
  lat: number;
  lng: number;
  areaName: string;
  timestamp: number;
  citizenCount: number;
  upvotes: number;
  status: 'Open' | 'In Progress' | 'Escalated' | 'Resolved';
  riskTrend: string;
  riskReason: string;
  impactScoreBreakdown: ImpactScoreBreakdown;
  agent2Output: Agent2Output;
  agent3Output: Agent3Output;
  photos: string[];
  afterPhoto: string | null;
  escalationLetter: string | null;
  sessionId: string;
}
