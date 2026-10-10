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

async function fetchDoctorProfile(docId: string): Promise<Record<string, any> | null> {
  if (!docId || typeof docId !== 'string') return null;
  const sanitizedDocId = docId.trim();
  if (!sanitizedDocId) return null;

  try {
    const { projectId, firestoreDatabaseId, apiKey } = FIREBASE_CONFIG;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/doctors/${encodeURIComponent(sanitizedDocId)}?key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.fields) return null;

    const doctor = parseFirestoreFields(data.fields);
    doctor.uid = doctor.uid || sanitizedDocId;

    if (doctor.isActive === false) return null;

    return doctor;
  } catch (err) {
    console.error('Error fetching doctor via REST API in server prerender:', err);
    return null;
  }
}

function formatWorkHours(wh: any): string {
  if (!wh) return '';
  if (typeof wh === 'string') return wh.trim();
  if (typeof wh === 'object') {
    const days = Array.isArray(wh.daysOfWeek) ? wh.daysOfWeek.join('، ') : '';
    const time = wh.open && wh.close ? `من ${wh.open} إلى ${wh.close}` : '';
    return [days, time].filter(Boolean).join(' - ');
  }
  return '';
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

function generate404Html(rootDir: string, docId: string): string {
  const baseTemplate = getBaseHtmlTemplate(rootDir);
  const notFoundTitle = 'العيادة غير موجودة | منصة دوري';
  const notFoundDesc = 'عفواً، لم نتمكن من العثور على العيادة أو الطبيب المطلوب في منصة دوري.';
  const canonicalUrl = `${SITE_URL}/clinic/${encodeURIComponent(docId)}`;

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
        <h1 style="font-size:26px;color:#0f172a;font-weight:bold;margin-bottom:12px;">404 - العيادة غير موجودة</h1>
        <p style="color:#64748b;font-size:15px;margin-bottom:24px;">عفواً، لم نتمكن من العثور على العيادة أو الطبيب المطلوب في منصة دوري.</p>
        <a href="/" style="display:inline-block;background-color:#0284c7;color:#ffffff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">العودة للصفحة الرئيسية</a>
      </div>
    </div>
  `;

  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, notFoundBody);
  return html;
}

function generate200Html(rootDir: string, doctor: Record<string, any>): string {
  const baseTemplate = getBaseHtmlTemplate(rootDir);

  const docName = doctor.name ? String(doctor.name).trim() : 'طبيب';
  const clinicName = doctor.clinicName ? String(doctor.clinicName).trim() : 'عيادة طبية';
  const specialty = doctor.specialty ? String(doctor.specialty).trim() : '';
  const city = doctor.city ? String(doctor.city).trim() : '';
  const address = doctor.address ? String(doctor.address).trim() : '';
  const phone = doctor.phone ? String(doctor.phone).trim() : '';
  const workHoursStr = formatWorkHours(doctor.workHours);
  const rawDesc = doctor.description ? String(doctor.description).trim() : '';

  const title = specialty
    ? `${docName} - ${specialty} | ${clinicName} - دوري`
    : `${docName} | ${clinicName} - دوري`;

  const locationPart = [address, city].filter(Boolean).join('، ');
  const descParts = [
    `احجز دورك وتتبع المواعيد أونلاين في ${clinicName} للدكتور ${docName}`,
    specialty ? `تخصص ${specialty}` : '',
    locationPart ? `العنوان: ${locationPart}` : '',
    'عبر منصة دوري لإدارة العيادات والمواعيد المباشرة.'
  ].filter(Boolean);

  const description = rawDesc.length > 10
    ? `${rawDesc.slice(0, 110)}.. ${descParts[0]}.`
    : descParts.join(' - ');

  const canonicalUrl = `${SITE_URL}/clinic/${doctor.uid}`;
  const photo = doctor.photoUrl || (Array.isArray(doctor.clinicPhotos) && doctor.clinicPhotos[0]) || undefined;

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    'name': docName,
    'alternateName': clinicName,
    'description': description,
    'url': canonicalUrl,
    'medicalSpecialty': specialty || 'Medical Clinic'
  };

  if (photo) {
    jsonLd['image'] = photo;
  }

  if (locationPart) {
    jsonLd['address'] = {
      '@type': 'PostalAddress',
      'streetAddress': address || locationPart,
      'addressLocality': city || 'مصر',
      'addressCountry': 'EG'
    };
  }

  if (phone) {
    jsonLd['telephone'] = phone;
  }

  let html = baseTemplate;

  // Replace Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // Strip existing tags
  html = html.replace(/<meta name="description"[\s\S]*?>/gi, '');
  html = html.replace(/<meta name="robots"[\s\S]*?>/gi, '');
  html = html.replace(/<link rel="canonical"[\s\S]*?>/gi, '');
  html = html.replace(/<meta property="og:[\s\S]*?>/gi, '');
  html = html.replace(/<meta name="twitter:[\s\S]*?>/gi, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  const imageTag = photo
    ? `<meta property="og:image" content="${escapeHtml(photo)}" />
       <meta name="twitter:image" content="${escapeHtml(photo)}" />
       <meta name="twitter:card" content="summary_large_image" />`
    : `<meta name="twitter:card" content="summary" />`;

  const metaHeader = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="منصة دوري" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="ar_SA" />
    ${imageTag}

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
          <a href="/" style="color:#0284c7;text-decoration:none;font-weight:bold;font-size:14px;">← العودة لمنصة دوري</a>
          <h1 style="font-size:28px;font-weight:bold;color:#0f172a;margin-top:12px;margin-bottom:4px;">${escapeHtml(docName)}</h1>
          <p style="font-size:18px;color:#0284c7;font-weight:bold;margin:0;">${escapeHtml(clinicName)}${specialty ? ` - ${escapeHtml(specialty)}` : ''}</p>
        </header>
        <main>
          ${locationPart ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>العنوان:</strong> ${escapeHtml(locationPart)}</p>` : ''}
          ${phone ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>الهاتف:</strong> ${escapeHtml(phone)}</p>` : ''}
          ${workHoursStr ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>ساعات العمل:</strong> ${escapeHtml(workHoursStr)}</p>` : ''}
          ${rawDesc ? `<p style="font-size:15px;color:#475569;margin-top:12px;line-height:1.6;">${escapeHtml(rawDesc)}</p>` : ''}
          <div style="margin-top:24px;padding:20px;background-color:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;text-align:center;">
            <h2 style="font-size:18px;color:#0369a1;font-weight:bold;margin-top:0;margin-bottom:8px;">حجز دور وتتبع المواعيد المباشرة</h2>
            <p style="font-size:14px;color:#0284c7;margin-bottom:16px;">احجز دورك الآن أونلاين وتتبع دورك في الانتظار لحظة بلحظة عبر منصة دوري.</p>
            <a href="/clinic/${escapeHtml(doctor.uid)}" style="display:inline-block;background-color:#0284c7;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">احجز دورك الآن أونلاين</a>
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
    let docId = (req.query?.docId as string) || '';

    if (!docId && req.url) {
      const match = req.url.match(/\/clinic\/([^/?#]+)/);
      if (match && match[1]) {
        docId = decodeURIComponent(match[1]);
      }
    }

    const rootDir = process.cwd();
    const doctor = await fetchDoctorProfile(docId);

    if (!doctor) {
      const html = generate404Html(rootDir, docId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(404).send(html);
    }

    const html = generate200Html(rootDir, doctor);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Vercel clinic prerender function error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<!doctype html><html lang="ar" dir="rtl"><head><title>خطأ في الخادم</title></head><body><h1>500 - حدث خطأ غير متوقع</h1></body></html>');
  }
}
