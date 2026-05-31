const sharp = require('sharp');

const THEMES = {
  gold: {
    bg1: '#0a0800', bg2: '#1a1400',
    accent: '#c9a02a', accentDim: 'rgba(201,160,42,0.15)',
    text: '#f5e6c8', textDim: '#7a6a4a',
  },
  blue: {
    bg1: '#04080f', bg2: '#091525',
    accent: '#3d8bff', accentDim: 'rgba(61,139,255,0.15)',
    text: '#d0e8ff', textDim: '#4a5a7a',
  },
  purple: {
    bg1: '#070512', bg2: '#100820',
    accent: '#8b5cf6', accentDim: 'rgba(139,92,246,0.15)',
    text: '#e8d8ff', textDim: '#5a4a7a',
  },
};

const THEME_KEYS = ['gold', 'blue', 'purple'];

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}


function cornerDeco(accent, h) {
  return `
    <rect x="40" y="40" width="80" height="4" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="40" y="40" width="4" height="80" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="960" y="40" width="80" height="4" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="1036" y="40" width="4" height="80" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="40" y="${h - 44}" width="80" height="4" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="40" y="${h - 120}" width="4" height="80" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="960" y="${h - 44}" width="80" height="4" fill="${accent}" opacity="0.8" rx="2"/>
    <rect x="1036" y="${h - 120}" width="4" height="80" fill="${accent}" opacity="0.8" rx="2"/>
  `;
}

function buildQuoteSVG(quote, theme) {
  const t = THEMES[theme] || THEMES.gold;
  const lines = wrapText(quote.text, 30);
  const lineH = 58;
  const textY = 500;
  const h = Math.max(1080, textY + lines.length * lineH + 200);

  const textRows = lines.map((l, i) =>
    `<text x="540" y="${textY + i * lineH}" text-anchor="middle" direction="rtl"
       font-family="Vazirmatn,Arial" font-size="40" fill="${t.text}">${escapeXml(l)}</text>`
  ).join('\n  ');

  const divY = textY + lines.length * lineH + 36;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.bg1}"/>
      <stop offset="100%" stop-color="${t.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="${h}" fill="url(#bg)"/>
  ${cornerDeco(t.accent, h)}
  <text x="540" y="400" text-anchor="middle" font-size="260" fill="${t.accent}" opacity="0.06" font-family="Georgia,serif">&#x201C;</text>
  <text x="540" y="350" text-anchor="middle" font-size="90" fill="${t.accent}" opacity="0.55" font-family="Georgia,serif">&#x201C;</text>
  ${textRows}
  <rect x="390" y="${divY}" width="300" height="2" fill="${t.accent}" opacity="0.35" rx="1"/>
  <text x="540" y="${divY + 52}" text-anchor="middle" direction="rtl"
     font-family="Vazirmatn,Arial" font-size="34" font-weight="700" fill="${t.accent}">&#x2014; ${escapeXml(quote.author)}</text>
  <text x="540" y="${h - 50}" text-anchor="middle"
     font-family="Vazirmatn,Arial" font-size="24" fill="${t.textDim}" opacity="0.6">@VeriaApp</text>
  <rect x="0" y="${h - 6}" width="1080" height="6" fill="${t.accent}" opacity="0.5"/>
</svg>`;
}

function buildTweetSVG(tweet, theme) {
  const t = THEMES[theme] || THEMES.blue;
  const lines = wrapText(tweet.text, 32);
  const lineH = 54;
  const textY = 390;
  const h = Math.max(700, textY + lines.length * lineH + 180);

  const textRows = lines.map((l, i) =>
    `<text x="540" y="${textY + i * lineH}" text-anchor="middle" direction="rtl"
       font-family="Vazirmatn,Arial" font-size="38" fill="${t.text}">${escapeXml(l)}</text>`
  ).join('\n  ');

  const divY = textY + lines.length * lineH + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.bg1}"/>
      <stop offset="100%" stop-color="${t.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="${h}" fill="url(#bg)"/>
  ${cornerDeco(t.accent, h)}
  <circle cx="540" cy="150" r="65" fill="${t.accentDim}" stroke="${t.accent}" stroke-width="2"/>
  <text x="540" y="170" text-anchor="middle" font-size="56" fill="${t.accent}">&#x2756;</text>
  <text x="540" y="278" text-anchor="middle" direction="ltr"
     font-family="Vazirmatn,Arial" font-size="32" font-weight="700" fill="${t.accent}">@${escapeXml(tweet.username || '')}</text>
  <text x="540" y="330" text-anchor="middle"
     font-family="Vazirmatn,Arial" font-size="24" fill="${t.textDim}">${escapeXml(tweet.date || '')}</text>
  ${textRows}
  <rect x="390" y="${divY}" width="300" height="2" fill="${t.accent}" opacity="0.3" rx="1"/>
  <text x="540" y="${h - 44}" text-anchor="middle"
     font-family="Vazirmatn,Arial" font-size="22" fill="${t.textDim}" opacity="0.6">@VeriaApp</text>
  <rect x="0" y="${h - 6}" width="1080" height="6" fill="${t.accent}" opacity="0.5"/>
</svg>`;
}

async function generateQuoteImage(quote, themeKey) {
  const svg = buildQuoteSVG(quote, themeKey || THEME_KEYS[0]);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}

async function generateTweetImage(tweet, themeKey) {
  const svg = buildTweetSVG(tweet, themeKey || THEME_KEYS[1]);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}

module.exports = { generateQuoteImage, generateTweetImage, THEME_KEYS };
