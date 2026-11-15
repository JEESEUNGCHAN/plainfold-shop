// 검색엔진·AI 검색용 정적 파일 생성
// - 각 HTML에 메타 태그(설명, canonical, Open Graph), 구조화 데이터(JSON-LD) 넣기
// - 상품 목록·상세 내용을 HTML에 미리 그려 넣기 (자바스크립트를 실행하지 않는 크롤러도 내용을 읽도록)
// - 상품별 정적 페이지 public/products/ID.html 생성
// - sitemap.xml, robots.txt, llms.txt 생성
// 실행: node scripts/build-seo.js   (상품 데이터나 페이지를 고친 뒤 다시 실행)
// 사이트 주소를 바꾸려면: SITE_URL=https://example.com node scripts/build-seo.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = (process.env.SITE_URL || 'https://plainfold-shop.vercel.app').replace(/\/$/, '');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const BRAND = 'PLAIN FOLD';
const TODAY = new Date().toISOString().slice(0, 10);
// Google Search Console 소유권 확인 (홈 페이지에만 넣음)
const GOOGLE_VERIFICATION = 'agrP9XEAaQqg9A2zajLbaLHAogfUiEcuqdowlOtBoTU';

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const { products, categories, shipping } = catalog;

/* ---------- 브라우저용 그리기 함수를 그대로 사용 (garment.js, common.js) ---------- */

const elements = {};
const sandbox = {
  window: { addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  document: {
    getElementById: (id) => (elements[id] = elements[id] || { innerHTML: '' }),
    querySelector: () => null,
  },
};
vm.createContext(sandbox);
for (const f of ['js/garment.js', 'js/common.js']) vm.runInContext(fs.readFileSync(path.join(PUB, f), 'utf8'), sandbox, { filename: f });
const { garmentSVG, productCard, escapeHtml, won } = sandbox;

function headerHtml(active) {
  sandbox.renderHeader(active);
  return elements['site-header'].innerHTML;
}
function footerHtml() {
  sandbox.renderFooter();
  return elements['site-footer'].innerHTML;
}

/* ---------- 공통 ---------- */

const catName = (id) => (categories.find((c) => c.id === id) || {}).name || '';
const productUrl = (p) => `${SITE}/products/${p.id}.html`;
const productImage = (p) => `${SITE}/images/products/${p.id}.png`;
const isAvailable = (p) => p.colors.some((c) => p.sizes.some((s) => !p.soldOut.includes(`${c.name}/${s}`)));
const firstColor = (p) => p.colors.find((c) => p.sizes.some((s) => !p.soldOut.includes(`${c.name}/${s}`))) || p.colors[0];
const attr = (s) => escapeHtml(s);
const minPrice = Math.min(...products.map((p) => p.price));
const maxPrice = Math.max(...products.map((p) => p.price));

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: BRAND,
  url: `${SITE}/`,
  logo: `${SITE}/images/logo.png`,
  description: '매일 꺼내 입는 기본 옷을 파는 가상의 의류 브랜드입니다. 토스페이먼츠 테스트 결제로 동작하는 포트폴리오용 쇼핑몰이며 실제 판매·배송은 하지 않습니다.',
};

const FAQ = [
  ['배송비는 얼마인가요?', `상품 금액 합계가 ${won(shipping.freeOver)} 이상이면 무료배송이고, 그 미만이면 배송비 ${won(shipping.fee)}이 붙어요.`],
  ['어떤 사이즈가 있나요?', '상의·하의·아우터는 S, M, L, XL 네 가지 남녀 공용 사이즈이고, 모자·가방·양말·머플러 같은 잡화는 FREE 사이즈예요. 품절은 색상과 사이즈 조합별로 표시돼요.'],
  ['어떤 결제 수단을 쓸 수 있나요?', '토스페이먼츠 결제위젯으로 결제해요. 카드, 계좌이체, 간편결제 등 결제위젯에 나오는 수단을 고를 수 있어요.'],
  ['실제로 돈이 결제되나요?', '아니요. 토스페이먼츠 테스트 키로만 동작해서 결제를 끝까지 진행해도 실제로 청구되지 않아요.'],
  ['실제로 상품을 살 수 있나요?', `${BRAND}는 쇼핑몰 구현을 보여주기 위해 만든 가상의 브랜드라서 상품이 실제로 판매·배송되지 않아요.`],
  ['회원가입을 해야 주문할 수 있나요?', '아니요. 회원가입 없이 받는 분 이름, 휴대폰 번호, 주소만 입력하면 주문할 수 있어요.'],
  ['한 번에 몇 개까지 주문할 수 있나요?', '같은 상품·색상·사이즈 기준으로 한 번에 최대 10개까지 담을 수 있어요.'],
  ['가격대는 어느 정도인가요?', `${won(minPrice)}(양말 3팩)부터 ${won(maxPrice)}(울 블렌드 코트)까지 있어요. 티셔츠는 19,000원~29,000원, 팬츠는 39,000원~65,000원대예요.`],
];

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...obj }).replace(/</g, '\\u003c')}</script>`;
}

function seoHead({ title, description, url, image, type = 'website', noindex = false, extra = '' }) {
  const lines = [];
  if (title) lines.push(`<title>${escapeHtml(title)}</title>`);
  if (noindex) {
    lines.push('<meta name="robots" content="noindex, follow">');
  } else {
    lines.push(
      `<meta name="description" content="${attr(description)}">`,
      `<link rel="canonical" href="${url}">`,
      `<meta property="og:type" content="${type}">`,
      `<meta property="og:site_name" content="${BRAND}">`,
      `<meta property="og:locale" content="ko_KR">`,
      `<meta property="og:title" content="${attr(title)}">`,
      `<meta property="og:description" content="${attr(description)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:image" content="${image}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${attr(title)}">`,
      `<meta name="twitter:description" content="${attr(description)}">`,
      `<meta name="twitter:image" content="${image}">`
    );
  }
  lines.push(
    '<meta name="theme-color" content="#faf9f6">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/images/logo.png">'
  );
  if (extra) lines.push(extra);
  return '\n  ' + lines.join('\n  ') + '\n  ';
}

function fill(html, name, content) {
  const re = new RegExp(`<!--@${name}-->[\\s\\S]*?<!--/@${name}-->`);
  if (!re.test(html)) throw new Error(`마커 없음: ${name}`);
  return html.replace(re, () => `<!--@${name}-->${content}<!--/@${name}-->`);
}

function readPage(f) {
  return fs.readFileSync(path.join(PUB, f), 'utf8');
}
function writePage(f, html) {
  fs.mkdirSync(path.dirname(path.join(PUB, f)), { recursive: true });
  fs.writeFileSync(path.join(PUB, f), html);
}

/* ---------- 홈 ---------- */

function buildHome() {
  const byId = (id) => products.find((p) => p.id === id);
  let html = readPage('index.html');
  const title = `${BRAND} | 매일 꺼내 입는 기본 옷`;
  const description = `티셔츠·맨투맨·니트·슬랙스·데님·코트·패딩까지 기본 의류 ${products.length}종. ${won(shipping.freeOver)} 이상 무료배송. 토스페이먼츠 테스트 결제로 동작하는 가상 브랜드 쇼핑몰입니다.`;
  html = fill(
    html,
    'seo',
    seoHead({
      title,
      description,
      url: `${SITE}/`,
      image: `${SITE}/images/og.png`,
      extra: [
        `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">`,
        jsonLd({
          '@graph': [
            ORG,
            {
              '@type': 'WebSite',
              '@id': `${SITE}/#website`,
              name: BRAND,
              url: `${SITE}/`,
              inLanguage: 'ko-KR',
              publisher: { '@id': `${SITE}/#organization` },
              potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/products.html?q={search_term_string}` },
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@type': 'FAQPage',
              mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
            },
          ],
        }),
      ].join(''),
    })
  );
  html = fill(html, 'header', headerHtml());
  html = fill(html, 'footer', footerHtml());

  const heroItems = [
    [byId('o02'), 1, 'hero-piece back'],
    [byId('t03'), 0, 'hero-piece mid'],
    [byId('b01'), 2, 'hero-piece front'],
  ];
  html = fill(html, 'hero-art', heroItems.map(([p, ci, cls]) => `<div class="${cls}">${garmentSVG(p.shape, p.colors[ci].hex, p.name)}</div>`).join(''));

  const cover = { top: 't04', bottom: 'b02', outer: 'o04', acc: 'a01' };
  html = fill(
    html,
    'category-grid',
    categories
      .map((c) => {
        const p = byId(cover[c.id]);
        const count = products.filter((x) => x.category === c.id).length;
        return `<a class="category-tile" href="/products.html?category=${c.id}"><div class="category-img">${garmentSVG(p.shape, p.colors[0].hex, c.name)}</div><div><strong>${c.name}</strong><span>${count}개 상품</span></div></a>`;
      })
      .join('')
  );
  const newest = products.filter((p) => p.isNew).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const best = products.filter((p) => p.best).slice(0, 4);
  html = fill(html, 'new-grid', newest.map(productCard).join(''));
  html = fill(html, 'best-grid', best.map(productCard).join(''));
  html = fill(html, 'faq', FAQ.map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join(''));
  writePage('index.html', html);
}

/* ---------- 상품 목록 ---------- */

function buildList() {
  let html = readPage('products.html');
  const sorted = [...products].sort((a, b) => b.date.localeCompare(a.date));
  const title = `전체 상품 | ${BRAND}`;
  const description = `${BRAND} 전체 상품 ${products.length}종. ${categories.map((c) => c.name).join('·')} 카테고리, ${won(minPrice)}~${won(maxPrice)}. 신상품순·가격순 정렬과 상품명 검색을 지원합니다.`;
  html = fill(
    html,
    'seo',
    seoHead({
      title,
      description,
      url: `${SITE}/products.html`,
      image: `${SITE}/images/og.png`,
      extra: jsonLd({
        '@type': 'CollectionPage',
        name: '전체 상품',
        url: `${SITE}/products.html`,
        inLanguage: 'ko-KR',
        isPartOf: { '@type': 'WebSite', name: BRAND, url: `${SITE}/` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: sorted.length,
          itemListElement: sorted.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.name })),
        },
      }),
    })
  );
  html = fill(html, 'header', headerHtml('all'));
  html = fill(html, 'footer', footerHtml());
  html = fill(html, 'result-count', `${sorted.length}개 상품`);
  html = fill(html, 'product-grid', sorted.map(productCard).join(''));
  writePage('products.html', html);
}

/* ---------- 상품 상세 (정적 페이지) ---------- */

function productDescription(p) {
  const colors = p.colors.map((c) => c.name).join(', ');
  return `${p.desc} ${p.material}, ${p.fit}. 색상 ${colors}. 사이즈 ${p.sizes.join('·')}. ${won(p.price)}.`;
}

function buildProduct(p) {
  const cat = catName(p.category);
  const url = productUrl(p);
  const color = firstColor(p);
  const shipRate = p.price >= shipping.freeOver ? 0 : shipping.fee;
  const title = `${p.name} ${won(p.price)} | ${BRAND}`;
  const description = productDescription(p);

  const ld = jsonLd({
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: p.name,
        description: `${p.desc} 소재 ${p.material}, ${p.fit}.`,
        sku: p.id,
        image: [productImage(p)],
        url,
        category: cat,
        brand: { '@type': 'Brand', name: BRAND },
        material: p.material,
        color: p.colors.map((c) => c.name).join(', '),
        size: p.sizes.join(', '),
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: 'KRW',
          price: p.price,
          itemCondition: 'https://schema.org/NewCondition',
          availability: isAvailable(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: { '@id': `${SITE}/#organization` },
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: shipRate, currency: 'KRW' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'KR' },
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: cat, item: `${SITE}/products.html?category=${p.category}` },
          { '@type': 'ListItem', position: 3, name: p.name, item: url },
        ],
      },
      ORG,
    ],
  });

  const related = products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  const colorList = p.colors
    .map((c) => {
      const out = p.sizes.filter((s) => p.soldOut.includes(`${c.name}/${s}`));
      return `<li><span class="swatch" style="--sw:${c.hex}" aria-hidden="true"></span>${escapeHtml(c.name)}${out.length ? ` <small>(${out.join(', ')} 품절)</small>` : ''}</li>`;
    })
    .join('');

  // product.js가 실행되면 아래 내용을 옵션 선택이 되는 화면으로 다시 그린다
  const detail = `
    <nav class="breadcrumb"><a href="/">홈</a> / <a href="/products.html?category=${p.category}">${cat}</a> / <span>${escapeHtml(p.name)}</span></nav>
    <div class="detail">
      <div class="detail-img" id="detail-img">${garmentSVG(p.shape, color.hex, `${p.name} ${color.name}`)}</div>
      <div class="detail-info">
        <p class="eyebrow">${cat}${p.isNew ? ' · NEW' : ''}</p>
        <h1>${escapeHtml(p.name)}</h1>
        <p class="detail-price">${won(p.price)}</p>
        <p class="detail-desc">${escapeHtml(p.desc)}</p>
        <div class="option"><p class="option-label">색상</p><ul class="static-list">${colorList}</ul></div>
        <div class="option"><p class="option-label">사이즈</p><p>${p.sizes.join(' · ')}</p></div>
        <dl class="spec">
          <div><dt>소재</dt><dd>${escapeHtml(p.material)}</dd></div>
          <div><dt>핏 · 크기</dt><dd>${escapeHtml(p.fit)}</dd></div>
          <div><dt>배송</dt><dd>${won(shipping.freeOver)} 이상 무료, 미만 ${won(shipping.fee)}</dd></div>
        </dl>
      </div>
    </div>
    <section class="section">
      <div class="section-head"><h2>같은 카테고리 상품</h2></div>
      <div class="grid" id="related">${related.map(productCard).join('')}</div>
    </section>
  `;

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- 이 파일은 scripts/build-seo.js가 만듭니다. 직접 고치지 말고 data/products.json을 고친 뒤 다시 실행하세요. -->
  <!--@seo-->${seoHead({ title, description, url, image: productImage(p), type: 'product', extra: ld })}<!--/@seo-->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body data-product-id="${p.id}">
  <header id="site-header" class="site-header">${headerHtml(p.category)}</header>
  <main class="container" id="detail">${detail}</main>
  <footer id="site-footer" class="site-footer">${footerHtml()}</footer>
  <script src="/js/garment.js"></script>
  <script src="/js/common.js"></script>
  <script src="/js/product.js"></script>
</body>
</html>
`;
  writePage(`products/${p.id}.html`, html);
}

/* ---------- 검색 제외 페이지 ---------- */

function buildNoindex() {
  for (const f of ['cart.html', 'checkout.html', 'success.html', 'fail.html', '404.html', 'product.html']) {
    let html = readPage(f);
    html = fill(html, 'seo', seoHead({ noindex: true }));
    if (html.includes('<!--@header-->')) html = fill(html, 'header', headerHtml());
    if (html.includes('<!--@footer-->')) html = fill(html, 'footer', footerHtml());
    writePage(f, html);
  }
}

/* ---------- sitemap.xml, robots.txt, llms.txt ---------- */

function buildSitemap() {
  const urls = [
    { loc: `${SITE}/`, lastmod: TODAY, image: `${SITE}/images/og.png` },
    { loc: `${SITE}/products.html`, lastmod: TODAY },
    ...products.map((p) => ({ loc: productUrl(p), lastmod: TODAY, image: productImage(p) })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>${u.image ? `\n    <image:image><image:loc>${u.image}</image:loc></image:image>` : ''}\n  </url>`)
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(PUB, 'sitemap.xml'), xml);
}

function buildRobots() {
  // 검색엔진과 AI 검색 크롤러 모두 허용. API만 막는다
  const aiBots = ['Googlebot', 'Bingbot', 'Yeti', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'PerplexityBot', 'Perplexity-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Google-Extended', 'Applebot-Extended'];
  const txt = `# ${BRAND}
User-agent: *
Allow: /
Disallow: /api/

${aiBots.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`;
  fs.writeFileSync(path.join(PUB, 'robots.txt'), txt);
}

function buildLlms() {
  const lines = [
    `# ${BRAND}`,
    '',
    `> ${ORG.description}`,
    '',
    `- 사이트: ${SITE}/`,
    `- 상품 수: ${products.length}종 (${categories.map((c) => `${c.name} ${products.filter((p) => p.category === c.id).length}`).join(', ')})`,
    `- 가격대: ${won(minPrice)} ~ ${won(maxPrice)}`,
    `- 배송비: ${won(shipping.freeOver)} 이상 무료, 미만 ${won(shipping.fee)}`,
    '- 결제: 토스페이먼츠 결제위젯 (테스트 모드, 실제 청구 없음)',
    '- 주문: 회원가입 없이 비회원 주문',
    '',
    '## 주요 페이지',
    '',
    `- [홈](${SITE}/): 신상품·베스트 상품과 자주 묻는 질문`,
    `- [전체 상품](${SITE}/products.html): 카테고리별 목록, 신상품순·가격순 정렬, 상품명 검색`,
    '',
  ];
  for (const c of categories) {
    lines.push(`## ${c.name}`, '');
    for (const p of products.filter((x) => x.category === c.id)) {
      lines.push(`- [${p.name}](${productUrl(p)}): ${won(p.price)}. ${p.desc} 소재 ${p.material}, ${p.fit}. 색상 ${p.colors.map((x) => x.name).join(', ')}. 사이즈 ${p.sizes.join('·')}.`);
    }
    lines.push('');
  }
  lines.push('## 자주 묻는 질문', '');
  for (const [q, a] of FAQ) lines.push(`- **${q}** ${a}`);
  lines.push('');
  fs.writeFileSync(path.join(PUB, 'llms.txt'), lines.join('\n'));
}

/* ---------- 실행 ---------- */

buildHome();
buildList();
fs.rmSync(path.join(PUB, 'products'), { recursive: true, force: true });
products.forEach(buildProduct);
buildNoindex();
buildSitemap();
buildRobots();
buildLlms();
console.log(`완료: ${SITE} 기준, 상품 페이지 ${products.length}개, sitemap URL ${products.length + 2}개`);
