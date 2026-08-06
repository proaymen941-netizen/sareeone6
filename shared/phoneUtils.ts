/**
 * أدوات للتعامل مع أرقام الهواتف اليمنية والتحقق منها
 * يدعم الأرقام المكونة من 9 أرقام والتي تبدأ بـ 71, 77, 78, 73, 70
 */

export function normalizeYemeniPhone(phone: string): string {
  if (!phone) return '';
  
  // تحويل الأرقام العربية والفارسية إلى أرقام إنجليزية
  let p = phone
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\s+/g, '')
    .replace(/[-+()]/g, '');

  // إزالة فتح الخط الدولي للليمن (+967 أو 00967 أو 967)
  if (p.startsWith('00967')) {
    p = p.slice(5);
  } else if (p.startsWith('967')) {
    p = p.slice(3);
  }

  // إزالة الصفر في البداية إن وجد (مثل 0771234567 -> 771234567)
  if (p.startsWith('0') && p.length === 10) {
    p = p.slice(1);
  }

  return p;
}

export function validateYemeniPhone(phone: string): string | null {
  const normalized = normalizeYemeniPhone(phone);
  
  if (!normalized) {
    return 'رقم الهاتف مطلوب';
  }
  
  if (!/^\d{9}$/.test(normalized)) {
    return 'رقم الهاتف يجب أن يتكون من 9 أرقام بالضبط';
  }
  
  if (!/^(71|77|78|73|70)/.test(normalized)) {
    return 'رقم الهاتف يجب أن يبدأ بـ 71 أو 77 أو 78 أو 73 أو 70';
  }
  
  return null;
}

export function isYemeniPhoneValid(phone: string): boolean {
  return validateYemeniPhone(phone) === null;
}
