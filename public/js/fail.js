renderHeader();
renderFooter();

(() => {
  const q = new URLSearchParams(location.search);
  const code = q.get('code') || '';
  const message = q.get('message') || '결제가 취소되었거나 실패했어요.';
  const cancelled = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL';
  document.getElementById('result').innerHTML = `
    <div class="result-head">
      <div class="result-icon fail" aria-hidden="true">!</div>
      <h1>${cancelled ? '결제를 취소했어요' : '결제에 실패했어요'}</h1>
      <p>${escapeHtml(message)}</p>
      ${code ? `<p class="hint">오류 코드: ${escapeHtml(code)}</p>` : ''}
      <p class="hint">장바구니와 입력한 배송 정보는 그대로 남아 있어요.</p>
    </div>
    <a class="btn btn-primary btn-block btn-lg" href="/checkout.html">다시 결제하기</a>
    <a class="btn btn-block" href="/cart.html">장바구니 보기</a>`;
})();
