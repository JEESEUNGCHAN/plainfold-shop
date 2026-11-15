renderHeader();
renderFooter();

(async () => {
  try {
    const catalog = await loadCatalog();
    const byId = (id) => catalog.products.find((p) => p.id === id);

    // 히어로: 대표 상품 세 벌을 겹쳐 배치
    const heroItems = [
      [byId('o02'), 1, 'hero-piece back'],
      [byId('t03'), 0, 'hero-piece mid'],
      [byId('b01'), 2, 'hero-piece front'],
    ];
    document.getElementById('hero-art').innerHTML = heroItems
      .map(([p, ci, cls]) => `<div class="${cls}">${garmentSVG(p.shape, p.colors[ci].hex, p.name)}</div>`)
      .join('');

    // 카테고리 타일: 카테고리마다 대표 상품 그림 하나
    const cover = { top: 't04', bottom: 'b02', outer: 'o04', acc: 'a01' };
    document.getElementById('category-grid').innerHTML = catalog.categories
      .map((c) => {
        const p = byId(cover[c.id]);
        const count = catalog.products.filter((x) => x.category === c.id).length;
        return `<a class="category-tile" href="/products.html?category=${c.id}">
          <div class="category-img">${garmentSVG(p.shape, p.colors[0].hex, c.name)}</div>
          <div><strong>${c.name}</strong><span>${count}개 상품</span></div></a>`;
      })
      .join('');

    const newest = catalog.products.filter((p) => p.isNew).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const best = catalog.products.filter((p) => p.best).slice(0, 4);
    document.getElementById('new-grid').innerHTML = newest.map(productCard).join('');
    document.getElementById('best-grid').innerHTML = best.map(productCard).join('');
  } catch (e) {
    showPageError(document.querySelector('main'), e.message);
  }
})();
