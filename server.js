// PLAIN FOLD 쇼핑몰 로컬 서버
// - public/ 정적 파일 제공
// - /api/* 는 lib/shop.js 로직 사용 (Vercel 배포 시에는 api/*.js 함수가 같은 로직을 사용)
// 실행: node server.js  (Node 18 이상, 별도 패키지 설치 없음)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi, TEST_MODE } = require('./lib/shop');

const PORT = Number(process.env.PORT) || 3000;

// 실제 결제가 일어나지 않도록 테스트 키(test_)만 허용
if (!TEST_MODE) {
  console.error('[중단] 이 프로젝트는 테스트 키(test_로 시작)만 사용할 수 있습니다.');
  process.exit(1);
}

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, '404.html'), (e2, page) => {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(e2 ? 'Not Found' : page);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  try {
    if (p.startsWith('/api/')) {
      const body = req.method === 'POST' ? await readBody(req) : null;
      const r = await handleApi(req.method, p, body);
      return sendJson(res, r.status, r.body);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    serveStatic(req, res, p);
  } catch (e) {
    const known = e.message === 'INVALID_JSON' || e.message === 'BODY_TOO_LARGE';
    sendJson(res, known ? 400 : 500, { code: known ? e.message : 'SERVER_ERROR', message: '요청을 처리하지 못했어요.' });
  }
});

server.listen(PORT, () => {
  console.log(`PLAIN FOLD 실행 중 → http://localhost:${PORT}  (토스페이먼츠 테스트 모드)`);
});
