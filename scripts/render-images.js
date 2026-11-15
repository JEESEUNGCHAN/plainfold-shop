// 검색·공유용 PNG 이미지 생성 (상품 이미지, 로고, 공유 이미지)
// 필요: 로컬 서버 실행 중(node server.js), Google Chrome, puppeteer-core
// 실행: node scripts/render-images.js   (상품 데이터를 바꿨을 때만 다시 실행)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', 'public', 'images');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

(async () => {
  fs.mkdirSync(path.join(OUT, 'products'), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${BASE}/404.html`, { waitUntil: 'networkidle0' });
  const catalog = await (await fetch(`${BASE}/api/catalog`)).json();

  // 상품 이미지 1200x1200
  await page.setViewport({ width: 1200, height: 1200 });
  for (const p of catalog.products) {
    const c = p.colors.find((col) => p.sizes.some((s) => !p.soldOut.includes(`${col.name}/${s}`))) || p.colors[0];
    await page.evaluate((shape, hex, name) => {
      document.body.innerHTML = `<div style="position:fixed;inset:0;background:#efede8;display:grid;place-items:center"><div style="width:84%;height:84%">${garmentSVG(shape, hex, name)}</div></div>`;
      const svg = document.querySelector('svg');
      svg.style.width = '100%';
      svg.style.height = '100%';
    }, p.shape, c.hex, p.name);
    await page.screenshot({ path: path.join(OUT, 'products', `${p.id}.png`) });
  }

  // 로고 512x512
  await page.setViewport({ width: 512, height: 512 });
  const favicon = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), 'utf8');
  await page.evaluate((svg) => {
    document.body.innerHTML = `<div style="position:fixed;inset:0">${svg}</div>`;
    const el = document.querySelector('svg');
    el.style.width = '512px';
    el.style.height = '512px';
  }, favicon);
  await page.screenshot({ path: path.join(OUT, 'logo.png'), omitBackground: true });

  // 공유 이미지 1200x630: 홈 첫 화면
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.querySelector('.test-banner')?.remove();
    document.querySelector('.header-actions')?.remove();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: path.join(OUT, 'og.png') });

  await browser.close();
  console.log(`완료: 상품 ${catalog.products.length}개, logo.png, og.png`);
})();
