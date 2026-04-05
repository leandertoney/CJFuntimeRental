require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const OpenAI = require('openai');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUT_DIR = path.join(__dirname, '../public/routes');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ROUTES = [
  {
    slug: 'holtwood-susquehanna-loop',
    title: 'Lancaster to Holtwood & Susquehanna Loop',
    prompt: 'A breathtaking aerial photograph of the Susquehanna River gorge in Lancaster County, Pennsylvania at golden hour. The river winds through dense forested hills with dramatic rocky cliffs. A narrow winding road runs along the river\'s edge through autumn foliage. Warm amber and orange light, cinematic wide shot, ultra-realistic landscape photography.'
  },
  {
    slug: 'amish-country-route-340',
    title: 'Amish Country Back Roads — Route 340',
    prompt: 'A stunning cinematic photograph of Lancaster County Pennsylvania Amish Country farmland at sunrise. Rolling green fields with white farmhouses, red barns, and a horse-drawn buggy on a two-lane country road lined with wooden fences. Early morning golden light, peaceful rural landscape, ultra-realistic photography, wide angle.'
  },
  {
    slug: 'conestoga-run',
    title: 'Conestoga Run',
    prompt: 'A cinematic photograph of a winding tree-lined road following a peaceful creek through dense woodland in Lancaster County, Pennsylvania. Dappled sunlight filters through a green forest canopy onto a quiet two-lane road. The creek runs alongside with reflections of the trees. Lush, serene, ultra-realistic landscape photography.'
  },
  {
    slug: 'wrightsville-columbia-cross-ride',
    title: 'Wrightsville–Columbia–York County Cross Ride',
    prompt: 'A dramatic cinematic photograph of a long bridge crossing the wide Susquehanna River in Pennsylvania at dusk. The bridge stretches across the water with rolling hills and farmland visible on both shores. The river reflects the orange and purple sky. Ultra-realistic landscape photography, wide angle, golden hour.'
  },
  {
    slug: 'full-lancaster-county-loop',
    title: 'Full Lancaster County Loop',
    prompt: 'A sweeping aerial photograph of Lancaster County Pennsylvania countryside showing the full breadth of the landscape — patchwork farmland, small historic river towns, forested river gorges, and rolling hills extending to the horizon. Autumn colors, late afternoon light, ultra-realistic cinematic landscape photography.'
  },
  {
    slug: 'covered-bridge-north-loop',
    title: 'Lancaster North Loop — Lititz & Covered Bridge Back Roads',
    prompt: 'A beautiful cinematic photograph of a historic wooden covered bridge over a gently flowing creek in Lancaster County, Pennsylvania. The bridge is surrounded by tall trees in full autumn foliage — red, orange, and gold leaves. A quiet country road leads through the bridge. Warm afternoon light, ultra-realistic landscape photography.'
  }
];

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function generateAll() {
  console.log(`Generating ${ROUTES.length} route images with DALL-E 3...\n`);

  for (const route of ROUTES) {
    const outPath = path.join(OUT_DIR, `${route.slug}.jpg`);

    if (fs.existsSync(outPath)) {
      console.log(`  ✓ ${route.slug}.jpg already exists — skipping`);
      continue;
    }

    console.log(`  → Generating: ${route.title}`);
    try {
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt: route.prompt,
        n: 1,
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
      });

      const imageUrl = response.data[0].url;
      await downloadImage(imageUrl, outPath);
      console.log(`  ✓ Saved: ${route.slug}.jpg`);

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`  ✗ Failed: ${route.title} — ${err.message}`);
    }
  }

  console.log('\nDone. Images saved to public/routes/');
}

generateAll();
