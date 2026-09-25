/**
 * أدوات مساعدة للخرائط والتوجيه وتتبع عنوان العميل
 * تدعم الإحداثيات الدقيقة وروابط خرائط Google والعناوين النصية
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapLocationOptions {
  lat?: string | number | null;
  lng?: string | number | null;
  address?: string | null;
  label?: string;
  mode?: 'navigate' | 'search';
}

/**
 * تحليل واستخراج الإحداثيات من الأرقام أو النصوص أو روابط الخرائط
 */
export function extractCoordinates(
  lat?: string | number | null,
  lng?: string | number | null,
  fallbackText?: string | null
): Coordinates | null {
  // 1. التحقق من المدخلات المباشرة
  if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
    const parsedLat = typeof lat === 'number' ? lat : parseFloat(String(lat).trim());
    const parsedLng = typeof lng === 'number' ? lng : parseFloat(String(lng).trim());

    if (
      !isNaN(parsedLat) &&
      !isNaN(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180 &&
      !(parsedLat === 0 && parsedLng === 0)
    ) {
      return { lat: parsedLat, lng: parsedLng };
    }
  }

  // 2. البحث عن الإحداثيات داخل النص إن وجد
  if (fallbackText && typeof fallbackText === 'string') {
    const text = fallbackText.trim();

    // البحث عن نمط @lat,lng
    const atMatch = text.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (atMatch) {
      const pLat = parseFloat(atMatch[1]);
      const pLng = parseFloat(atMatch[2]);
      if (!isNaN(pLat) && !isNaN(pLng)) return { lat: pLat, lng: pLng };
    }

    // البحث عن نمط q=lat,lng أو query=lat,lng
    const qMatch = text.match(/[?&](?:q|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (qMatch) {
      const pLat = parseFloat(qMatch[1]);
      const pLng = parseFloat(qMatch[2]);
      if (!isNaN(pLat) && !isNaN(pLng)) return { lat: pLat, lng: pLng };
    }

    // البحث عن رقمين عشريين مفصولين بفاصلة: 15.354, 44.182
    const coordMatch = text.match(/(-?\d{1,2}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)/);
    if (coordMatch) {
      const pLat = parseFloat(coordMatch[1]);
      const pLng = parseFloat(coordMatch[2]);
      if (
        !isNaN(pLat) &&
        !isNaN(pLng) &&
        pLat >= -90 &&
        pLat <= 90 &&
        pLng >= -180 &&
        pLng <= 180
      ) {
        return { lat: pLat, lng: pLng };
      }
    }
  }

  return null;
}

/**
 * توليد رابط خرائط Google المناسب للتوجيه أو البحث
 */
export function getGoogleMapsUrl(options: MapLocationOptions): string {
  const { lat, lng, address, mode = 'navigate' } = options;

  // فحص ما إذا كان العنوان رابطاً جاهزاً لخرائط Google
  if (address && typeof address === 'string') {
    const trimmed = address.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.includes('maps.google.com') ||
      trimmed.includes('goo.gl/maps') ||
      trimmed.includes('maps.app.goo.gl')
    ) {
      return trimmed;
    }
  }

  const coords = extractCoordinates(lat, lng, address);

  if (coords) {
    if (mode === 'navigate') {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }

  if (address && address.trim()) {
    const encoded = encodeURIComponent(address.trim());
    if (mode === 'navigate') {
      return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  }

  // صنعاء كافتراضي في حال عدم وجود أي بيانات
  return `https://www.google.com/maps/search/?api=1&query=15.3694,44.1910`;
}

/**
 * فتح خرائط Google بأمان على أجهزة الموبايل والمتصفحات والـ PWA
 */
export function openInGoogleMaps(options: MapLocationOptions): void {
  const url = getGoogleMapsUrl(options);

  try {
    // محاولة الفتح عبر إنشاء عنصر رابط والنقر عليه لتفادي حظر النوافذ المنبثقة
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.warn('Fallback window.open:', e);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = url;
    }
  }
}

/**
 * هل توجد إمكانية لتتبع الموقع (إحداثيات أو عنوان غير فارغ)
 */
export function hasTrackableLocation(
  lat?: string | number | null,
  lng?: string | number | null,
  address?: string | null
): boolean {
  if (extractCoordinates(lat, lng, address)) return true;
  if (address && typeof address === 'string' && address.trim().length > 0) return true;
  return false;
}
