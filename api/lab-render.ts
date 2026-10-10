import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://dory-system.vercel.app';

const FIREBASE_CONFIG = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'prefab-groove-502023-t4',
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f',
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCcS-iNhEkZ80ryW6AGS854ERxXBklYSyE'
};

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('arrayValue' in val) {
    const arr = val.arrayValue?.values || [];
    return arr.map((item: any) => parseFirestoreValue(item));
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

async function fetchLabProfile(labId: string): Promise<Record<string, any> | null> {
  if (!labId || typeof labId !== 'string') return null;
  const sanitizedLabId = labId.trim();
  if (!sanitizedLabId) return null;

  try {
    const { projectId, firestoreDatabaseId, apiKey } = FIREBASE_CONFIG;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/laboratories/${encodeURIComponent(sanitizedLabId)}?key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.fields) return null;

    const lab = parseFirestoreFields(data.fields);
    lab.uid = lab.uid || sanitizedLabId;

    if (lab.isActive === false) return null;

    return lab;
  } catch (err) {
    console.error('Error fetching lab via REST API in server prerender:', err);
    return null;
  }
}

function getBaseHtmlTemplate(rootDir: string): string {
  try {
    const distHtmlPath = path.join(rootDir, 'dist', 'index.html');
    const srcHtmlPath = path.join(rootDir, 'index.html');

    if (fs.existsSync(distHtmlPath)) {
      return fs.readFileSync(distHtmlPath, 'utf-8');
    }
    if (fs.existsSync(srcHtmlPath)) {
      return fs.readFileSync(srcHtmlPath, 'utf-8');
    }
  } catch (err) {
    console.warn('Could not read index.html from disk, using fallback:', err);
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>دوري</title></head><body><div id="root"></div></body></html>`;
}

function generate404LabHtml(rootDir: string, labId: string): string {
  const baseTemplate = getBaseHtmlTemplate(rootDir);
  const notFoundTitle = 'المعمل غير موجود | دوري';
  const notFoundDesc = 'عفواً، لم نتمكن من العثور على معمل التحاليل المطلوب في منصة دوري.';
  const canonicalUrl = `${SITE_URL}/lab/${encodeURIComponent(labId)}`;

  let html = baseTemplate;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(notFoundTitle)}</title>`);

  const metaTags = `
    <meta name="description" content="${escapeHtml(notFoundDesc)}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  `;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${metaTags}\n</head>`);
  }

  const notFoundBody = `
    <div id="root">
      <div style="max-width:600px;margin:80px auto;padding:32px;text-align:center;font-family:sans-serif;direction:rtl;">
        <h1 style="font-size:26px;color:#0f172a;font-weight:bold;margin-bottom:12px;">404 - المعمل غير موجود</h1>
        <p style="color:#64748b;font-size:15px;margin-bottom:24px;">عفواً، لم نتمكن من العثور على معمل التحاليل المطلوب في منصة دوري.</p>
        <a href="/" style="display:inline-block;background-color:#122c4a;color:#ffffff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">العودة للصفحة الرئيسية</a>
      </div>
    </div>
  `;

  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, notFoundBody);
  return html;
}

function generate200LabHtml(rootDir: string, lab: Record<string, any>): string {
  const baseTemplate = getBaseHtmlTemplate(rootDir);

  const labName = lab.name ? String(lab.name).trim() : 'معمل تحاليل';
  const address = lab.address ? String(lab.address).trim() : '';
  const city = lab.city ? String(lab.city).trim() : '';
  const phone = lab.phone ? String(lab.phone).trim() : '';
  const hours = lab.workHours ? `من ${lab.workHours.open} إلى ${lab.workHours.close}` : '';

  const title = `${labName} - معمل تحاليل طبية | دليل الفحوصات والأسعار - دوري`;
  const locationPart = [address, city].filter(Boolean).join('، ');

  const description = `استعرض دليل تحاليل وباقات ${labName}${locationPart ? ` في ${locationPart}` : ''}، واطلب سحب العينات واستلم نتائجك الموثقة بـ QR عبر دوري.`;
  const canonicalUrl = `${SITE_URL}/lab/${lab.uid}`;
  const logo = lab.logoUrl || `${SITE_URL}/dory-logo.png`;

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    'name': labName,
    'description': description,
    'url': canonicalUrl,
    'image': logo
  };

  if (locationPart) {
    jsonLd['address'] = {
      '@type': 'PostalAddress',
      'streetAddress': address || locationPart,
      'addressLocality': city || 'العراق / مصر',
      'addressCountry': 'IQ'
    };
  }

  if (phone) {
    jsonLd['telephone'] = phone;
  }

  let html = baseTemplate;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // Strip existing tags
  html = html.replace(/<meta name="description"[\s\S]*?>/gi, '');
  html = html.replace(/<meta name="robots"[\s\S]*?>/gi, '');
  html = html.replace(/<link rel="canonical"[\s\S]*?>/gi, '');
  html = html.replace(/<meta property="og:[\s\S]*?>/gi, '');
  html = html.replace(/<meta name="twitter:[\s\S]*?>/gi, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  const metaHeader = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

    <meta property="og:type" content="business.business" />
    <meta property="og:site_name" content="دوري — Dory" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="ar_SA" />
    <meta property="og:image" content="${escapeHtml(logo)}" />
    <meta name="twitter:image" content="${escapeHtml(logo)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />

    <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2)}
    </script>
  `;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${metaHeader}\n</head>`);
  }

  const visibleBody = `
    <div id="root">
      <div style="max-width:800px;margin:0 auto;padding:24px;direction:rtl;text-align:right;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <header style="margin-bottom:24px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">
          <a href="/" style="color:#122c4a;text-decoration:none;font-weight:bold;font-size:14px;">← العودة لمنصة دوري</a>
          <h1 style="font-size:28px;font-weight:bold;color:#0f172a;margin-top:12px;margin-bottom:4px;">${escapeHtml(labName)}</h1>
          <p style="font-size:18px;color:#122c4a;font-weight:bold;margin:0;">معمل تحاليل طبية معتمد</p>
        </header>
        <main>
          ${locationPart ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>العنوان:</strong> ${escapeHtml(locationPart)}</p>` : ''}
          ${phone ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>الهاتف:</strong> ${escapeHtml(phone)}</p>` : ''}
          ${hours ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>مواعيد العمل:</strong> ${escapeHtml(hours)}</p>` : ''}
          <div style="margin-top:24px;padding:20px;background-color:#edf3fa;border-radius:12px;border:1px solid #d1dfed;text-align:center;">
            <h2 style="font-size:18px;color:#122c4a;font-weight:bold;margin-top:0;margin-bottom:8px;">دليل الفحوصات والتحاليل المعتمدة</h2>
            <p style="font-size:14px;color:#1b3a5c;margin-bottom:16px;">تصفح أسعار الفحوصات وشروط العينات واطلب السحب المنزلي عبر دوري.</p>
            <a href="/lab/${escapeHtml(lab.uid)}" style="display:inline-block;background-color:#122c4a;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">استعراض الفحوصات</a>
          </div>
        </main>
      </div>
    </div>
  `;

  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, visibleBody);
  return html;
}

export default async function handler(req: any, res: any) {
  try {
    let labId = (req.query?.labId as string) || '';

    if (!labId && req.url) {
      const match = req.url.match(/\/lab\/([^/?#]+)/);
      if (match && match[1]) {
        labId = decodeURIComponent(match[1]);
      }
    }

    const rootDir = process.cwd();
    const lab = await fetchLabProfile(labId);

    if (!lab) {
      const html = generate404LabHtml(rootDir, labId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(404).send(html);
    }

    const html = generate200LabHtml(rootDir, lab);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Vercel lab prerender function error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<!doctype html><html lang="ar" dir="rtl"><head><title>خطأ في الخادم</title></head><body><h1>500 - حدث خطأ غير متوقع</h1></body></html>');
  }
}
