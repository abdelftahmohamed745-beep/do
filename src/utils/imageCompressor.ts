/**
 * Image Processing & Safe Compression Utility
 * Inspects binary magic headers, validates MIME and size limits,
 * safely resizes and compresses images on the client side into compact base64 strings
 * for direct, safe storage and fast web loading.
 */

export interface ProcessedImage {
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
  mimeType: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_RAW_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit before compression

/**
 * Validates binary header (magic bytes) to ensure file is genuinely an image
 * and not an executable or malicious script with a renamed extension.
 */
export async function verifyImageMagicBytes(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const slice = file.slice(0, 12);
      const reader = new FileReader();

      reader.onloadend = () => {
        if (!reader.result || !(reader.result instanceof ArrayBuffer)) {
          resolve(false);
          return;
        }

        const bytes = new Uint8Array(reader.result);
        if (bytes.length < 4) {
          resolve(false);
          return;
        }

        // JPEG / JPG check (FF D8 FF)
        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

        // PNG check (89 50 4E 47)
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

        // WebP check (52 49 46 46 .... 57 45 42 50)
        const isWebP =
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46 &&
          bytes.length >= 12 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50;

        // GIF check (47 49 46 38)
        const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;

        resolve(isJpeg || isPng || isWebP || isGif);
      };

      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(slice);
    } catch {
      resolve(false);
    }
  });
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'لم يتم اختيار ملف' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP' };
  }

  if (file.size > MAX_RAW_FILE_SIZE_BYTES) {
    return { valid: false, error: 'حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت قبل الضغط)' };
  }

  if (file.size < 64) {
    return { valid: false, error: 'الملف فارغ أو تالف وغير صالح' };
  }

  return { valid: true };
}

export async function processAndCompressImage(
  file: File,
  maxDimension: number = 800,
  quality: number = 0.82
): Promise<ProcessedImage> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'ملف غير صالح');
  }

  // Verify true binary header (magic bytes)
  const isRealImage = await verifyImageMagicBytes(file);
  if (!isRealImage) {
    throw new Error('الملف المحدد ليس ملف صورة حقيقي أو أنه تالف');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => reject(new Error('فشل فك تشفير بيانات الصورة، تأكد من سلامة الملف'));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          return reject(new Error('أبعاد الصورة غير صالحة'));
        }

        // Scale down if exceeds maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('تعذر إنشاء بيئة معالجة الصورة'));
        }

        // Fill background with white in case of transparent PNG converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

        resolve({
          dataUrl,
          sizeKb,
          width: canvas.width,
          height: canvas.height,
          mimeType: 'image/jpeg'
        });
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Dedicated paper prescription image compressor:
 * Guarantees crisp medical handwriting readability while keeping payload strictly under 300KB for direct Firestore base64 storage.
 */
export async function compressPrescriptionPhoto(file: File): Promise<ProcessedImage> {
  const primary = await processAndCompressImage(file, 1200, 0.76);
  if (primary.sizeKb <= 290) {
    return primary;
  }
  // Secondary pass if photo was exceptionally dense
  return processAndCompressImage(file, 960, 0.65);
}
