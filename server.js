// Proxy mínimo para la demo de Compliance IA.
// Sirve index.html y reenvía POST /api/messages a la API de Anthropic,
// añadiendo la API key en el servidor (nunca en el navegador).
//
// Uso:
//   ANTHROPIC_API_KEY=sk-ant-... node server.js
//
// La app quedará disponible en http://<ip-del-servidor>:3000

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "[aviso] ANTHROPIC_API_KEY no está definida. Arranca el servidor con:\n" +
    "  ANTHROPIC_API_KEY=sk-ant-... node server.js"
  );
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function serveStatic(req, res) {
  const filePath = req.url === "/" ? "/index.html" : req.url;
  const fullPath = path.join(__dirname, filePath);

  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleMessagesProxy(req, res) {
  if (!ANTHROPIC_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "El servidor no tiene configurada ANTHROPIC_API_KEY." } }));
    return;
  }

  try {
    const rawBody = await readBody(req);

    const anthropicRes = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: rawBody
    });

    const text = await anthropicRes.text();
    res.writeHead(anthropicRes.status, { "Content-Type": "application/json" });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "No se ha podido contactar con la API de Anthropic." } }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/messages") {
    handleMessagesProxy(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Compliance IA demo escuchando en http://0.0.0.0:${PORT}`);
});
