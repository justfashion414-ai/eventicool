// The couple app's own plan and the platform-wide settings, resolved from the
// /api/couple endpoint before the app renders and shared with the dashboard.
// Firestore is not the source here: the leads collection is not client-readable.
export interface PlatformSettings {
  feedPageSize: number
  storage: { essential: number; complete: number; legacy: number }
}
export const DEFAULT_PLATFORM: PlatformSettings = {
  feedPageSize: 0,
  storage: { essential: 5, complete: 10, legacy: 20 },
}
let info: { plan: string; platform: PlatformSettings } = { plan: '', platform: DEFAULT_PLATFORM }
export function setCoupleInfo(plan: unknown, platform: unknown) {
  const k = String(plan || '').trim().toLowerCase()
  info.plan = ['essential', 'complete', 'legacy'].includes(k) ? k : info.plan || 'essential'
  const p: any = platform || {}
  const storage = { ...DEFAULT_PLATFORM.storage }
  for (const key of ['essential', 'complete', 'legacy'] as const) {
    const g = Number(p.storage?.[key])
    if (Number.isFinite(g) && g > 0) storage[key] = g
  }
  const fps = Number(p.feedPageSize)
  info.platform = { feedPageSize: Number.isFinite(fps) && fps > 0 ? Math.floor(fps) : 0, storage }
}
export function getCouplePlan() { return info.plan }
export function getCouplePlatform(): PlatformSettings { return info.platform }
