import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://dory-system.vercel.app';

const FIREBASE_CONFIG = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'prefab-groove-502023-t4',
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f',
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCcS-iNhEkZ80ryW6AGS854ERxXBklYSyE'
};

function escapeXml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req: any, res: any) {
  try {
    const urls: { loc: string; lastmod?: string }[] = [
      { loc: `${SITE_URL}/` },
      { loc: `${SITE_URL}/about` },
      { loc: `${SITE_URL}/for-clinics` },
      { loc: `${SITE_URL}/for-labs` },
      { loc: `${SITE_URL}/for-patients` },
      { loc: `${SITE_URL}/faq` },
      { loc: `${SITE_URL}/privacy` }
    ];

    try {
      const { projectId, firestoreDatabaseId, apiKey } = FIREBASE_CONFIG;
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery?key=${apiKey}`;

      const apiRes = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'doctors' }]
          }
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (apiRes.ok) {
        const items = await apiRes.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && item.document && item.document.name) {
              const docNamePath = item.document.name;
              const docId = docNamePath.split('/').pop() || '';
              const fields = item.document.fields || {};

              const isActiveVal = fields.isActive ? fields.isActive.booleanValue : true;
              if (docId && isActiveVal !== false) {
                let lastmod: string | undefined = undefined;
                const rawDate = fields.updatedAt?.stringValue || fields.createdAt?.stringValue;
                if (rawDate) {
                  try {
                    const parsed = new Date(rawDate);
                    if (!isNaN(parsed.getTime())) {
                      lastmod = parsed.toISOString();
                    }
                  } catch (e) {
                    // Ignore invalid dates
                  }
                }

                urls.push({
                  loc: `${SITE_URL}/clinic/${encodeURIComponent(docId)}`,
                  lastmod
                });
              }
            }
          }
        }
      }

      // Also query laboratories
      const labQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery?key=${apiKey}`;
      const labApiRes = await fetch(labQueryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'laboratories' }]
          }
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (labApiRes.ok) {
        const labItems = await labApiRes.json();
        if (Array.isArray(labItems)) {
          for (const item of labItems) {
            if (item && item.document && item.document.name) {
              const docNamePath = item.document.name;
              const labId = docNamePath.split('/').pop() || '';
              const fields = item.document.fields || {};

              const isActiveVal = fields.isActive ? fields.isActive.booleanValue : true;
              if (labId && isActiveVal !== false) {
                let lastmod: string | undefined = undefined;
                const rawDate = fields.updatedAt?.stringValue || fields.createdAt?.stringValue;
                if (rawDate) {
                  try {
                    const parsed = new Date(rawDate);
                    if (!isNaN(parsed.getTime())) {
                      lastmod = parsed.toISOString();
                    }
                  } catch (e) {
                    // Ignore
                  }
                }

                urls.push({
                  loc: `${SITE_URL}/lab/${encodeURIComponent(labId)}`,
                  lastmod
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching doctors or labs for sitemap via REST:', err);
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const item of urls) {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(item.loc)}</loc>\n`;
      if (item.lastmod) {
        xml += `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n`;
      }
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Vercel sitemap function error:', error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Error generating sitemap');
  }
}
