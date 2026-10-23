import { readFileSync } from 'node:fs'

/** Load only build-manifest images; request values never become filesystem paths. */
export function loadAvatarAssets() {
  const files = JSON.parse(readFileSync(new URL('./avatar/manifest.json', import.meta.url), 'utf8'))
  return new Map(files.map(file => [file, readFileSync(new URL(`./avatar/${file}`, import.meta.url))]))
}

/** Serve versioned artwork after the voice route's existing authentication check. */
export function serveAvatarAsset(assets, { method, query, req, res }) {
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    return res.end()
  }
  const key = query.searchParams.get('asset')
  const bytes = assets.get(key)
  if (!bytes) {
    res.writeHead(404)
    return res.end()
  }
  const etag = `"${key}"`
  const headers = { 'content-type': 'image/png', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', etag }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers)
    return res.end()
  }
  res.writeHead(200, { ...headers, 'content-length': bytes.length })
  res.end(method === 'HEAD' ? undefined : bytes)
}
