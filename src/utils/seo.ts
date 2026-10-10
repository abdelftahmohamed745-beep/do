import { DoctorProfile } from '../types';

const SITE_URL = 'https://dory-system.vercel.app';

export interface SeoData {
  title: string;
  description: string;
  canonicalUrl: string;
  robots?: string;
  ogType?: string;
  ogImage?: string;
  jsonLd?: object;
}

export const DEFAULT_HOMEPAGE_SEO: SeoData = {
  title: 'دوري | Dory - نظام تشغيل وإدارة العيادات الطبية',
  description: 'دوري (Dory) هو نظام تشغيل وإدارة العيادات الطبية المستقلة للأطباء وطاقم العيادة، لإدارة طابور الكشف، والسجلات الطبية، والمواعيد، والمالية اليومية.',
  canonicalUrl: `${SITE_URL}/`,
  robots: 'index, follow',
  ogType: 'website',
  ogImage: `${SITE_URL}/dory-og-image.png`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        'name': 'دوري',
        'alternateName': 'Dory',
        'url': `${SITE_URL}/`,
        'applicationCategory': 'HealthApplication',
        'operatingSystem': 'Web',
        'inLanguage': 'ar',
        'description': 'دوري (Dory) هو نظام تشغيل وإدارة العيادات الطبية المستقلة للأطباء وطاقم العيادة، لإدارة طابور الكشف، والسجلات الطبية، والمواعيد، والمالية اليومية.',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'EGP'
        }
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        'url': `${SITE_URL}/`,
        'name': 'دوري | Dory',
        'alternateName': 'منصة دوري الطبية',
        'description': 'نظام إدارة العيادات والمراكز الطبية ومختبرات التحاليل وحجز المواعيد وتتبع أدوار المرضى.',
        'inLanguage': 'ar'
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        'name': 'دوري | Dory',
        'url': `${SITE_URL}/`,
        'logo': `${SITE_URL}/dory-logo.png`,
        'image': `${SITE_URL}/dory-og-image.png`,
        'description': 'نظام سحابي لإدارة العيادات والمراكز الطبية ومختبرات التحاليل وحجز المواعيد وتتبع أدوار المرضى والسجلات والتقارير الطبية.'
      }
    ]
  }
};

export const ABOUT_PAGE_SEO: SeoData = {
  title: 'عن منظومة دوري | حلول رقمنة العيادات والمختبرات الطبية',
  description: 'تعرف على رؤية منصة دوري (Dory) في القضاء على التكدس في غرف الانتظار وتطوير تجربة الكشف الطبي للمرضى والأطباء والمعامل.',
  canonicalUrl: `${SITE_URL}/about`,
  robots: 'index, follow',
  ogType: 'website',
  ogImage: `${SITE_URL}/dory-og-image.png`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    'name': 'عن منظومة دوري الطبية',
    'description': 'نظام سحابي متكامل لإدارة العيادات والمراكز الطبية ومختبرات التحاليل ورقمنة تجربة الكشف.',
    'url': `${SITE_URL}/about`,
    'inLanguage': 'ar'
  }
};

export const FOR_CLINICS_PAGE_SEO: SeoData = {
  title: 'دوري للأطباء والعيادات | إدارة الطابور الحي والمواعيد والملفات الطبية',
  description: 'نظام متكامل لإدارة العيادات: نداء المرضى في الطابور، شاشة تلفزيون الانتظار TV View، الروشتات الإلكترونية، متابعات إعادة الكشف، والتقارير المالية.',
  canonicalUrl: `${SITE_URL}/for-clinics`,
  robots: 'index, follow',
  ogType: 'website',
  ogImage: `${SITE_URL}/dory-og-image.png`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    'name': 'دوري للأطباء والعيادات',
    'description': 'أدوات إدارة الطوابير السريرية والملفات الطبية ومواعيد إعادة الكشف للعيادات.',
    'url': `${SITE_URL}/for-clinics`,
    'inLanguage': 'ar'
  }
};

export const FOR_PATIENTS_PAGE_SEO: SeoData = {
  title: 'دوري للمرضى والمراجعين | حجز فوري وتتبع الدور واستلام النتائج أونلاين',
  description: 'احجز كشفك الطبي أو فحص المعمل في ثوانٍ بدون تطبيق، وتابع دورك في الطابور مباشرة من هاتفك، واسترجع تذكرتك برقم الهاتف.',
  canonicalUrl: `${SITE_URL}/for-patients`,
  robots: 'index, follow',
  ogType: 'website',
  ogImage: `${SITE_URL}/dory-og-image.png`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': 'دوري للمرضى والمراجعين',
    'description': 'تجربة حجز مريحة وتتبع فوري للدور في العيادات واستلام نتائج التحاليل إلكترونياً.',
    'url': `${SITE_URL}/for-patients`,
    'inLanguage': 'ar'
  }
};

export const FAQ_PAGE_SEO: SeoData = {
  title: 'الأسئلة الشائعة (FAQ) | منظومة دوري للعيادات والمختبرات',
  description: 'إجابات واضحة وشاملة حول آلية حجز المرضى، استرجاع التذاكر، تشغيل شاشة التلفزيون، إدارة التحاليل، وخصوصية البيانات في دوري.',
  canonicalUrl: `${SITE_URL}/faq`,
  robots: 'index, follow',
  ogType: 'website',
  ogImage: `${SITE_URL}/dory-og-image.png`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'هل يحتاج المريض لتحميل تطبيق لحجز الدور في دوري؟',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'لا، يعمل دوري مباشرة عبر أي متصفح هاتف ذكي (Safari, Chrome) دون الحاجة لتثبيت أي تطبيق أو استهلاك ذاكرة الهاتف.'
        }
      },
      {
        '@type': 'Question',
        'name': 'هل يمكن للمريض حجز دوره بدون إنشاء حساب؟',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'نعم، يمكن للمريض الحجز فوراً كـ Guest بمجرد إدخال الاسم ورقم الهاتف واختيار نوع الكشف، دون الحاجة لتسجيل حساب أو تذكر كلمة مرور.'
        }
      },
      {
        '@type': 'Question',
        'name': 'كيف يسترجع المريض تذكرته إذا أغلق المتصفح بالخطأ؟',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'يتم حفظ التذكرة محلياً على جهاز المريض، كما يمكنه استرجاعها فوراً بإدخال رقم هاتفه في صفحة العيادة أو المعمل.'
        }
      },
      {
        '@type': 'Question',
        'name': 'كيف تدعم دوري شاشات التلفزيون في صالات الانتظار؟',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'يوفر النظام وضع TV View مخصصاً لعرض رقم الكشف الحالي والأدوار القادمة بوضوح على شاشات التلفزيون مع نداء صوتي آلي عند دخول كل دور.'
        }
      },
      {
        '@type': 'Question',
        'name': 'كيف يتم توثيق نتائج تحاليل المعامل في دوري؟',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'يصدر المعمل نتائج التحاليل في تقارير PDF رسمية تتضمن رمز QR للتحقق السريع من صحة النتيجة وتاريخ اعتمادها.'
        }
      }
    ]
  }
};

export const PRIVACY_PAGE_SEO: SeoData = {
  title: 'سياسة الخصوصية وأمان البيانات | منصة دوري',
  description: 'تعرف على سياسة حماية الخصوصية في منصة دوري، وضوابط عزل البيانات الطبية، وسرية معلومات المرضى والعيادات.',
  canonicalUrl: `${SITE_URL}/privacy`,
  robots: 'index, follow',
  ogType: 'website',
  ogImage: `${SITE_URL}/dory-og-image.png`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': 'سياسة الخصوصية وحماية البيانات في دوري',
    'description': 'إرشادات وضوابط حماية خصوصية المرضى والعيادات والمعامل في منصة دوري.',
    'url': `${SITE_URL}/privacy`,
    'inLanguage': 'ar'
  }
};

export function updateMetaTag(selector: string, attribute: string, value: string) {
  let element = document.querySelector(selector);
  if (!element) {
    if (selector.startsWith('meta[')) {
      element = document.createElement('meta');
      const propMatch = selector.match(/property=["']([^"']+)["']/);
      const nameMatch = selector.match(/name=["']([^"']+)["']/);
      if (propMatch) element.setAttribute('property', propMatch[1]);
      if (nameMatch) element.setAttribute('name', nameMatch[1]);
      document.head.appendChild(element);
    } else if (selector.startsWith('link[')) {
      element = document.createElement('link');
      const relMatch = selector.match(/rel=["']([^"']+)["']/);
      if (relMatch) element.setAttribute('rel', relMatch[1]);
      document.head.appendChild(element);
    }
  }
  if (element) {
    element.setAttribute(attribute, value);
  }
}

export function updateJsonLd(data?: object) {
  let script = document.querySelector('script[type="application/ld+json"]');
  if (!data) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data, null, 2);
}

export function setPageSeo(data: SeoData) {
  if (typeof document === 'undefined') return;

  // Title
  document.title = data.title;

  // Description
  updateMetaTag('meta[name="description"]', 'content', data.description);

  // Robots
  updateMetaTag('meta[name="robots"]', 'content', data.robots || 'index, follow');

  // Canonical
  updateMetaTag('link[rel="canonical"]', 'href', data.canonicalUrl);

  // Open Graph
  updateMetaTag('meta[property="og:title"]', 'content', data.title);
  updateMetaTag('meta[property="og:description"]', 'content', data.description);
  updateMetaTag('meta[property="og:url"]', 'content', data.canonicalUrl);
  updateMetaTag('meta[property="og:type"]', 'content', data.ogType || 'website');

  // Twitter
  updateMetaTag('meta[name="twitter:title"]', 'content', data.title);
  updateMetaTag('meta[name="twitter:description"]', 'content', data.description);

  const finalImage = data.ogImage || `${SITE_URL}/dory-og-image.png`;
  updateMetaTag('meta[property="og:image"]', 'content', finalImage);
  updateMetaTag('meta[name="twitter:image"]', 'content', finalImage);
  updateMetaTag('meta[name="twitter:card"]', 'content', 'summary_large_image');

  // JSON-LD
  updateJsonLd(data.jsonLd);
}

export function getDoctorSeoData(doctor: DoctorProfile): SeoData {
  const docName = doctor.name ? doctor.name.trim() : 'طبيب';
  const clinicName = doctor.clinicName ? doctor.clinicName.trim() : 'عيادة طبية';
  const specialty = doctor.specialty ? doctor.specialty.trim() : '';
  const city = doctor.city ? doctor.city.trim() : '';
  const address = doctor.address ? doctor.address.trim() : '';

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

  const description = doctor.description && doctor.description.trim().length > 10
    ? `${doctor.description.trim().slice(0, 110)}.. ${descParts[0]}.`
    : descParts.join(' - ');

  const canonicalUrl = `${SITE_URL}/clinic/${doctor.uid}`;
  const photo = doctor.photoUrl || (doctor.clinicPhotos && doctor.clinicPhotos[0]) || `${SITE_URL}/dory-og-image.png`;
  const isActive = doctor.isActive !== false;

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

  if (doctor.phone) {
    jsonLd['telephone'] = doctor.phone;
  }

  if (doctor.ratingAverage && doctor.ratingCount && doctor.ratingCount > 0) {
    jsonLd['aggregateRating'] = {
      '@type': 'AggregateRating',
      'ratingValue': doctor.ratingAverage,
      'reviewCount': doctor.ratingCount
    };
  }

  return {
    title,
    description,
    canonicalUrl,
    robots: isActive ? 'index, follow' : 'noindex, nofollow',
    ogType: 'profile',
    ogImage: photo,
    jsonLd
  };
}

export function getDoctorBookingSeoData(doctor: DoctorProfile): SeoData {
  const docName = doctor.name ? doctor.name.trim() : 'طبيب';
  const clinicName = doctor.clinicName ? doctor.clinicName.trim() : 'عيادة طبية';
  const specialty = doctor.specialty ? doctor.specialty.trim() : '';

  const title = `حجز دور - ${docName} | ${clinicName} - دوري`;
  const description = `احجز دورك الآن أونلاين لدى ${clinicName} للدكتور ${docName}${specialty ? ` (${specialty})` : ''} وتتبع ترتيبك في طابور الانتظار لحظياً عبر منصة دوري.`;
  const canonicalUrl = `${SITE_URL}/clinic/${doctor.uid}/book`;
  const photo = doctor.photoUrl || (doctor.clinicPhotos && doctor.clinicPhotos[0]) || `${SITE_URL}/dory-og-image.png`;

  return {
    title,
    description,
    canonicalUrl,
    robots: doctor.isActive !== false ? 'index, follow' : 'noindex, nofollow',
    ogType: 'website',
    ogImage: photo,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ReserveAction',
      'name': `حجز دور في ${clinicName}`,
      'target': canonicalUrl,
      'description': description,
      'agent': {
        '@type': 'Physician',
        'name': docName,
        'alternateName': clinicName
      }
    }
  };
}
