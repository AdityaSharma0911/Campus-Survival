export type RiskLevel = 'safe' | 'tight' | 'screwed';
export interface CampusLocation { id: string; name: string; abbreviation?: string; type: 'academic' | 'food' | 'study' | 'coffee' }
export interface RouteStep { type: 'walk' | 'food' | 'class'; label: string; minutes: number }
export interface SurvivalRecommendation { location: string; totalMinutes: number; bufferMinutes: number; risk: RiskLevel; reason: string[]; steps: RouteStep[] }
