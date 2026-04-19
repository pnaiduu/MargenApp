import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function pngToIco(png: Buffer): Buffer {
  if (png[0] !== 0x89 || png.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('favicon source is not a PNG')
  }
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)
  const iconW = w >= 256 ? 0 : w
  const iconH = h >= 256 ? 0 : h
  const header = 22
  const buf = Buffer.allocUnsafe(header + png.length)
  let o = 0
  buf.writeUInt16LE(0, o)
  o += 2
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt8(iconW, o)
  o += 1
  buf.writeUInt8(iconH, o)
  o += 1
  buf.writeUInt8(0, o)
  o += 1
  buf.writeUInt8(0, o)
  o += 1
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt16LE(32, o)
  o += 2
  buf.writeUInt32LE(png.length, o)
  o += 4
  buf.writeUInt32LE(header, o)
  o += 4
  png.copy(buf, header)
  return buf
}

function margenFaviconPlugin(): Plugin {
  const rootPng = path.join(__dirname, 'Margen.png')
  const faviconPng = path.join(__dirname, 'public', 'margen-favicon.png')
  const legacyPng = path.join(__dirname, 'public', 'Margen.png')
  const faviconIco = path.join(__dirname, 'public', 'favicon.ico')

  return {
    name: 'margen-favicon',
    buildStart() {
      if (existsSync(rootPng)) {
        copyFileSync(rootPng, faviconPng)
        copyFileSync(rootPng, legacyPng)
      }
      if (!existsSync(faviconPng)) {
        return
      }
      const png = readFileSync(faviconPng)
      writeFileSync(faviconIco, pngToIco(png))
    },
    transformIndexHtml(html) {
      if (!existsSync(faviconPng)) {
        return html.replaceAll('__FAVICON_HASH__', '0')
      }
      const hash = createHash('sha256')
        .update(readFileSync(faviconPng))
        .digest('hex')
        .slice(0, 12)
      return html.replaceAll('__FAVICON_HASH__', hash)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [margenFaviconPlugin(), react(), tailwindcss()],
})
