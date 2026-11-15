// 상품 이미지: 상품 종류(shape)와 색상으로 SVG 일러스트를 그린다.
// 색상 옵션을 바꾸면 같은 그림이 그 색으로 다시 그려진다.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function mixColor(hex, target, t) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const GARMENT = (() => {
  // 공통 몸판
  const LONG = 'M80 50 L100 40 Q120 54 140 40 L160 50 Q184 60 190 100 L204 226 L182 230 L166 118 L164 238 L76 238 L74 118 L58 230 L36 226 L50 100 Q56 60 80 50 Z';
  const CUFFS = 'M184 216 L202 212 M56 216 L38 212';
  const HEM = 'M76 226 L164 226';
  const CREW = 'M100 40 Q120 62 140 40';
  const PANTS_BAND = 'M76 34 L164 34 L164 52 L76 52 Z';

  const body = (d) => `<path class="g-body" d="${d}"/>`;
  const line = (d, extra = '') => `<path class="g-line" d="${d}" ${extra}/>`;
  const button = (x, y) => `<circle class="g-dot" cx="${x}" cy="${y}" r="3"/>`;
  const range = (from, to, step) => {
    const out = [];
    for (let v = from; v <= to; v += step) out.push(v);
    return out;
  };

  const hood = () =>
    body('M96 44 Q94 16 120 14 Q146 16 144 44 Q132 66 120 70 Q108 66 96 44 Z') +
    '<path class="g-shadow" d="M104 46 Q104 26 120 24 Q136 26 136 46 Q128 60 120 62 Q112 60 104 46 Z"/>';

  const shirtCollar = () =>
    body('M100 40 L90 60 L116 68 Z') + body('M140 40 L150 60 L124 68 Z') + line('M100 40 L120 64 L140 40');

  return {
    tee: () =>
      body('M80 52 L100 42 Q120 56 140 42 L160 52 L200 88 L180 112 L162 98 L162 236 L78 236 L78 98 L60 112 L40 88 Z') +
      line('M100 42 Q120 64 140 42') + line('M104 45 Q120 60 136 45') + line('M78 228 L162 228'),

    longsleeve: () => body(LONG) + line(CREW) + line('M104 43 Q120 58 136 43'),

    sweat: () => body(LONG) + line(CREW) + line('M104 43 Q120 58 136 43') + line(CUFFS) + line(HEM),

    knit: () =>
      body(LONG) + line(CREW) + line('M104 43 Q120 58 136 43') + line(CUFFS) + line(HEM) +
      range(84, 156, 8).map((x) => line(`M${x} 228 L${x} 236`)).join('') +
      range(70, 210, 14).map((y) => line(`M90 ${y} q4 4 8 0 M142 ${y} q4 4 8 0`, 'opacity=".5"')).join(''),

    hoodie: () =>
      body(LONG) + line(CUFFS) + line(HEM) + hood() +
      line('M112 64 L110 100 M128 64 L130 100') +
      line('M92 168 L148 168 L158 214 L82 214 Z'),

    shirt: () =>
      body(LONG) + shirtCollar() + line('M120 64 L120 238') +
      [86, 116, 146, 176, 206].map((y) => button(124, y)).join('') +
      line('M134 92 L154 92 L154 114 L134 114 Z') + line(CUFFS),

    jacket: () =>
      body(LONG) + body('M98 38 L84 64 L114 72 L120 60 L126 72 L156 64 L142 38 Q120 48 98 38 Z') +
      line('M120 66 L120 238') + [96, 132, 168, 204].map((y) => button(124, y)).join('') +
      line('M84 100 L108 100 L108 128 L84 128 Z M84 108 L108 108') +
      line('M132 100 L156 100 L156 128 L132 128 Z M132 108 L156 108') + line(HEM) + line(CUFFS),

    denimjacket: () =>
      body(LONG) + shirtCollar() + line('M120 64 L120 238') +
      [90, 124, 160, 196].map((y) => button(124, y)).join('') +
      line('M78 86 Q120 96 162 86', 'stroke-dasharray="4 3"') +
      line('M86 98 L108 98 L108 112 L97 118 L86 112 Z') + line('M132 98 L154 98 L154 112 L143 118 L132 112 Z') +
      line('M96 120 L94 222 M144 120 L146 222', 'stroke-dasharray="4 3"') + line('M76 222 L164 222') + line(CUFFS),

    coat: () =>
      body('M80 50 L100 40 Q120 54 140 40 L160 50 Q184 60 190 100 L206 250 L184 254 L168 120 L170 272 L70 272 L72 120 L56 254 L34 250 L50 100 Q56 60 80 50 Z') +
      body('M100 40 L88 66 L98 72 L118 124 L114 58 Z') + body('M140 40 L152 66 L142 72 L122 124 L126 58 Z') +
      line('M120 124 L120 272') + [150, 190, 230].map((y) => button(126, y)).join('') +
      line('M80 198 L104 194 M136 194 L160 198') + line('M188 236 L206 232 M52 236 L34 232'),

    cardigan: () =>
      body(LONG) + line('M100 40 L120 108 L140 40') + line('M106 42 L120 96 L134 42') +
      line('M120 108 L120 238') + [122, 146, 170, 194, 216].map((y) => button(125, y)).join('') +
      line(HEM) + line(CUFFS),

    padding: () =>
      body(LONG) + body('M98 30 Q120 24 142 30 L142 50 Q120 44 98 50 Z') +
      range(78, 210, 26).map((y) => line(`M76 ${y} L164 ${y}`)).join('') +
      line('M48 120 L70 116 M44 160 L68 156 M40 196 L62 192 M192 120 L170 116 M196 160 L172 156 M200 196 L178 192') +
      line('M120 48 L120 238', 'stroke-width="3"') + '<rect class="g-dot" x="116" y="54" width="8" height="14" rx="2"/>' +
      line(CUFFS),

    windbreaker: () =>
      body(LONG) + hood() + line('M120 66 L120 238', 'stroke-width="3"') +
      '<rect class="g-dot" x="116" y="72" width="8" height="14" rx="2"/>' +
      line('M136 104 L160 96') + line(CUFFS) + line('M76 228 L164 228') +
      '<circle class="g-dot" cx="84" cy="234" r="4"/><circle class="g-dot" cx="156" cy="234" r="4"/>',

    pants: () =>
      body('M76 52 L164 52 L170 258 L130 258 L120 108 L110 258 L70 258 Z') + body(PANTS_BAND) +
      line('M120 52 Q122 88 116 100') + line('M78 54 L96 84 M162 54 L144 84') +
      line('M96 116 L90 250 M144 116 L150 250', 'opacity=".5"') +
      '<circle class="g-dot" cx="120" cy="43" r="3"/>',

    wide: () =>
      body('M76 52 L164 52 L184 258 L126 258 L120 110 L114 258 L56 258 Z') + body(PANTS_BAND) +
      line('M120 52 Q122 88 116 100') + line('M78 54 L94 84 M162 54 L146 84') +
      line('M102 52 L104 82 M138 52 L136 82') +
      line('M96 116 L86 250 M144 116 L154 250', 'opacity=".5"') +
      '<circle class="g-dot" cx="120" cy="43" r="3"/>',

    jeans: () =>
      body('M76 52 L164 52 L170 258 L130 258 L120 108 L110 258 L70 258 Z') + body(PANTS_BAND) +
      line('M120 52 Q122 92 114 102', 'stroke-dasharray="4 3"') +
      line('M78 58 Q96 64 100 52 M162 58 Q144 64 140 52', 'stroke-dasharray="4 3"') +
      line('M146 56 L156 56 L156 66 L146 66', 'stroke-dasharray="3 3"') +
      line('M70 246 L110 246 M130 246 L170 246', 'stroke-dasharray="4 3"') +
      '<circle class="g-dot" cx="120" cy="43" r="3.5"/>',

    jogger: () =>
      body('M76 52 L164 52 L158 238 L132 238 L120 108 L108 238 L82 238 Z') + body(PANTS_BAND) +
      body('M82 238 L108 238 L108 258 L84 258 Z') + body('M132 238 L158 238 L156 258 L132 258 Z') +
      range(82, 158, 8).map((x) => line(`M${x} 38 L${x} 48`, 'opacity=".5"')).join('') +
      line('M114 52 L110 76 M126 52 L130 76') + line('M78 54 L94 84 M162 54 L146 84'),

    cargo: () =>
      body('M76 52 L164 52 L176 258 L130 258 L120 108 L110 258 L64 258 Z') + body(PANTS_BAND) +
      body('M70 140 L96 140 L98 186 L72 186 Z') + line('M70 152 L96 152') +
      body('M144 140 L170 140 L168 186 L142 186 Z') + line('M144 152 L170 152') +
      line('M120 52 Q122 88 116 100') + line('M64 244 L110 244 M130 244 L176 244'),

    shorts: () =>
      '<g transform="translate(0 40)">' +
      body('M76 52 L164 52 L178 162 L128 162 L120 112 L112 162 L62 162 Z') + body(PANTS_BAND) +
      line('M120 52 Q122 92 114 102', 'stroke-dasharray="4 3"') +
      line('M78 58 Q96 64 100 52 M162 58 Q144 64 140 52', 'stroke-dasharray="4 3"') +
      line('M64 150 L112 150 M128 150 L176 150') + '<circle class="g-dot" cx="120" cy="43" r="3.5"/></g>',

    cap: () =>
      body('M58 170 Q58 86 120 82 Q182 86 182 170 Z') +
      line('M120 82 L120 170 M120 82 Q90 104 88 170 M120 82 Q150 104 152 170') +
      '<circle class="g-dot" cx="120" cy="83" r="6"/>' +
      body('M54 168 Q120 154 186 168 L206 204 Q120 180 34 204 Z') + line('M62 176 Q120 164 178 176', 'opacity=".5"'),

    beanie: () =>
      body('M66 176 Q64 72 120 68 Q176 72 174 176 Z') +
      range(86, 156, 14).map((x) => line(`M${x} 90 Q${x - 2} 130 ${x} 168`, 'opacity=".45"')).join('') +
      body('M58 166 L182 166 L184 214 L56 214 Z') +
      range(66, 176, 10).map((x) => line(`M${x} 170 L${x} 210`, 'opacity=".55"')).join(''),

    tote: () =>
      `<path d="M86 104 Q86 36 120 36 Q154 36 154 104" fill="none" stroke="var(--g-line)" stroke-width="14" stroke-linecap="round"/>` +
      `<path d="M86 104 Q86 36 120 36 Q154 36 154 104" fill="none" stroke="var(--g-fill)" stroke-width="9" stroke-linecap="round"/>` +
      body('M54 100 L186 100 L194 252 L46 252 Z') + line('M56 116 L184 116', 'opacity=".5"') +
      line('M96 150 L144 150 L144 196 L96 196 Z', 'opacity=".6"'),

    socks: () => {
      const sock = 'M86 38 L124 38 L124 168 Q124 196 152 202 L178 208 Q198 214 194 236 Q188 256 166 252 L114 242 Q82 234 84 200 Z';
      return (
        `<g transform="translate(-26 12)" opacity=".85">${body(sock)}</g>` +
        body(sock) + range(42, 64, 7).map((y) => line(`M86 ${y} L124 ${y}`, 'opacity=".55"')).join('') +
        line('M84 196 Q100 214 124 210', 'opacity=".6"') + line('M176 208 Q170 230 182 252', 'opacity=".6"')
      );
    },

    scarf: () =>
      body('M64 52 Q120 86 176 52 L182 74 Q120 110 58 74 Z') +
      body('M78 74 L106 84 L100 244 L70 240 Z') + body('M128 88 L158 78 L156 228 L126 230 Z') +
      range(72, 98, 5).map((x) => line(`M${x} 242 L${x - 1} 256`)).join('') +
      range(128, 154, 5).map((x) => line(`M${x} 230 L${x + 1} 244`)).join('') +
      line('M80 110 L102 116 M130 112 L156 106', 'opacity=".45"'),

    crossbag: () =>
      `<path d="M66 132 Q60 26 120 26 Q180 26 174 132" fill="none" stroke="var(--g-line)" stroke-width="10"/>` +
      `<path d="M66 132 Q60 26 120 26 Q180 26 174 132" fill="none" stroke="var(--g-fill)" stroke-width="6"/>` +
      '<rect class="g-body" x="46" y="122" width="148" height="104" rx="24"/>' +
      line('M60 146 L180 146') + '<rect class="g-dot" x="160" y="140" width="6" height="18" rx="2"/>' +
      line('M104 176 L136 176 L136 196 L104 196 Z', 'opacity=".6"'),
  };
})();

function garmentSVG(shape, hex, label) {
  const draw = GARMENT[shape] || GARMENT.tee;
  const dark = luminance(hex) < 0.22;
  const lineColor = dark ? mixColor(hex, '#ffffff', 0.32) : mixColor(hex, '#000000', 0.28);
  const shadow = dark ? mixColor(hex, '#000000', 0.45) : mixColor(hex, '#000000', 0.18);
  return (
    `<svg viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label || ''}" ` +
    `class="garment" style="--g-fill:${hex};--g-line:${lineColor};--g-shadow:${shadow}">` +
    draw() +
    '</svg>'
  );
}
