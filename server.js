const express = require("express");
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateNodes(seed, width, height, count) {
  const rand = mulberry32(seed);
  const nodes = [];
  const margin = 80;

  while (nodes.length < count) {
    const x = Math.floor(margin + rand() * (width - margin * 2));
    const y = Math.floor(margin + rand() * (height - margin * 2));

    const ok = nodes.every(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy > 2500;
    });

    if (ok) nodes.push({ id: nodes.length, x, y, type: nodes.length === 0 ? "citadel" : "ruin" });
  }

  return nodes;
}

function generateTree(nodes, seed) {
  const rand = mulberry32(seed + 1);
  const edges = [];

  for (let i = 1; i < nodes.length; i++) {
    const parent = Math.floor(rand() * i);
    edges.push({ from: parent, to: i });
  }

  return edges;
}

function renderMap(nodes, edges, width, height, seed) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(seed + 2);

  ctx.fillStyle = "#1d1914";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 2500; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const a = rand() * 0.08;
    ctx.fillStyle = `rgba(255, 240, 210, ${a})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = "#8a7358";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  edges.forEach(e => {
    const a = nodes[e.from];
    const b = nodes[e.to];
    const midX = (a.x + b.x) / 2 + (rand() - 0.5) * 30;
    const midY = (a.y + b.y) / 2 + (rand() - 0.5) * 30;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(midX, midY, b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = "#5f4f3d";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#8a7358";
    ctx.lineWidth = 6;
  });

  nodes.forEach((n, i) => {
    ctx.beginPath();
    ctx.fillStyle = i === 0 ? "#b89b63" : "#d4c09b";
    ctx.arc(n.x, n.y, i === 0 ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2b241d";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#f2e3c6";
    ctx.font = "16px serif";
    ctx.fillText(n.type === "citadel" ? "Citadel" : `R${i}`, n.x + 12, n.y - 10);
  });

  return canvas.toBuffer("image/png");
}

app.post("/generate", (req, res) => {
  const seed = Number(req.body.seed ?? Date.now());
  const width = Number(req.body.width ?? 1024);
  const height = Number(req.body.height ?? 1024);
  const nodeCount = Number(req.body.nodeCount ?? 28);

  const nodes = generateNodes(seed, width, height, nodeCount);
  const edges = generateTree(nodes, seed);

  const png = renderMap(nodes, edges, width, height, seed);

  const outDir = path.join(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const fileName = `ruins_${seed}.png`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, png);

  res.json({
    imageUrl: `/maps/${fileName}`,
    graph: { nodes, edges }
  });
});

app.get("/maps/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "output", req.params.file));
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Listening on ${port}`));
