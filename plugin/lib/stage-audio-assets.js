import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/** Load content-verified recordings from the deployment manifest. */
export function loadStageAudioAssets() {
  const manifest = JSON.parse(readFileSync(new URL('./stage-audio/manifest.json', import.meta.url), 'utf8'))
  return new Map(Object.values(manifest.cues).map(entry => {
    if (!/^[a-z0-9-]+\.[a-f0-9]{16}\.mp3$/.test(entry.file)) throw new Error('Invalid stage audio filename')
    const bytes = readFileSync(new URL(`./stage-audio/${entry.file}`, import.meta.url))
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Stage audio checksum mismatch: ${entry.file}`)
    return [entry.file, bytes]
  }))
}

/** Match approved speech text to an already verified recording. */
export function createStageRecordingResolver(assets) {
  const manifest=JSON.parse(readFileSync(new URL('./stage-audio/manifest.json',import.meta.url),'utf8'))
  const recordings=new Map(Object.values(manifest.cues).map(entry=>[entry.textSha256,entry]))
  return text=>{
    const entry=recordings.get(createHash('sha256').update(text).digest('hex'))
    if(!entry)return null
    const bytes=assets.get(entry.file)
    if(!bytes)throw new Error('Approved stage recording is missing: '+entry.file)
    return {audioSegments:[{audio:bytes.toString('base64'),mime:'audio/mpeg',text}],audioSpeed:manifest.speed}
  }
}

/** Serve authenticated recordings with private caching and single byte ranges. */
export function serveStageAudioAsset(assets, { method, query, req, res }) {
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
  const headers = { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes', etag }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers)
    return res.end()
  }
  // Multiple ranges are served as a complete representation instead of multipart audio.
  const range = method === 'GET' && (!req.headers['if-range'] || req.headers['if-range'] === etag)
    ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '') : null
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1
    if ((!range[1] && !range[2]) || !Number.isSafeInteger(start) || start >= bytes.length || start > end) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${bytes.length}` })
      return res.end()
    }
    res.writeHead(206, { ...headers, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${bytes.length}` })
    return res.end(bytes.subarray(start, end + 1))
  }
  res.writeHead(200, { ...headers, 'content-length': bytes.length })
  res.end(method === 'HEAD' ? undefined : bytes)
}
