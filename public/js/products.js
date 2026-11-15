const params = new URLSearchParams(location.search);
const state = {
  category: params.get('category') || 'all',
  q: params.get('q') || '',
  sort: ['new', 'low', 'high'].includes(params.get('sort')) ? params.get('sort') : 'new',
};

renderHeader(state.category);
renderFooter();

const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');
searchEl.value = state.q;
sortEl.value = state.sort;

function syncUrl() {
  const p = new URLSearchParams();
  if (state.category !== 'all') p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  if (state.sort !== 'new') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function render(catalog) {
  const chips = [{ id: 'all', name: '전체' }, ...catalog.categories];
  document.getElementById('chips').innerHTML = chips
    .map((c) => `<button type="button" role="tab" class="chip${state.category === c.id ? ' is-active' : ''}" aria-selected="${state.category === c.id}" data-cat="${c.id}">${c.name}</button>`)
    .join('');

  const title = state.category === 'all' ? '전체 상품' : categoryName(catalog, state.category);
  document.getElementById('list-title').textContent = title;
  document.title = `${title} | PLAIN FOLD`;

  const q = state.q.trim().replace(/\s+/g, '').toLowerCase();
  let list = catalog.products.filter(
    (p) => (state.category === 'all' || p.category === state.category) && (!q || p.name.replace(/\s+/g, '').toLowerCase().includes(q))
  );
  if (state.sort === 'new') list.sort((a, b) => b.date.localeCompare(a.date));
  if (state.sort === 'low') list.sort((a, b) => a.price - b.price);
  if (state.sort === 'high') list.sort((a, b) => b.price - a.price);

  document.getElementById('result-count').textContent = `${list.length}개 상품` + (state.q ? ` · '${state.q}' 검색 결과` : '');
  document.getElementById('product-grid').innerHTML = list.length
    ? list.map(productCard).join('')
    : '<div class="empty grid-empty"><p>조건에 맞는 상품이 없어요.</p></div>';

  // 헤더 메뉴 강조도 같이 갱신
  document.querySelectorAll('.nav-link').forEach((a) => {
    const cat = new URL(a.href).searchParams.get('category') || 'all';
    a.classList.toggle('is-active', cat === state.category);
  });
  syncUrl();
}

(async () => {
  try {
    const catalog = await loadCatalog();
    if (state.category !== 'all' && !catalog.categories.some((c) => c.id === state.category)) state.category = 'all';
    render(catalog);

    document.getElementById('chips').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      state.category = btn.dataset.cat;
      render(catalog);
    });
    let timer;
    searchEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = searchEl.value;
        render(catalog);
      }, 150);
    });
    sortEl.addEventListener('change', () => {
      state.sort = sortEl.value;
      render(catalog);
    });
  } catch (e) {
    showPageError(document.querySelector('main'), e.message);
  }
})();
