import sharp from "sharp";

export async function analyzeImage(buffer) {
  const image = sharp(buffer, { failOn: "none" });
  const metadata = await image.metadata();
  const stats = await image.stats().catch(() => null);
  return { metadata, stats };
}

export async function createDerivatives(buffer) {
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const thumbnail = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 520, height: 520, fit: "cover" })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();

  return { optimized, thumbnail };
}

export async function applyWatermark(buffer, { clubName, eventName, role }) {
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  const width = metadata.width ?? 1200;
  const watermarkText = `${clubName} • ${eventName} • ${role}`;
  const fontSize = Math.max(24, Math.round(width / 34));
  const padding = Math.round(fontSize * 0.75);
  const svg = `
    <svg width="${width}" height="${fontSize * 3}">
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.38)" rx="${padding}"/>
      <text x="${padding}" y="${fontSize * 2}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">${escapeXml(watermarkText)}</text>
    </svg>`;
  return sharp(buffer, { failOn: "none" })
    .composite([{ input: Buffer.from(svg), gravity: "southeast" }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[char]));
}
