renderHeader();
renderFooter();

const FORM_KEY = 'plainfold_checkout_form';
const form = document.getElementById('order-form');
const summaryEl = document.getElementById('summary');
const widgetError = document.getElementById('widget-error');

function formatPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length < 11) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function readForm() {
  const f = new FormData(form);
  return {
    name: (f.get('name') || '').trim(),
    phone: (f.get('phone') || '').trim(),
    address: (f.get('address') || '').trim(),
    addressDetail: (f.get('addressDetail') || '').trim(),
    memo: f.get('memo') || '',
  };
}

function validate(c) {
  const errors = {};
  if (!c.name) errors.name = '받는 분 이름을 입력해 주세요.';
  if (!/^01[016789]\d{7,8}$/.test(c.phone.replace(/-/g, ''))) errors.phone = '휴대폰 번호를 정확히 입력해 주세요.';
  if (c.address.length < 2) errors.address = '주소를 입력해 주세요.';
  form.querySelectorAll('[data-error-for]').forEach((el) => {
    el.textContent = errors[el.dataset.errorFor] || '';
    const input = form.elements[el.dataset.errorFor];
    if (input) input.setAttribute('aria-invalid', errors[el.dataset.errorFor] ? 'true' : 'false');
  });
  return errors;
}

// 결제창에 다녀와도 입력한 배송 정보가 남도록 세션에 보관
function restoreForm() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(FORM_KEY));
    if (saved) Object.entries(saved).forEach(([k, v]) => form.elements[k] && (form.elements[k].value = v));
  } catch {
    /* 무시 */
  }
}
function persistForm() {
  try {
    sessionStorage.setItem(FORM_KEY, JSON.stringify(readForm()));
  } catch {
    /* 무시 */
  }
}

(async () => {
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (e) {
    return showPageError(document.getElementById('checkout'), e.message);
  }

  const lines = resolveCart(catalog).filter((l) => !l.invalid);
  if (lines.length === 0) {
    location.replace('/cart.html');
    return;
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const ship = shippingFee(catalog, subtotal);
  const total = subtotal + ship;

  summaryEl.innerHTML = `
    <h2>주문 상품 ${lines.length}건</h2>
    <ul class="summary-items">
      ${lines
        .map(
          (l) => `<li>
          <div class="summary-thumb">${garmentSVG(l.product.shape, l.hex, l.product.name)}</div>
          <div><p>${escapeHtml(l.product.name)}</p><span>${escapeHtml(l.color)} / ${escapeHtml(l.size)} · ${l.qty}개</span></div>
          <strong>${won(l.lineTotal)}</strong></li>`
        )
        .join('')}
    </ul>
    <dl class="summary-rows">
      <div><dt>상품 금액</dt><dd>${won(subtotal)}</dd></div>
      <div><dt>배송비</dt><dd>${ship ? won(ship) : '무료'}</dd></div>
      <div class="summary-total"><dt>최종 결제 금액</dt><dd>${won(total)}</dd></div>
    </dl>
    <button type="button" class="btn btn-primary btn-block btn-lg" id="pay" disabled>결제 수단 불러오는 중…</button>
    <p class="hint">테스트 결제라 실제로 청구되지 않아요.</p>`;

  restoreForm();
  form.elements.phone.addEventListener('input', (e) => (e.target.value = formatPhone(e.target.value)));
  form.addEventListener('input', persistForm);
  form.addEventListener('change', persistForm);

  const payBtn = document.getElementById('pay');

  // 토스페이먼츠 결제위젯 준비
  let widgets;
  try {
    if (typeof TossPayments !== 'function') throw new Error('결제 모듈을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
    const config = await fetch('/api/config').then((r) => r.json());
    const tossPayments = TossPayments(config.clientKey);
    widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });
    await widgets.setAmount({ currency: 'KRW', value: total });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
      widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
    ]);
    payBtn.disabled = false;
    payBtn.textContent = `${won(total)} 결제하기`;
  } catch (e) {
    widgetError.textContent = e.message || '결제 수단을 불러오지 못했어요.';
    payBtn.textContent = '결제할 수 없어요';
    return;
  }

  payBtn.addEventListener('click', async () => {
    const customer = readForm();
    const errors = validate(customer);
    if (Object.keys(errors).length) {
      form.elements[Object.keys(errors)[0]].focus();
      return;
    }
    persistForm();
    payBtn.disabled = true;
    payBtn.textContent = '주문 만드는 중…';
    widgetError.textContent = '';

    try {
      // 1) 서버에 주문 생성 → 서버가 상품 데이터로 금액을 다시 계산
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines.map(({ id, color, size, qty }) => ({ id, color, size, qty })), customer }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.message || '주문을 만들지 못했어요.');
      if (order.amount !== total) await widgets.setAmount({ currency: 'KRW', value: order.amount });

      // 2) 결제 요청 → 성공 시 success.html, 실패 시 fail.html 로 이동
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        customerName: order.customerName,
        customerMobilePhone: order.customerMobilePhone,
        successUrl: `${location.origin}/success.html`,
        failUrl: `${location.origin}/fail.html`,
      });
    } catch (e) {
      // 결제창을 닫은 경우(USER_CANCEL)는 조용히 되돌림
      if (e && e.code !== 'USER_CANCEL') widgetError.textContent = e.message || '결제를 시작하지 못했어요.';
      payBtn.disabled = false;
      payBtn.textContent = `${won(total)} 결제하기`;
    }
  });
})();
