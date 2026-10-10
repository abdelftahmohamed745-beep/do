import fs from 'fs';
import path from 'path';

function getFirebaseConfig() {
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'prefab-groove-502023-t4',
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f',
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCcS-iNhEkZ80ryW6AGS854ERxXBklYSyE'
  };
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateSitemapXml(): Promise<string> {
  const baseUrl = 'https://dory-system.vercel.app';
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${baseUrl}/` },
    { loc: `${baseUrl}/about` },
    { loc: `${baseUrl}/for-clinics` },
    { loc: `${baseUrl}/for-labs` },
    { loc: `${baseUrl}/for-patients` },
    { loc: `${baseUrl}/faq` },
    { loc: `${baseUrl}/privacy` }
  ];

  let fetchedByRest = false;

  // Attempt 1: REST runQuery fetch (fastest in serverless)
  try {
    const fbConfig = getFirebaseConfig();
    const projectId = fbConfig.projectId;
    const databaseId = fbConfig.firestoreDatabaseId || '(default)';
    const apiKey = fbConfig.apiKey;

    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'doctors' }]
        }
      })
    });

    if (res.ok) {
      const items = await res.json();
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
                loc: `${baseUrl}/clinic/${encodeURIComponent(docId)}`,
                lastmod
              });
            }
          }
        }
        fetchedByRest = true;
      }
    }

    // Also fetch public laboratories for the sitemap
    const labQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;
    const labRes = await fetch(labQueryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'laboratories' }]
        }
      })
    });

    if (labRes.ok) {
      const labItems = await labRes.json();
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
                loc: `${baseUrl}/lab/${encodeURIComponent(labId)}`,
                lastmod
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('REST runQuery in sitemap failed:', err);
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

  return xml;
}
