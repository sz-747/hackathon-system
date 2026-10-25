// Local server: static files from this folder with clean URLs, /api/* through the same function
// Vercel runs. Uses the embedded PGlite database unless DATABASE_URL is set.
//   ADMIN_CODE=TEST-ADMN node dev.js        (port 8790, or PORT)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/index.js');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return handler(req, res);
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT) || 8790, '127.0.0.1', () => console.log('dev server on http://127.0.0.1:' + (Number(process.env.PORT) || 8790)));
