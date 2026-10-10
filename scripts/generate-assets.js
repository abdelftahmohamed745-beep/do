import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateAssets() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Favicon SVG
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#122c4a"/>
        <stop offset="100%" stop-color="#1c5242"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="26" fill="url(#g)"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="#38bdf8" stroke-width="6" stroke-dasharray="160 40" stroke-linecap="round"/>
    <path d="M50 28 v44 M28 50 h44" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="6" fill="#34d399"/>
  </svg>`;

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg, 'utf-8');

  // 2. Render Favicon PNG & Logo 512
  await sharp(Buffer.from(faviconSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'dory-logo.png'));

  await sharp(Buffer.from(faviconSvg))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  // 3. Open Graph 1200x630 High-Res Banner
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1b2d"/>
        <stop offset="50%" stop-color="#122c4a"/>
        <stop offset="100%" stop-color="#0f2b23"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="60" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bg)"/>

    <!-- Decorative circles -->
    <circle cx="1050" cy="120" r="280" fill="#0284c7" opacity="0.18" filter="url(#glow)"/>
    <circle cx="150" cy="500" r="240" fill="#10b981" opacity="0.15" filter="url(#glow)"/>

    <!-- Top Badge -->
    <g transform="translate(600, 90)">
      <rect x="-170" y="-22" width="340" height="44" rx="22" fill="#1e3a5f" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="0" y="7" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="18" font-weight="700" fill="#bae6fd" text-anchor="middle">
        منظومة دوري الطبية — Dory Medical
      </text>
    </g>

    <!-- Brand Logo and Title -->
    <g transform="translate(600, 200)">
      <!-- Logo Symbol -->
      <g transform="translate(-240, -45) scale(0.9)">
        <rect width="100" height="100" rx="24" fill="#1e3a5f" stroke="#38bdf8" stroke-width="3"/>
        <circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="6" stroke-dasharray="150 40" stroke-linecap="round"/>
        <path d="M50 30 v40 M30 50 h40" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <circle cx="50" cy="50" r="6" fill="#34d399"/>
      </g>

      <!-- Main Title -->
      <text x="30" y="25" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle">
        دوري — Dory
      </text>
    </g>

    <!-- Subtitle -->
    <text x="600" y="320" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="30" font-weight="800" fill="#e2e8f0" text-anchor="middle">
      نظام إدارة العيادات والمعامل الطبية وحجز المواعيد وتتبع أدوار المرضى
    </text>

    <!-- Description Paragraph -->
    <text x="600" y="375" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="20" font-weight="500" fill="#94a3b8" text-anchor="middle">
      تنظيم طابور الانتظار المباشر • تذاكر رقمية ذكية • إدارة السجلات الطبية • شاشات الانتظار • منظومة المعامل
    </text>

    <!-- 3 Pillars Feature Cards -->
    <g transform="translate(600, 480)">
      <!-- Card 1: Clinics -->
      <g transform="translate(-360, 0)">
        <rect x="-160" y="-45" width="320" height="90" rx="18" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.4"/>
        <text x="0" y="-12" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="19" font-weight="800" fill="#6ee7b7" text-anchor="middle">🩺 للعيادات والأطباء</text>
        <text x="0" y="18" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="14" font-weight="600" fill="#cbd5e1" text-anchor="middle">طابور حي، تذاكر رقمية، وسجلات المرضى</text>
      </g>

      <!-- Card 2: Laboratories -->
      <g transform="translate(0, 0)">
        <rect x="-160" y="-45" width="320" height="90" rx="18" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.4"/>
        <text x="0" y="-12" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="19" font-weight="800" fill="#7dd3fc" text-anchor="middle">🧪 لمعامل التحاليل</text>
        <text x="0" y="18" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="14" font-weight="600" fill="#cbd5e1" text-anchor="middle">إدارة العينات ونتائج PDF الموثقة بـ QR</text>
      </g>

      <!-- Card 3: Patients -->
      <g transform="translate(360, 0)">
        <rect x="-160" y="-45" width="320" height="90" rx="18" fill="url(#cardGrad)" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.4"/>
        <text x="0" y="-12" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="19" font-weight="800" fill="#fcd34d" text-anchor="middle">👥 للمرضى والزوار</text>
        <text x="0" y="18" font-family="'Cairo', 'Segoe UI', sans-serif" font-size="14" font-weight="600" fill="#cbd5e1" text-anchor="middle">حجز فوري وتتبع لحظي للدور بالهاتف</text>
      </g>
    </g>

    <!-- Bottom URL Bar -->
    <text x="600" y="595" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="600" fill="#64748b" text-anchor="middle" letter-spacing="1">
      https://dory-system.vercel.app
    </text>
  </svg>`;

  await sharp(Buffer.from(ogSvg))
    .resize(1200, 630)
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'dory-og-image.png'));

  console.log('Assets generated successfully in /public');
}

generateAssets().catch(console.error);
