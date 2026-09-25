/**
 * أداة إدارة الاتصال الصوتي والتواصل الآمن المتوافق مع تطبيقات Android WebView و PWA والمتصفحات
 */

export interface PhoneInfo {
  raw: string;
  display: string;
  cleanDigits: string;
  international: string;
}

export function formatYemenPhone(phoneStr: string): PhoneInfo {
  if (!phoneStr) {
    return { raw: '', display: '', cleanDigits: '', international: '' };
  }

  const digits = phoneStr.replace(/\D/g, '');
  let local = digits;
  let intl = digits;

  if (digits.startsWith('00967')) {
    intl = digits.substring(2);
    local = digits.substring(5);
  } else if (digits.startsWith('967')) {
    intl = digits;
    local = digits.substring(3);
  } else if (digits.startsWith('0')) {
    local = digits.substring(1);
    intl = '967' + local;
  } else {
    local = digits;
    intl = '967' + digits;
  }

  return {
    raw: phoneStr,
    display: local || phoneStr,
    cleanDigits: digits,
    international: intl
  };
}

/**
 * تنفيذ فتح لوحة الاتصال بطريقة آمنة
 * - في بيئة Android WebView، استخدام window.open("tel:...") أو window.location.href = "tel:..."
 *   يتسبب في خطأ net::ERR_UNKNOWN_URL_SCHEME أو شاشة بيضاء إذا لم يكن الـ WebView مهيأ لاعتراض tel:
 * - استخدام عنصر a غير مرئي مع كائن مؤقت، ومحاولة iframe مخفي كنسخة احتياطية،
 *   مما يضمن إرسال أمر الاتصال لنظام أندرويد دون تغيير صفحة الويب الحالية أو التسبب في شاشة بيضاء.
 */
export function safeTriggerPhoneCall(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  // تنظيف الرقم مع الحفاظ على علامة + في حال كانت موجودة في البداية
  const hasPlus = phoneNumber.trim().startsWith('+');
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  if (!cleaned) return false;

  const telUrl = `tel:${hasPlus ? '+' : ''}${cleaned}`;

  try {
    // 1. محاولة النقر عبر عنصر رابط a غير مرئي (الأنسب للمتصفحات الحديثة وPWA)
    const link = document.createElement('a');
    link.href = telUrl;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      } catch (_) {}
    }, 1000);
    return true;
  } catch (e) {
    console.warn('⚠️ محاولة فتح رابط الاتصال مباشرة تعذرت:', e);
  }

  try {
    // 2. استخدام iframe مخفي لتفادي ERR_UNKNOWN_URL_SCHEME والشاشات البيضاء على Android WebView
    let iframe = document.getElementById('driver-safe-tel-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'driver-safe-tel-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
    }
    iframe.src = telUrl;
    return true;
  } catch (e) {
    console.warn('⚠️ فشل تشغيل iframe للاتصال:', e);
    return false;
  }
}

/**
 * فتح تطبيق واتساب أو المحادثة بشكل آمن متوافق مع Android WebView دون شاشة بيضاء عند الإلغاء
 */
export function safeOpenWhatsApp(phoneNumber: string, message?: string): boolean {
  if (!phoneNumber) return false;
  const url = getWhatsAppLink(phoneNumber, message);
  try {
    // استخدام window.open مع _blank يضمن عدم مغادرة الصفحة الحالية أو حدوث شاشة بيضاء عند الضغط على "إلغاء"
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          if (a.parentNode) a.parentNode.removeChild(a);
        } catch (_) {}
      }, 500);
    }
    return true;
  } catch (e) {
    console.warn('⚠️ فشل فتح واتساب:', e);
    return false;
  }
}

/**
 * إنشاء رابط واتساب متوافق مع كافة الأنظمة
 */
export function getWhatsAppLink(phoneNumber: string, message?: string): string {
  const info = formatYemenPhone(phoneNumber);
  const target = info.international || phoneNumber.replace(/\D/g, '');
  const encoded = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${target}${encoded ? `?text=${encoded}` : ''}`;
}

/**
 * نسخ رقم الهاتف أو أي نص إلى الحافظة بنجاح
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  // Fallback for non-secure contexts or older WebViews
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
