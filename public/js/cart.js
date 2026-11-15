renderHeader();
renderFooter();

const root = document.getElementById('cart');

function render(catalog) {
  const lines = resolveCart(catalog);
  if (lines.length === 0) {
    root.innerHTML = `<div class="empty"><p>장바구니가 비어 있어요.</p><a class="btn btn-primary" href="/products.html">쇼핑 계속하기</a></div>`;
    return;
  }

  const valid = lines.filter((l) => !l.invalid);
  const subtotal = valid.reduce((s, l) => s + l.lineTotal, 0);
  const ship = shippingFee(catalog, subtotal);
  const remain = catalog.shipping.freeOver - subtotal;
  const hasInvalid = lines.some((l) => l.invalid);

  root.innerHTML = `
    <div class="cart">
      <ul class="cart-list">
        ${lines
          .map((l, i) => {
            const p = l.product;
            const img = p ? garmentSVG(p.shape, l.hex || p.colors[0].hex, p.name) : '';
            return `<li class="cart-item${l.invalid ? ' is-invalid' : ''}">
              <a class="cart-thumb" href="${p ? '/product.html?id=' + p.id : '#'}">${img}</a>
              <div class="cart-info">
                <a class="cart-name" href="${p ? '/product.html?id=' + p.id : '#'}">${p ? escapeHtml(p.name) : '삭제된 상품'}</a>
                <p class="cart-option">${escapeHtml(l.color)} / ${escapeHtml(l.size)}</p>
                ${l.invalid ? `<p class="field-error">${l.invalid} · 주문에서 빠져요</p>` : `<p class="cart-unit">${won(p.price)}</p>`}
              </div>
              <div class="qty" ${l.invalid ? 'hidden' : ''}>
                <button type="button" data-step="-1" data-index="${i}" aria-label="수량 줄이기">−</button>
                <span>${l.qty}</span>
                <button type="button" data-step="1" data-index="${i}" aria-label="수량 늘리기">+</button>
              </div>
              <strong class="cart-line-total">${l.invalid ? '-' : won(l.lineTotal)}</strong>
              <button type="button" class="cart-remove" data-remove="${i}" aria-label="삭제">×</button>
            </li>`;
          })
          .join('')}
      </ul>
      <aside class="panel summary">
        <h2>주문 금액</h2>
        <dl class="summary-rows">
          <div><dt>상품 금액</dt><dd>${won(subtotal)}</dd></div>
          <div><dt>배송비</dt><dd>${ship ? won(ship) : '무료'}</dd></div>
          <div class="summary-total"><dt>결제 예정 금액</dt><dd>${won(subtotal + ship)}</dd></div>
        </dl>
        ${subtotal > 0 && remain > 0 ? `<p class="hint">${won(remain)} 더 담으면 무료배송이에요.</p>` : ''}
        ${hasInvalid ? `<button type="button" class="btn btn-block" id="remove-invalid">주문할 수 없는 상품 비우기</button>` : ''}
        <a class="btn btn-primary btn-block btn-lg${valid.length ? '' : ' is-disabled'}" href="/checkout.html" id="go-checkout" ${valid.length ? '' : 'aria-disabled="true"'}>주문하기</a>
        <a class="btn btn-block" href="/products.html">쇼핑 계속하기</a>
      </aside>
    </div>`;
}

(async () => {
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (e) {
    return showPageError(root, e.message);
  }
  render(catalog);

  root.addEventListener('click', (e) => {
    const cart = getCart();
    const step = e.target.closest('[data-step]');
    const rm = e.target.closest('[data-remove]');
    if (step) {
      const item = cart[Number(step.dataset.index)];
      item.qty = Math.max(1, Math.min(10, item.qty + Number(step.dataset.step)));
      saveCart(cart);
      render(catalog);
    } else if (rm) {
      cart.splice(Number(rm.dataset.remove), 1);
      saveCart(cart);
      render(catalog);
    } else if (e.target.id === 'remove-invalid') {
      const keep = resolveCart(catalog).filter((l) => !l.invalid).map(({ id, color, size, qty }) => ({ id, color, size, qty }));
      saveCart(keep);
      render(catalog);
    } else if (e.target.closest('#go-checkout.is-disabled')) {
      e.preventDefault();
    }
  });
})();
