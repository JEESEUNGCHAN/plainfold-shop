// 쇼핑몰 API 로직 (로컬 server.js와 Vercel 함수 api/*.js가 같이 사용)
// - 주문 생성: 금액을 서버가 계산하고, 주문 내용을 서명한 토큰(orderToken)으로 돌려준다
// - 결제 승인: 토큰 서명과 금액을 확인한 뒤 토스페이먼츠 승인 API 호출
// 서버에 주문을 저장하지 않아서 Vercel처럼 파일을 저장할 수 없는 환경에서도 동작한다.

const crypto = require('crypto');
const catalog = require('../data/products.json');

// 토스페이먼츠 개발자 문서에 공개된 결제위젯 테스트 키 (실제 돈이 나가지 않음)
const CLIENT_KEY = process.env.TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
// 주문 토큰 서명 키. 배포 환경에서는 ORDER_SECRET 환경변수로 따로 지정하는 것을 권장
const ORDER_SECRET = process.env.ORDER_SECRET || `plainfold-order:${SECRET_KEY}`;

const TEST_MODE = CLIENT_KEY.startsWith('test_') && SECRET_KEY.startsWith('test_');

const productById = new Map(catalog.products.map((p) => [p.id, p]));

function fail(status, code, message) {
  return { status, body: { code, message } };
}

function shippingFee(subtotal) {
  return subtotal === 0 || subtotal >= catalog.shipping.freeOver ? 0 : catalog.shipping.fee;
}

function isStr(v, min, max) {
  return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}

/* ---------- 주문 토큰 (HMAC 서명) ---------- */

function sign(data) {
  return crypto.createHmac('sha256', ORDER_SECRET).update(data).digest('base64url');
}

function makeToken(order) {
  const payload = Buffer.from(JSON.stringify(order)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (typeof token !== 'string' || token.length > 20000) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/* ---------- 주문 생성 ---------- */

function createOrder(body) {
  const { items, customer } = body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    return fail(400, 'INVALID_ITEMS', '장바구니가 비어 있거나 항목이 너무 많아요.');
  }
  const lines = [];
  for (const it of items) {
    const p = productById.get(it && it.id);
    const qty = Number(it && it.qty);
    if (!p) return fail(400, 'NOT_FOUND_PRODUCT', '판매하지 않는 상품이 들어 있어요.');
    const color = p.colors.find((c) => c.name === it.color);
    if (!color || !p.sizes.includes(it.size)) return fail(400, 'INVALID_OPTION', `${p.name}의 옵션이 올바르지 않아요.`);
    if (p.soldOut.includes(`${it.color}/${it.size}`)) return fail(409, 'SOLD_OUT', `${p.name} (${it.color}/${it.size})은 품절이에요.`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return fail(400, 'INVALID_QTY', '수량은 1~10개까지 담을 수 있어요.');
    lines.push({ id: p.id, name: p.name, shape: p.shape, color: it.color, hex: color.hex, size: it.size, qty, price: p.price, lineTotal: p.price * qty });
  }

  const c = customer || {};
  const phoneDigits = typeof c.phone === 'string' ? c.phone.replace(/-/g, '') : '';
  if (!isStr(c.name, 1, 20)) return fail(400, 'INVALID_NAME', '받는 분 이름을 확인해 주세요.');
  if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) return fail(400, 'INVALID_PHONE', '휴대폰 번호를 확인해 주세요.');
  if (!isStr(c.address, 2, 100)) return fail(400, 'INVALID_ADDRESS', '주소를 확인해 주세요.');
  if (c.addressDetail != null && !isStr(c.addressDetail, 0, 100)) return fail(400, 'INVALID_ADDRESS', '상세 주소가 너무 길어요.');
  if (c.memo != null && !isStr(c.memo, 0, 50)) return fail(400, 'INVALID_MEMO', '배송 메모가 너무 길어요.');

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
    createdAt: new Date().toISOString(),
  };

  return {
    status: 201,
    body: {
      orderId,
      orderName,
      amount,
      customerName: order.customer.name,
      customerMobilePhone: phoneDigits,
      orderToken: makeToken(order),
    },
  };
}

function publicOrder(o, payment) {
  const phone = o.customer.phone;
  return {
    orderId: o.orderId,
    orderName: o.orderName,
    items: o.items,
    subtotal: o.subtotal,
    shipping: o.shipping,
    amount: o.amount,
    status: 'DONE',
    customer: { ...o.customer, phone: phone.slice(0, 3) + '-****-' + phone.slice(-4) },
    payment,
    createdAt: o.createdAt,
  };
}

function paymentSummary(data) {
  return {
    paymentKey: data.paymentKey,
    method: data.method,
    easyPay: data.easyPay ? data.easyPay.provider : null,
    totalAmount: data.totalAmount,
    approvedAt: data.approvedAt,
    receiptUrl: data.receipt ? data.receipt.url : null,
  };
}

/* ---------- 결제 승인 ---------- */

async function tossRequest(method, url, body) {
  const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = crypto.randomUUID();
  }
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function confirmPayment(body) {
  const { paymentKey, orderId, amount, orderToken } = body || {};
  if (typeof paymentKey !== 'string' || paymentKey.length > 200 || !/^[\x21-\x7e]+$/.test(paymentKey)) {
    return fail(400, 'INVALID_PAYMENT_KEY', '결제 정보가 올바르지 않아요.');
  }
  const order = readToken(orderToken);
  if (!order || order.orderId !== orderId) return fail(404, 'NOT_FOUND_ORDER', '주문 정보를 찾을 수 없어요. 주문서에서 다시 결제해 주세요.');
  if (Number(amount) !== order.amount) {
    return fail(400, 'AMOUNT_MISMATCH', '주문 금액과 결제 금액이 달라 결제를 진행하지 않았어요.');
  }

  let r;
  try {
    r = await tossRequest('POST', 'https://api.tosspayments.com/v1/payments/confirm', { paymentKey, orderId, amount: order.amount });
    // 새로고침 등으로 이미 승인된 결제면 결제 정보를 조회해서 같은 결과를 돌려준다
    if (!r.ok && r.data.code === 'ALREADY_PROCESSED_PAYMENT') {
      const g = await tossRequest('GET', `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`);
      if (g.ok && g.data.orderId === orderId && g.data.totalAmount === order.amount && g.data.status === 'DONE') r = g;
    }
  } catch {
    return fail(502, 'NETWORK_ERROR', '결제 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  if (!r.ok) return fail(r.status, r.data.code, r.data.message);
  return { status: 200, body: { order: publicOrder(order, paymentSummary(r.data)) } };
}

/* ---------- 라우팅 ---------- */

async function handleApi(method, pathname, body) {
  if (!TEST_MODE) return fail(503, 'TEST_KEYS_ONLY', '이 프로젝트는 테스트 키(test_로 시작)만 사용할 수 있어요.');
  if (method === 'GET' && pathname === '/api/catalog') return { status: 200, body: catalog };
  if (method === 'GET' && pathname === '/api/config') return { status: 200, body: { clientKey: CLIENT_KEY, testMode: true } };
  if (method === 'POST' && pathname === '/api/orders') return createOrder(body);
  if (method === 'POST' && pathname === '/api/confirm') return confirmPayment(body);
  return fail(404, 'NOT_FOUND', '없는 API예요.');
}

// Vercel 함수용 핸들러 (api/*.js 에서 사용)
function vercelHandler(pathname) {
  return async (req, res) => {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = null;
      }
    }
    try {
      const r = await handleApi(req.method, pathname, body);
      res.setHeader('Cache-Control', 'no-store');
      res.status(r.status).json(r.body);
    } catch {
      res.status(500).json({ code: 'SERVER_ERROR', message: '요청을 처리하지 못했어요.' });
    }
  };
}

module.exports = { handleApi, vercelHandler, TEST_MODE };
