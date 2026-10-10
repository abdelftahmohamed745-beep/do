import fs from 'fs';
import path from 'path';
import { DoctorProfile } from '../types';
import { getDoctorSeoData } from '../utils/seo';

function getFirebaseConfig() {
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'prefab-groove-502023-t4',
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f',
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCcS-iNhEkZ80ryW6AGS854ERxXBklYSyE'
  };
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
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
    return (val.arrayValue.values || []).map((item: any) => parseFirestoreValue(item));
  }
  if ('mapValue' in val) {
    return parseFirestoreFields(val.mapValue.fields || {});
  }
  return null;
}

function parseFirestoreFields(fields: Record<string, any>): DoctorProfile {
  const docObj: Record<string, any> = {};
  if (!fields) return docObj as DoctorProfile;
  for (const [key, val] of Object.entries(fields)) {
    docObj[key] = parseFirestoreValue(val);
  }
  return docObj as DoctorProfile;
}

export async function fetchDoctorProfileServer(docId: string): Promise<DoctorProfile | null> {
  if (!docId || typeof docId !== 'string') return null;

  // Clean docId to avoid path manipulation
  const sanitizedDocId = docId.trim();
  if (!sanitizedDocId || sanitizedDocId.includes('/') || sanitizedDocId.includes('\\')) {
    return null;
  }

  // Ultra-fast, server-safe REST API fetch
  try {
    const fbConfig = getFirebaseConfig();
    const projectId = fbConfig.projectId;
    const databaseId = fbConfig.firestoreDatabaseId || '(default)';
    const apiKey = fbConfig.apiKey;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/doctors/${encodeURIComponent(sanitizedDocId)}?key=${apiKey}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.fields) {
        const doctor = parseFirestoreFields(data.fields);
        doctor.uid = doctor.uid || sanitizedDocId;

        // Check if active
        if (doctor.isActive === false) {
          return null;
        }

        return doctor;
      }
    }
  } catch (err) {
    console.warn('Error fetching doctor via REST API in server prerender:', err);
  }

  return null;
}

export function generate404Html(rootDir: string, docId: string): string {
  let baseTemplate = '';
  const distHtmlPath = path.join(rootDir, 'dist', 'index.html');
  const srcHtmlPath = path.join(rootDir, 'index.html');

  if (fs.existsSync(distHtmlPath)) {
    baseTemplate = fs.readFileSync(distHtmlPath, 'utf-8');
  } else if (fs.existsSync(srcHtmlPath)) {
    baseTemplate = fs.readFileSync(srcHtmlPath, 'utf-8');
  } else {
    baseTemplate = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>العيادة غير موجودة</title></head><body><div id="root"></div></body></html>`;
  }

  const notFoundTitle = 'العيادة غير موجودة | منصة دوري';
  const notFoundDesc = 'عفواً، لم نتمكن من العثور على العيادة أو الطبيب المطلوب في منصة دوري.';
  const canonicalUrl = `https://dory-system.vercel.app/clinic/${encodeURIComponent(docId)}`;

  let html = baseTemplate;

  // Replace Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(notFoundTitle)}</title>`);

  // Inject Meta
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

export function generateClinicPrerenderHtml(rootDir: string, doctor: DoctorProfile): string {
  let baseTemplate = '';
  const distHtmlPath = path.join(rootDir, 'dist', 'index.html');
  const srcHtmlPath = path.join(rootDir, 'index.html');

  if (fs.existsSync(distHtmlPath)) {
    baseTemplate = fs.readFileSync(distHtmlPath, 'utf-8');
  } else if (fs.existsSync(srcHtmlPath)) {
    baseTemplate = fs.readFileSync(srcHtmlPath, 'utf-8');
  } else {
    baseTemplate = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>دوري</title></head><body><div id="root"></div></body></html>`;
  }

  const seo = getDoctorSeoData(doctor);

  const docName = doctor.name ? doctor.name.trim() : 'طبيب';
  const clinicName = doctor.clinicName ? doctor.clinicName.trim() : 'عيادة طبية';
  const specialty = doctor.specialty ? doctor.specialty.trim() : '';
  const address = doctor.address ? doctor.address.trim() : '';
  const city = doctor.city ? doctor.city.trim() : '';
  const phone = doctor.phone ? doctor.phone.trim() : '';
  const workHoursStr = formatWorkHours(doctor.workHours);
  const description = doctor.description ? doctor.description.trim() : '';

  let html = baseTemplate;

  // Replace Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);

  // Remove existing default meta description/canonical/og/twitter tags to avoid duplication
  html = html.replace(/<meta name="description"[\s\S]*?>/gi, '');
  html = html.replace(/<meta name="robots"[\s\S]*?>/gi, '');
  html = html.replace(/<link rel="canonical"[\s\S]*?>/gi, '');
  html = html.replace(/<meta property="og:[\s\S]*?>/gi, '');
  html = html.replace(/<meta name="twitter:[\s\S]*?>/gi, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  const imageTag = seo.ogImage
    ? `<meta property="og:image" content="${escapeHtml(seo.ogImage)}" />
       <meta name="twitter:image" content="${escapeHtml(seo.ogImage)}" />
       <meta name="twitter:card" content="summary_large_image" />`
    : `<meta name="twitter:card" content="summary" />`;

  const metaHeader = `
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="robots" content="${escapeHtml(seo.robots || 'index, follow')}" />
    <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />

    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="منصة دوري" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />
    <meta property="og:locale" content="ar_SA" />
    ${imageTag}

    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />

    <script type="application/ld+json">
    ${JSON.stringify(seo.jsonLd, null, 2)}
    </script>
  `;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${metaHeader}\n</head>`);
  }

  const locationStr = [address, city].filter(Boolean).join('، ');

  const visibleBody = `
    <div id="root">
      <div style="max-width:800px;margin:0 auto;padding:24px;direction:rtl;text-align:right;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <header style="margin-bottom:24px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">
          <a href="/" style="color:#0284c7;text-decoration:none;font-weight:bold;font-size:14px;">← العودة لمنصة دوري</a>
          <h1 style="font-size:28px;font-weight:bold;color:#0f172a;margin-top:12px;margin-bottom:4px;">${escapeHtml(docName)}</h1>
          <p style="font-size:18px;color:#0284c7;font-weight:bold;margin:0;">${escapeHtml(clinicName)}${specialty ? ` - ${escapeHtml(specialty)}` : ''}</p>
        </header>
        <main>
          ${locationStr ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>العنوان:</strong> ${escapeHtml(locationStr)}</p>` : ''}
          ${phone ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>الهاتف:</strong> ${escapeHtml(phone)}</p>` : ''}
          ${workHoursStr ? `<p style="font-size:15px;color:#334155;margin-bottom:8px;"><strong>ساعات العمل:</strong> ${escapeHtml(workHoursStr)}</p>` : ''}
          ${description ? `<p style="font-size:15px;color:#475569;margin-top:12px;line-height:1.6;">${escapeHtml(description)}</p>` : ''}
          <div style="margin-top:24px;padding:20px;background-color:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;text-align:center;">
            <h2 style="font-size:18px;color:#0369a1;font-weight:bold;margin-top:0;margin-bottom:8px;">حجز دور وتتبع المواعيد المباشرة</h2>
            <p style="font-size:14px;color:#0284c7;margin-bottom:16px;">احجز دورك الآن أونلاين وتتبع دورك في الانتظار لحظة بلحظة عبر منصة دوري.</p>
            <a href="/clinic/${escapeHtml(doctor.uid)}/book" style="display:inline-block;background-color:#0284c7;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">احجز دورك الآن أونلاين</a>
          </div>
        </main>
      </div>
    </div>
  `;

  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, visibleBody);

  return html;
}

export async function renderClinicHtml(rootDir: string, docId: string): Promise<{ status: number; html: string }> {
  const doctor = await fetchDoctorProfileServer(docId);
  if (!doctor) {
    return {
      status: 404,
      html: generate404Html(rootDir, docId)
    };
  }

  return {
    status: 200,
    html: generateClinicPrerenderHtml(rootDir, doctor)
  };
}
