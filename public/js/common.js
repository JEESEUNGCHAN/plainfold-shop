// 모든 페이지 공통: 상품 데이터, 장바구니(localStorage), 헤더/푸터, 상품 카드

const CART_KEY = 'plainfold_cart_v1';
let catalogPromise = null;

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/api/catalog').then((r) => {
      if (!r.ok) throw new Error('상품 정보를 불러오지 못했어요.');
      return r.json();
    });
  }
  return catalogPromise;
}

function won(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function categoryName(catalog, id) {
  const c = catalog.categories.find((x) => x.id === id);
  return c ? c.name : '';
}

function shippingFee(catalog, subtotal) {
  return subtotal === 0 || subtotal >= catalog.shipping.freeOver ? 0 : catalog.shipping.fee;
}

/* ---------- 장바구니 ---------- */

function getCart() {
  try {
    const v = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* 저장 공간을 쓸 수 없는 환경 */
  }
  updateCartBadge();
}

function addToCart(item) {
  const cart = getCart();
  const same = cart.find((x) => x.id === item.id && x.color === item.color && x.size === item.size);
  if (same) same.qty = Math.min(10, same.qty + item.qty);
  else cart.push({ ...item, qty: Math.min(10, item.qty) });
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function cartCount() {
  return getCart().reduce((s, x) => s + x.qty, 0);
}

// 장바구니 항목을 현재 상품 데이터와 맞춰 본다(삭제된 상품·품절 옵션 표시)
function resolveCart(catalog) {
  return getCart().map((item) => {
    const p = catalog.products.find((x) => x.id === item.id);
    if (!p) return { ...item, product: null, invalid: '판매가 끝난 상품' };
    const color = p.colors.find((c) => c.name === item.color);
    if (!color || !p.sizes.includes(item.size)) return { ...item, product: p, invalid: '옵션 정보가 바뀐 상품' };
    if (p.soldOut.includes(`${item.color}/${item.size}`)) return { ...item, product: p, hex: color.hex, invalid: '품절' };
    return { ...item, product: p, hex: color.hex, invalid: null, lineTotal: p.price * item.qty };
  });
}

/* ---------- 공통 레이아웃 ---------- */

function updateCartBadge() {
  const el = document.querySelector('[data-cart-count]');
  if (!el) return;
  const n = cartCount();
  el.textContent = n;
  el.hidden = n === 0;
}

function renderHeader(active) {
  const header = document.getElementById('site-header');
  if (!header) return;
  const link = (href, label, key) =>
    `<a href="${href}" class="nav-link${active === key ? ' is-active' : ''}">${label}</a>`;
  header.innerHTML = `
    <div class="test-banner">테스트 모드 · 토스페이먼츠 테스트 키로 동작하며 실제 결제는 이루어지지 않아요</div>
    <div class="header-inner">
      <a href="/" class="logo">PLAIN FOLD</a>
      <nav class="main-nav">
        ${link('/products.html', '전체', 'all')}
        ${link('/products.html?category=top', '상의', 'top')}
        ${link('/products.html?category=bottom', '하의', 'bottom')}
        ${link('/products.html?category=outer', '아우터', 'outer')}
        ${link('/products.html?category=acc', '잡화', 'acc')}
      </nav>
      <div class="header-actions">
        <form class="header-search" action="/products.html" role="search">
          <input type="search" name="q" placeholder="상품 검색" aria-label="상품 검색">
        </form>
        <a href="/cart.html" class="cart-link" aria-label="장바구니">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7z M9 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          <span class="cart-count" data-cart-count hidden>0</span>
        </a>
      </div>
    </div>`;
  updateCartBadge();
}

function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="footer-inner">
      <div>
        <strong class="logo">PLAIN FOLD</strong>
        <p>매일 꺼내 입는 기본 옷을 만듭니다.</p>
      </div>
      <div class="footer-info">
        <p>가상의 브랜드로 만든 쇼핑몰입니다. 상품과 주문은 실제로 판매·배송되지 않습니다.</p>
        <p>결제: 토스페이먼츠 결제위젯 (테스트 모드)</p>
      </div>
    </div>`;
}

function productCard(p) {
  const badges = [p.isNew ? '<span class="badge">NEW</span>' : '', p.best ? '<span class="badge badge-dark">BEST</span>' : ''].join('');
  const dots = p.colors.map((c) => `<span class="dot" style="background:${c.hex}" title="${escapeHtml(c.name)}"></span>`).join('');
  return `
    <a class="card" href="/product.html?id=${p.id}">
      <div class="card-img">${garmentSVG(p.shape, p.colors[0].hex, p.name)}<div class="badges">${badges}</div></div>
      <div class="card-body">
        <p class="card-name">${escapeHtml(p.name)}</p>
        <p class="card-price">${won(p.price)}</p>
        <div class="dots">${dots}</div>
      </div>
    </a>`;
}

let toastTimer = null;
function toast(html) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function showPageError(container, message) {
  container.innerHTML = `<div class="empty"><p>${escapeHtml(message)}</p><a class="btn" href="/">홈으로</a></div>`;
}

window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) updateCartBadge();
});
