import express from 'express';
import { createCanvas } from 'canvas';

const app = express();
app.use(express.json());

class RuinMapAPI {
  constructor({ seed = 1, size = 64, tileSize = 1, heightScale = 1 } = {}) {
    this.seed = seed >>> 0;
    this.size = size;
    this.tileSize = tileSize;
    this.heightScale = heightScale;
    this.sections = new Map();
  }

  async generateSection({ sectionX = 0, sectionY = 0, nextDirection = 'east' } = {}) {
    const key = `${sectionX},${sectionY}`;
    if (this.sections.has(key)) return this.sections.get(key);

    const noise = this.#makeNoise(this.seed + sectionX * 73856093 + sectionY * 19349663);
    const tiles = [];

    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const wx = sectionX * this.size + x;
        const wz = sectionY * this.size + z;
        const n = noise(wx * 0.08, wz * 0.08);
        const road = Math.abs(x - this.size / 2) < 2 || Math.abs(z - this.size / 2) < 2;
        const rubble = n > 0.58 ? 'large' : n > 0.42 ? 'small' : 'none';
        const collapsed = n > 0.72;
        const height = road ? 0 : Math.max(0, Math.round((n - 0.35) * 6) * this.heightScale);
        const connection = this.#edgeLink(x, z, nextDirection);

        tiles.push({
          x,
          z,
          worldX: wx,
          worldZ: wz,
          type: road ? 'street' : collapsed ? 'building_ruin' : 'debris',
          rubble,
          height,
          passable: road || rubble !== 'large',
          connection
        });
      }
    }

    const section = {
      sectionX,
      sectionY,
      size: this.size,
      tileSize: this.tileSize,
      nextDirection,
      tiles,
      meta: {
        theme: 'town_ruins',
        seamlessEdges: true,
        generatedAt: new Date().toISOString()
      }
    };

    this.sections.set(key, section);
    return section;
  }

  #edgeLink(x, z, dir) {
    const max = this.size - 1;
    if (dir === 'east' && x >= max - 1) return { edge: 'east', linkId: `E-${z}` };
    if (dir === 'west' && x <= 1) return { edge: 'west', linkId: `W-${z}` };
    if (dir === 'north' && z <= 1) return { edge: 'north', linkId: `N-${x}` };
    if (dir === 'south' && z >= max - 1) return { edge: 'south', linkId: `S-${x}` };
    return null;
  }

  #makeNoise(seed) {
    return (x, y) => {
      let n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.0001) * 43758.5453;
      n = n - Math.floor(n);
      const n2 = Math.sin((x + 11.3) * 5.123 + (y + 7.7) * 91.7 + seed * 0.0002) * 24634.6345;
      const f2 = n2 - Math.floor(n2);
      return n * 0.7 + f2 * 0.3;
    };
  }
}

function drawPNG(section, width = 1024, height = 1024) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#c0d0e0';
  ctx.fillRect(0, 0, width, height);

  const tileW = width / section.size;
  const tileH = height / section.size;

  for (const t of section.tiles) {
    const x = t.x * tileW;
    const y = t.z * tileH;

    if (t.type === 'street') ctx.fillStyle = '#444444';
    else if (t.type === 'building_ruin') ctx.fillStyle = t.rubble === 'large' ? '#5b4d3a' : '#777777';
    else ctx.fillStyle = t.rubble === 'large' ? '#5b4d3a' : '#6a5c4a';

    ctx.fillRect(x, y, tileW, tileH);
  }

  return canvas.toBuffer('image/png');
}

app.post('/api/ruins-map', async (req, res) => {
  try {
    const { seed = 1, size = 64, sectionX = 0, sectionY = 0, nextDirection = 'east', width = 1024, height = 1024 } = req.body || {};
    const api = new RuinMapAPI({ seed, size });
    const section = await api.generateSection({ sectionX, sectionY, nextDirection });
    const png = drawPNG(section, width, height);

    res.type('png').send(png);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Listening on ${port}`));
