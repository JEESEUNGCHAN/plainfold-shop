renderHeader();
renderFooter();

const root = document.getElementById('result');

function renderDone(order) {
  const pay = order.payment || {};
  const approved = pay.approvedAt ? new Date(pay.approvedAt).toLocaleString('ko-KR') : '-';
  const method = (pay.method || '-') + (pay.easyPay ? ` (${pay.easyPay})` : '');
  const c = order.customer;
  root.innerHTML = `
    <div class="result-head">
      <div class="result-icon ok" aria-hidden="true">✓</div>
      <h1>주문이 완료됐어요</h1>
      <p>주문번호 <strong>${escapeHtml(order.orderId)}</strong></p>
      <p class="notice">테스트 결제라 실제로 청구되지 않고, 상품도 배송되지 않아요.</p>
    </div>
    <section class="panel">
      <h2>주문 상품</h2>
      <ul class="summary-items">
        ${order.items
          .map((l) => `<li><div class="summary-thumb">${garmentSVG(l.shape, l.hex, l.name)}</div>
            <div><p>${escapeHtml(l.name)}</p><span>${escapeHtml(l.color)} / ${escapeHtml(l.size)} · ${l.qty}개</span></div>
            <strong>${won(l.lineTotal)}</strong></li>`)
          .join('')}
      </ul>
      <dl class="summary-rows">
        <div><dt>상품 금액</dt><dd>${won(order.subtotal)}</dd></div>
        <div><dt>배송비</dt><dd>${order.shipping ? won(order.shipping) : '무료'}</dd></div>
        <div class="summary-total"><dt>결제 금액</dt><dd>${won(order.amount)}</dd></div>
      </dl>
    </section>
    <section class="panel">
      <h2>결제 · 배송 정보</h2>
      <dl class="spec">
        <div><dt>결제 수단</dt><dd>${escapeHtml(method)}</dd></div>
        <div><dt>승인 시각</dt><dd>${escapeHtml(approved)}</dd></div>
        <div><dt>받는 분</dt><dd>${escapeHtml(c.name)} · ${escapeHtml(c.phone)}</dd></div>
        <div><dt>주소</dt><dd>${escapeHtml(c.address)} ${escapeHtml(c.addressDetail || '')}</dd></div>
        ${c.memo ? `<div><dt>배송 메모</dt><dd>${escapeHtml(c.memo)}</dd></div>` : ''}
      </dl>
      ${pay.receiptUrl ? `<a class="btn btn-block" href="${escapeHtml(pay.receiptUrl)}" target="_blank" rel="noopener">테스트 영수증 보기</a>` : ''}
    </section>
    <a class="btn btn-primary btn-block btn-lg" href="/products.html">쇼핑 계속하기</a>`;
}

function renderError(message) {
  root.innerHTML = `
    <div class="result-head">
      <div class="result-icon fail" aria-hidden="true">!</div>
      <h1>결제를 완료하지 못했어요</h1>
      <p>${escapeHtml(message)}</p>
    </div>
    <a class="btn btn-primary btn-block btn-lg" href="/checkout.html">주문서로 돌아가기</a>
    <a class="btn btn-block" href="/cart.html">장바구니 보기</a>`;
}

(async () => {
  const q = new URLSearchParams(location.search);
  const paymentKey = q.get('paymentKey');
  const orderId = q.get('orderId');
  const amount = q.get('amount');
  if (!paymentKey || !orderId || !amount) return renderError('결제 정보가 없어요.');

  let orderToken = null;
  try {
    orderToken = localStorage.getItem('plainfold_order_' + orderId);
  } catch {
    /* 무시 */
  }
  if (!orderToken) return renderError('주문 정보를 찾을 수 없어요. 주문서에서 다시 결제해 주세요.');

  try {
    // 서버가 주문 토큰의 서명과 금액을 확인한 뒤 토스페이먼츠 승인 API를 호출
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), orderToken }),
    });
    const data = await res.json();
    if (!res.ok) return renderError(data.message || '결제 승인에 실패했어요.');
    clearCart();
    try {
      sessionStorage.removeItem('plainfold_checkout_form');
    } catch {
      /* 무시 */
    }
    // 지난 주문 토큰 정리 (현재 주문 토큰은 새로고침 대비로 남겨 둠)
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('plainfold_order_') && k !== 'plainfold_order_' + orderId)
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* 무시 */
    }
    // 새로고침으로 다시 요청해도 서버는 이미 승인된 결제를 조회해서 그대로 돌려준다
    renderDone(data.order);
  } catch {
    renderError('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
})();
