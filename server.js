// PLAIN FOLD 쇼핑몰 서버
// - public/ 정적 파일 제공
// - 주문 생성(금액은 서버가 계산), 토스페이먼츠 결제 승인
// 실행: node server.js  (Node 18 이상, 별도 패키지 설치 없음)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;

// 토스페이먼츠 개발자 문서에 공개된 결제위젯 테스트 키 (실제 돈이 나가지 않음)
const CLIENT_KEY = process.env.TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

// 실제 결제가 일어나지 않도록 테스트 키(test_)만 허용
if (!CLIENT_KEY.startsWith('test_') || !SECRET_KEY.startsWith('test_')) {
  console.error('[중단] 이 프로젝트는 테스트 키(test_로 시작)만 사용할 수 있습니다.');
  process.exit(1);
}

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const catalog = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
const productById = new Map(catalog.products.map((p) => [p.id, p]));

let orders = {};
try {
  orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
} catch {
  orders = {};
}
function saveOrders() {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
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

function shippingFee(subtotal) {
  return subtotal === 0 || subtotal >= catalog.shipping.freeOver ? 0 : catalog.shipping.fee;
}

function isStr(v, min, max) {
  return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}

// 주문 생성: 장바구니 항목을 상품 데이터와 대조해서 금액을 서버가 직접 계산
function createOrder(body) {
  const { items, customer } = body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    return { error: { status: 400, code: 'INVALID_ITEMS', message: '장바구니가 비어 있거나 항목이 너무 많아요.' } };
  }
  const lines = [];
  for (const it of items) {
    const p = productById.get(it && it.id);
    const qty = Number(it && it.qty);
    if (!p) return { error: { status: 400, code: 'NOT_FOUND_PRODUCT', message: '판매하지 않는 상품이 들어 있어요.' } };
    const color = p.colors.find((c) => c.name === it.color);
    if (!color || !p.sizes.includes(it.size)) {
      return { error: { status: 400, code: 'INVALID_OPTION', message: `${p.name}의 옵션이 올바르지 않아요.` } };
    }
    if (p.soldOut.includes(`${it.color}/${it.size}`)) {
      return { error: { status: 409, code: 'SOLD_OUT', message: `${p.name} (${it.color}/${it.size})은 품절이에요.` } };
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      return { error: { status: 400, code: 'INVALID_QTY', message: '수량은 1~10개까지 담을 수 있어요.' } };
    }
    lines.push({ id: p.id, name: p.name, shape: p.shape, color: it.color, hex: color.hex, size: it.size, qty, price: p.price, lineTotal: p.price * qty });
  }

  const c = customer || {};
  const phoneDigits = typeof c.phone === 'string' ? c.phone.replace(/-/g, '') : '';
  if (!isStr(c.name, 1, 20)) return { error: { status: 400, code: 'INVALID_NAME', message: '받는 분 이름을 확인해 주세요.' } };
  if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) return { error: { status: 400, code: 'INVALID_PHONE', message: '휴대폰 번호를 확인해 주세요.' } };
  if (!isStr(c.address, 2, 100)) return { error: { status: 400, code: 'INVALID_ADDRESS', message: '주소를 확인해 주세요.' } };
  if (c.addressDetail != null && !isStr(c.addressDetail, 0, 100)) return { error: { status: 400, code: 'INVALID_ADDRESS', message: '상세 주소가 너무 길어요.' } };
  if (c.memo != null && !isStr(c.memo, 0, 50)) return { error: { status: 400, code: 'INVALID_MEMO', message: '배송 메모가 너무 길어요.' } };

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shipping = shippingFee(subtotal);
  const amount = subtotal + shipping;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderId = `PF${today}-${crypto.randomBytes(5).toString('hex')}`;
  const orderName = lines.length > 1 ? `${lines[0].name} 외 ${lines.length - 1}건` : lines[0].name;

  const order = {
    orderId,
    orderName,
    items: lines,
    subtotal,
    shipping,
    amount,
    customer: {
      name: c.name.trim(),
      phone: phoneDigits,
      address: c.address.trim(),
      addressDetail: (c.addressDetail || '').trim(),
      memo: (c.memo || '').trim(),
    },
    status: 'READY',
    createdAt: new Date().toISOString(),
  };
  orders[orderId] = order;
  saveOrders();
  return { order };
}

function publicOrder(o) {
  const phone = o.customer.phone;
  return {
    orderId: o.orderId,
    orderName: o.orderName,
    items: o.items,
    subtotal: o.subtotal,
    shipping: o.shipping,
    amount: o.amount,
    status: o.status,
    customer: {
      name: o.customer.name,
      phone: phone.slice(0, 3) + '-****-' + phone.slice(-4),
      address: o.customer.address,
      addressDetail: o.customer.addressDetail,
      memo: o.customer.memo,
    },
    payment: o.payment || null,
    createdAt: o.createdAt,
  };
}

// 결제 승인: successUrl로 돌아온 값을 서버에 저장된 주문 금액과 비교한 뒤 토스페이먼츠에 승인 요청
async function confirmPayment(body) {
  const { paymentKey, orderId, amount } = body || {};
  if (typeof paymentKey !== 'string' || paymentKey.length > 200 || !/^[\x21-\x7e]+$/.test(paymentKey)) {
    return { status: 400, body: { code: 'INVALID_PAYMENT_KEY', message: '결제 정보가 올바르지 않아요.' } };
  }
  const order = orders[orderId];
  if (!order) return { status: 404, body: { code: 'NOT_FOUND_ORDER', message: '주문을 찾을 수 없어요.' } };

  if (order.status === 'DONE') {
    if (order.payment && order.payment.paymentKey === paymentKey) return { status: 200, body: { order: publicOrder(order) } };
    return { status: 409, body: { code: 'ALREADY_PAID', message: '이미 결제가 끝난 주문이에요.' } };
  }
  if (Number(amount) !== order.amount) {
    return { status: 400, body: { code: 'AMOUNT_MISMATCH', message: '주문 금액과 결제 금액이 달라 결제를 진행하지 않았어요.' } };
  }

  const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');
  let res;
  let data;
  try {
    res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
    });
    data = await res.json();
  } catch (e) {
    return { status: 502, body: { code: 'NETWORK_ERROR', message: '결제 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' } };
  }

  if (!res.ok) {
    order.status = 'FAILED';
    order.failure = { code: data.code, message: data.message };
    saveOrders();
    return { status: res.status, body: { code: data.code, message: data.message } };
  }

  order.status = 'DONE';
  order.payment = {
    paymentKey: data.paymentKey,
    method: data.method,
    easyPay: data.easyPay ? data.easyPay.provider : null,
    totalAmount: data.totalAmount,
    approvedAt: data.approvedAt,
    receiptUrl: data.receipt ? data.receipt.url : null,
  };
  saveOrders();
  return { status: 200, body: { order: publicOrder(order) } };
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
    if (req.method === 'GET' && p === '/api/catalog') return sendJson(res, 200, catalog);
    if (req.method === 'GET' && p === '/api/config') return sendJson(res, 200, { clientKey: CLIENT_KEY, testMode: true });

    if (req.method === 'POST' && p === '/api/orders') {
      const result = createOrder(await readBody(req));
      if (result.error) return sendJson(res, result.error.status, { code: result.error.code, message: result.error.message });
      const o = result.order;
      return sendJson(res, 201, {
        orderId: o.orderId,
        orderName: o.orderName,
        amount: o.amount,
        customerName: o.customer.name,
        customerMobilePhone: o.customer.phone,
      });
    }

    const m = p.match(/^\/api\/orders\/([A-Za-z0-9_-]{6,64})$/);
    if (req.method === 'GET' && m) {
      const o = orders[m[1]];
      return o ? sendJson(res, 200, publicOrder(o)) : sendJson(res, 404, { code: 'NOT_FOUND_ORDER', message: '주문을 찾을 수 없어요.' });
    }

    if (req.method === 'POST' && p === '/api/confirm') {
      const r = await confirmPayment(await readBody(req));
      return sendJson(res, r.status, r.body);
    }

    if (p.startsWith('/api/')) return sendJson(res, 404, { code: 'NOT_FOUND', message: '없는 API예요.' });
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
