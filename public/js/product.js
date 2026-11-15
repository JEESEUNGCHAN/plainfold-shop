renderHeader();
renderFooter();

(async () => {
  const root = document.getElementById('detail');
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (e) {
    return showPageError(root, e.message);
  }
  // 상품 페이지(/products/ID.html)는 body의 data-product-id, 예전 주소(product.html?id=)는 쿼리에서 읽는다
  const id = document.body.dataset.productId || new URLSearchParams(location.search).get('id');
  const p = catalog.products.find((x) => x.id === id);
  if (!p) return showPageError(root, '상품을 찾을 수 없어요.');

  document.title = `${p.name} | PLAIN FOLD`;
  const firstAvailable = p.colors.find((c) => p.sizes.some((s) => !p.soldOut.includes(`${c.name}/${s}`))) || p.colors[0];
  const sel = { color: firstAvailable.name, size: null, qty: 1 };
  const isSoldOut = (color, size) => p.soldOut.includes(`${color}/${size}`);
  const cat = categoryName(catalog, p.category);

  root.innerHTML = `
    <nav class="breadcrumb"><a href="/">홈</a> / <a href="/products.html?category=${p.category}">${cat}</a> / <span>${escapeHtml(p.name)}</span></nav>
    <div class="detail">
      <div class="detail-img" id="detail-img"></div>
      <div class="detail-info">
        <p class="eyebrow">${cat}${p.isNew ? ' · NEW' : ''}</p>
        <h1>${escapeHtml(p.name)}</h1>
        <p class="detail-price">${won(p.price)}</p>
        <p class="detail-desc">${escapeHtml(p.desc)}</p>

        <div class="option">
          <p class="option-label">색상 <span id="color-name"></span></p>
          <div class="swatches" id="swatches"></div>
        </div>
        <div class="option">
          <p class="option-label">사이즈</p>
          <div class="sizes" id="sizes"></div>
        </div>
        <div class="option">
          <p class="option-label">수량</p>
          <div class="qty" id="qty">
            <button type="button" data-step="-1" aria-label="수량 줄이기">−</button>
            <span id="qty-value">1</span>
            <button type="button" data-step="1" aria-label="수량 늘리기">+</button>
          </div>
        </div>

        <div class="detail-total"><span>총 상품 금액</span><strong id="total"></strong></div>
        <p class="field-error" id="option-error"></p>
        <div class="detail-actions">
          <button type="button" class="btn btn-lg" id="add-cart">장바구니 담기</button>
          <button type="button" class="btn btn-lg btn-primary" id="buy-now">바로 구매</button>
        </div>

        <dl class="spec">
          <div><dt>소재</dt><dd>${escapeHtml(p.material)}</dd></div>
          <div><dt>핏 · 크기</dt><dd>${escapeHtml(p.fit)}</dd></div>
          <div><dt>배송</dt><dd>${won(catalog.shipping.freeOver)} 이상 무료, 미만 ${won(catalog.shipping.fee)}</dd></div>
        </dl>
      </div>
    </div>
    <section class="section">
      <div class="section-head"><h2>같은 카테고리 상품</h2></div>
      <div class="grid" id="related"></div>
    </section>`;

  function draw() {
    const color = p.colors.find((c) => c.name === sel.color);
    document.getElementById('detail-img').innerHTML = garmentSVG(p.shape, color.hex, `${p.name} ${color.name}`);
    document.getElementById('color-name').textContent = sel.color;
    document.getElementById('swatches').innerHTML = p.colors
      .map((c) => `<button type="button" class="swatch${c.name === sel.color ? ' is-active' : ''}" data-color="${escapeHtml(c.name)}" aria-label="${escapeHtml(c.name)}" aria-pressed="${c.name === sel.color}" style="--sw:${c.hex}"></button>`)
      .join('');
    if (sel.size && isSoldOut(sel.color, sel.size)) sel.size = null;
    document.getElementById('sizes').innerHTML = p.sizes
      .map((s) => {
        const out = isSoldOut(sel.color, s);
        return `<button type="button" class="size${s === sel.size ? ' is-active' : ''}" data-size="${s}" ${out ? 'disabled' : ''} aria-pressed="${s === sel.size}">${s}${out ? '<small>품절</small>' : ''}</button>`;
      })
      .join('');
    document.getElementById('qty-value').textContent = sel.qty;
    document.getElementById('total').textContent = won(p.price * sel.qty);
  }

  // 사이즈가 하나뿐이면(FREE) 품절이 아닐 때 자동 선택
  if (p.sizes.length === 1 && !isSoldOut(sel.color, p.sizes[0])) sel.size = p.sizes[0];
  draw();

  root.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    const sz = e.target.closest('[data-size]');
    const st = e.target.closest('[data-step]');
    if (sw) {
      sel.color = sw.dataset.color;
      if (p.sizes.length === 1) sel.size = isSoldOut(sel.color, p.sizes[0]) ? null : p.sizes[0];
    }
    if (sz && !sz.disabled) sel.size = sz.dataset.size;
    if (st) sel.qty = Math.max(1, Math.min(10, sel.qty + Number(st.dataset.step)));
    if (sw || sz || st) {
      document.getElementById('option-error').textContent = '';
      draw();
    }
  });

  function tryAdd() {
    const err = document.getElementById('option-error');
    if (!sel.size) {
      const allOut = p.sizes.every((s) => isSoldOut(sel.color, s));
      err.textContent = allOut ? '이 색상은 모든 사이즈가 품절이에요. 다른 색상을 골라 주세요.' : '사이즈를 선택해 주세요.';
      return false;
    }
    addToCart({ id: p.id, color: sel.color, size: sel.size, qty: sel.qty });
    return true;
  }

  document.getElementById('add-cart').addEventListener('click', () => {
    if (tryAdd()) toast(`장바구니에 담았어요 <a href="/cart.html">장바구니 보기</a>`);
  });
  document.getElementById('buy-now').addEventListener('click', () => {
    if (tryAdd()) location.href = '/cart.html';
  });

  const related = catalog.products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  document.getElementById('related').innerHTML = related.map(productCard).join('');
})();
