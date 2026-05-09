// proxy.js — forwards browser requests to the quED, adds CORS headers.
// Run:  node proxy.js
// Then in qkd_e91.html set REST port to 8083.

const http = require('http');

const PROXY_PORT = 8083;
const QUED_HOST  = 'localhost';
const QUED_PORT  = 8082;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age':       '86400',
};

http.createServer((req, res) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.url}`);

  // Preflight — answer immediately, do NOT forward to the device.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Buffer body so we can forward + log it.
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (body.length) console.log('  body:', body.toString());

    const fwdHeaders = { ...req.headers };
    delete fwdHeaders.host;
    delete fwdHeaders.origin;
    delete fwdHeaders.referer;
    fwdHeaders.host = `${QUED_HOST}:${QUED_PORT}`;
    if (body.length) fwdHeaders['content-length'] = body.length;

    const upstream = http.request({
      host:    QUED_HOST,
      port:    QUED_PORT,
      path:    req.url,
      method:  req.method,
      headers: fwdHeaders,
    }, upRes => {
      console.log(`  → ${upRes.statusCode}`);
      const headers = { ...upRes.headers, ...CORS_HEADERS };
      res.writeHead(upRes.statusCode, headers);
      upRes.pipe(res);
    });

    upstream.on('error', err => {
      console.error('  upstream error:', err.message);
      res.writeHead(502, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
      res.end('proxy error: ' + err.message);
    });

    if (body.length) upstream.write(body);
    upstream.end();
  });
}).listen(PROXY_PORT, () => {
  console.log(`CORS proxy listening on http://localhost:${PROXY_PORT}`);
  console.log(`forwarding → http://${QUED_HOST}:${QUED_PORT}`);
});
