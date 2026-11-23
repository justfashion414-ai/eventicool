// payment-submit: a customer's app posts their payment receipt here after the
// bank transfer (Nov 20 2026 payment flow). No auth, the same trust level as
// guest posts; it only writes lastPayment onto an EXISTING landing lead, so a
// stray call cannot create or change anything else. The console's Customers
// section reads lastPayment on the lead, shows the receipt and its details,
// and Confirm payment then activates the account for a year (activatedAt).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let ready = false
function init() {
  if (ready) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set')
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  initializeApp({ credential: cert(svc), projectId: svc.project_id })
  ready = true
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  try {
    init()
    const body = await req.json().catch(() => ({}))
    const leadId = String(body.leadId || '')
    const plan = String(body.plan || '')
    const receiptUrl = String(body.receiptUrl || '')
    if (!leadId || !plan || !receiptUrl) return json(400, { error: 'leadId, plan and receiptUrl are required' })
    const db = getFirestore()
    const leadRef = db.collection('leads').doc(leadId)
    const snap = await leadRef.get()
    if (!snap.exists) return json(404, { error: 'Unknown app' })
    if (snap.data()?.source !== 'landing') return json(400, { error: 'This app does not take payments' })
    const lastPayment = {
      plan,
      amount: Number(body.amount) || 0,
      email: String(body.email || ''),
      appName: String(body.appName || ''),
      receiptUrl,
      submittedAt: Date.now(),
      status: 'submitted',
    }
    await leadRef.set({ lastPayment }, { merge: true })
    return json(200, { ok: true })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

export const config = { path: '/api/payment-submit' }
