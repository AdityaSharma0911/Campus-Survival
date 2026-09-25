/// <reference types="vite/client" />
// ============================================================
// survivalApi.ts — copy to frontend/src/data/survivalApi.ts
//
// Drop-in replacement for the mock:
//   import { getSurvivalRecommendation } from './data/survivalApi';
// Same signature as mockCampus.ts, returns a superset of SurvivalRecommendation.
// Validates every response at the boundary (per docs/BACKEND_INTEGRATION.md)
// and throws a readable Error the existing error state can show.
// ============================================================
import type { CampusLocation, RiskLevel, RouteStep, SurvivalRecommendation } from '../types/campus';

const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''; // '' = same origin via Vite proxy

export type Mode = 'food' | 'coffee' | 'study' | 'travel' | 'panic';

export interface PlaceRef { id: string; name: string; short: string; lat: number; lng: number }

export interface StopInfo {
  id: string; name: string; fullName: string;
  kind: 'dining' | 'vending' | 'study'; building: string | null; tags: string[];
  closesAt?: string | null; lunchRush?: boolean; toGo?: boolean;
}

/** Steps carry an optional kind so the Timeline can pick an icon: food | coffee | vending | study | dining */
export type LiveStep = RouteStep & { kind?: string };

export interface Alternative extends SurvivalRecommendation {
  steps: LiveStep[];
  title: string;                       // card heading, e.g. "Pizza Hut" or "Speed-walk to class"
  badge: 'GOOD OPTION' | 'QUICK SNACK' | 'TIGHT' | 'TOO RISKY';
  detail: string;                      // "9 min walk · 12 min stop · 7 min to class"
  mode: Mode; availableMinutes: number; stop: StopInfo | null;
}

export interface PanicOption {
  label: string; detail: string; minutes: number;
  delta: number;                       // minutes to spare (negative = late)
  makesIt: boolean; recommended: boolean; note: string;
  kind: 'direct' | 'hustle' | 'vending' | 'grab' | 'meal';
  location: string; steps: LiveStep[];
}

export interface LiveRecommendation extends SurvivalRecommendation {
  steps: LiveStep[];
  mode: Mode;
  availableMinutes: number;
  origin: PlaceRef;                    // route card "YOU ARE HERE"
  destination: PlaceRef;               // route card "NEXT CLASS"
  stop: StopInfo | null;               // route card pit stop (null = direct route)
  narration: string;                   // Gemini's recommendation. Show it as text, not as reasons.
  alternatives: Alternative[];         // "Other options" cards; click = setResult(alt)
  rejected: { id: string; location: string; code: string; reason: string }[];
  panic: { availableMinutes: number; yourMove: { title: string; detail: string }; options: PanicOption[] } | null;
  campusStatus: { label: string; value: string; busy: boolean }[];
  mapsUrl: string;                     // Google Maps walking directions
  assumptions: string[];               // e.g. "Assumed you're starting in SL"
  computedAt: string;                  // "Wed 12:15 PM"
  ai: { intent: 'gemini' | 'rules'; narration: 'gemini' | 'template'; errors: string[] };
}

export interface LivePlace extends CampusLocation {
  fullName: string; kind: string; building: string | null; residence: boolean;
  openNow: boolean | null; status: string | null; hoursToday: string | null; tags: string[];
}

// ---------- validation ----------
const RISKS: RiskLevel[] = ['safe', 'tight', 'screwed'];
const STEP_TYPES = ['walk', 'food', 'class'];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function validateRecommendation(r: any, where = 'response'): void {
  const fail = (msg: string) => { throw new Error(`The planner sent an unexpected ${where} (${msg}).`); };
  if (!r || typeof r !== 'object') fail('not an object');
  if (!isStr(r.location)) fail('location');
  if (!isNum(r.totalMinutes) || !isNum(r.bufferMinutes)) fail('durations');
  if (!RISKS.includes(r.risk)) fail('risk');
  if (!Array.isArray(r.reason) || !r.reason.every((s: unknown) => typeof s === 'string')) fail('reason');
  if (!Array.isArray(r.steps) || r.steps.length === 0) fail('steps');
  for (const s of r.steps) if (!STEP_TYPES.includes(s?.type) || !isStr(s?.label) || !isNum(s?.minutes)) fail('step');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  } catch {
    throw new Error("Can't reach the planner. Is the backend running (npm start in /backend)?");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && typeof body.error === 'string' && body.error) || `Planner error (${res.status}).`);
  return body as T;
}

// ---------- public API ----------
export interface SurviveOptions {
  location?: { lat: number; lng: number } | null;   // from getCurrentLocation()
  demoNow?: { day: number; hour: string };           // freeze time, e.g. { day: 3, hour: '12:15pm' }
  signal?: AbortSignal;
}

export async function getSurvivalRecommendation(query: string, opts: SurviveOptions = {}): Promise<LiveRecommendation> {
  const r = await request<LiveRecommendation>('/api/survive', {
    method: 'POST',
    body: JSON.stringify({ query, location: opts.location ?? null, demoNow: opts.demoNow }),
    signal: opts.signal
  });
  validateRecommendation(r);
  (r.alternatives ?? []).forEach((a, i) => validateRecommendation(a, `alternative ${i + 1}`));
  return r;
}

export const getPlaces = () => request<LivePlace[]>('/api/places');
export const getCampusStatus = () => request<LiveRecommendation['campusStatus']>('/api/status');

/** Browser GPS, or null if denied/unavailable. Never throws. */
export function getCurrentLocation(timeoutMs = 4000): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}
