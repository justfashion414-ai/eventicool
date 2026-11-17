// Signs Cloudinary direct uploads from the couple app and the admin console
// (lead sample photos included). The client posts the file straight to
// Cloudinary with the returned signature; this function never sees the bytes.
import crypto from 'crypto'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

function signCloudinaryParams(params, apiSecret) {
  const sortedQuery = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(sortedQuery + apiSecret).digest('hex')
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })

  const url = new URL(req.url)
  const folder = url.searchParams.get('folder') || 'eventicor'

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.VITE_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return json(500, {
      error: 'Cloudinary environment variables are missing in Netlify.',
      details: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Netlify Site configuration -> Environment variables.',
    })
  }

  const timestamp = Math.round(Date.now() / 1000)
  const signature = signCloudinaryParams({ folder, timestamp }, apiSecret)

  return json(200, { signature, timestamp, cloudName, apiKey, folder })
}
