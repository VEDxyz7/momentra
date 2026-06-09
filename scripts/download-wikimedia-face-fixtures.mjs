import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve(process.argv[2] ?? "tests/fixtures/real-faces");

const sets = [
  {
    label: "dhoni",
    categories: ["Category:Mahendra Singh Dhoni"],
    exclude: /graph|bat|jersey|kit|shoe|museum|stumps/i,
    directory: "dhoni-album",
    queryDirectory: "queries",
    queryName: "dhoni-external.jpg",
    limit: 50
  },
  {
    label: "kohli",
    categories: ["Category:Portraits of Virat Kohli", "Category:Virat Kohli in cricket field", "Category:Virat Kohli"],
    exclude: /webm|bat|jersey|wax|statue|logo/i,
    directory: "kohli-album",
    queryDirectory: "queries",
    queryName: "kohli-external.jpg",
    limit: 60
  },
  {
    label: "unknown",
    categories: ["Category:Sachin Tendulkar"],
    exclude: /graph|bat|jersey|museum/i,
    directory: "unknown-pool",
    queryDirectory: "queries",
    queryName: "unknown-external.jpg",
    limit: 20
  }
];

async function commonsFiles(category, limit) {
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: category,
    gcmtype: "file",
    gcmlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "640",
    format: "json",
    origin: "*"
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error(`Commons API failed for ${category}: ${response.status}`);
  const payload = await response.json();
  return Object.values(payload.query?.pages ?? {})
    .map((page) => ({
      title: page.title,
      url: page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url,
      mime: page.imageinfo?.[0]?.mime
    }))
    .filter((file) => file.url && /^image\/(jpeg|png|webp)$/i.test(file.mime));
}

async function download(url, target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": "Momentra face-recognition QA/1.0 (local testing)" } });
    if (response.ok) {
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
      return true;
    }
    if (response.status !== 429 || attempt === 3) throw new Error(`Download failed: ${response.status} ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  return false;
}

function safeName(index, title) {
  return `${String(index + 1).padStart(2, "0")}-${title.replace(/^File:/, "").replace(/[^a-z0-9.]+/gi, "-").slice(0, 90)}.jpg`;
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const manifest = [];
  for (const set of sets) {
    const targetDir = path.join(outputRoot, set.directory);
    const queryDir = path.join(outputRoot, set.queryDirectory);
    await mkdir(targetDir, { recursive: true });
    await mkdir(queryDir, { recursive: true });
    const files = [];
    for (const category of set.categories) {
      files.push(...await commonsFiles(category, set.limit));
    }
    const deduped = [...new Map(files
      .filter((file) => !set.exclude?.test(file.title))
      .map((file) => [file.title, file])).values()];
    if (deduped.length < 6 && set.label !== "unknown") throw new Error(`Not enough usable files found for ${set.label}`);
    const [query, ...album] = deduped;
    try {
      await download(query.url, path.join(queryDir, set.queryName));
      manifest.push({ role: "query", person: set.label, title: query.title, source: query.url });
    } catch (error) {
      console.warn(`Skipping query ${query.title}: ${error.message}`);
    }
    let saved = 0;
    for (const file of album) {
      if (saved >= 8) break;
      const target = path.join(targetDir, safeName(saved, file.title));
      try {
        await download(file.url, target);
        manifest.push({ role: "album", person: set.label, title: file.title, source: file.url, target });
        saved += 1;
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        console.warn(`Skipping ${file.title}: ${error.message}`);
      }
    }
  }
  await mkdir(path.join(outputRoot, "group"), { recursive: true });
  await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ outputRoot, downloaded: manifest.length, manifest: path.join(outputRoot, "manifest.json") }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
