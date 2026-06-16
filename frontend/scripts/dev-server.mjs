import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRoot = join(root, "src");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolvePath(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const requested = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  return join(publicRoot, requested === "/" ? "index.html" : requested);
}

const server = createServer(async (request, response) => {
  let filePath = resolvePath(request.url || "/");

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  } catch {
    filePath = join(publicRoot, "index.html");
  }

  response.setHeader(
    "Content-Type",
    contentTypes[extname(filePath)] || "application/octet-stream",
  );
  createReadStream(filePath)
    .on("error", () => {
      response.writeHead(404);
      response.end("Not found");
    })
    .pipe(response);
});

server.listen(port, host, () => {
  console.log(`Frontend available at http://${host}:${port}`);
});
