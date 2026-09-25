import { storage } from '../storage';

export interface SendOtpResult {
  success: boolean;
  deliveryMethod: 'meta_cloud_api' | 'direct_link' | 'sms' | 'demo';
  messageId?: string;
  error?: string;
  whatsappUrl: string;
  whatsappSender: string;
  formattedPhone: string;
}

// الرمز الافتراضي المعتمد الذي وفره العميل
export const DEFAULT_WHATSAPP_ACCESS_TOKEN = "EAAPVxlflzSQBSVKE5MY8KZAjUZBrelzRulJ1X1n0aYhoJTZBgnvFCiUT5RlAdtQAS5jt3FUDnZC58F9HG1NuvwTQCgAs4hdjKkcM87LBZB7QasERpP1bMUhS91In3XruhOMRwKZBV324lwaXKfimMHD5O5GPbfrQ0W1TfIM0F210fwyKMBDtA7v52SFWVsrZCyZBMaebFiJYr1iXZACR9HW5xdn2QIOMZBxxEHCSy0KZCSDUJNN4aBj7URAMdM9VZAjmVKEk59rSZB4pZBZCPXsNslwRyURppuQ";
export const DEFAULT_WHATSAPP_PHONE_NUMBER_ID = "1334025846455164";
export const DEFAULT_WHATSAPP_WABA_ID = "2245913132898564";
export const DEFAULT_WHATSAPP_SENDER_NUMBER = "+1 (555) 197-1367";

/**
 * تنسيق رقم الهاتف ليصبح بالصيغة الدولية المعتمدة لواتساب (E.164 بدون علامة +)
 * مثال: 777123456 -> 967777123456
 */
export function formatPhoneForWhatsApp(rawPhone: string): string {
  // إزالة أي رموز غير رقمية وتحويل الأرقام العربية إلى إنجليزية
  const arabicToLatin = (s: string) =>
    s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
     .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

  let cleaned = arabicToLatin(String(rawPhone || '')).replace(/[^0-9]/g, '');

  // إزالة الأصفار في البداية (مثل 00967 أو 077...)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }

  // إضافة مفتاح اليمن إذا لم يكن موجوداً
  if (!cleaned.startsWith('967') && cleaned.length === 9) {
    cleaned = `967${cleaned}`;
  }

  return cleaned;
}

/**
 * إرسال رمز التحقق عبر واتساب (سواء عبر Meta WhatsApp Cloud API أو الرابط الذكي)
 */
export async function sendWhatsAppOtp({
  phone,
  code,
  purpose = 'register'
}: {
  phone: string;
  code: string;
  purpose?: 'register' | 'reset' | 'verify';
}): Promise<SendOtpResult> {
  const formattedPhone = formatPhoneForWhatsApp(phone);

  // جلب إعدادات الواتساب من قاعدة البيانات
  const accessTokenSetting = await storage.getUiSetting('whatsapp_access_token');
  const phoneNumberIdSetting = await storage.getUiSetting('whatsapp_phone_number_id');
  const senderNumberSetting = await storage.getUiSetting('otp_whatsapp_number');
  const templateNameSetting = await storage.getUiSetting('whatsapp_template_name');

  const accessToken = accessTokenSetting?.value?.trim() || DEFAULT_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = phoneNumberIdSetting?.value?.trim() || DEFAULT_WHATSAPP_PHONE_NUMBER_ID;
  const whatsappSender = senderNumberSetting?.value?.trim() || DEFAULT_WHATSAPP_SENDER_NUMBER;
  const templateName = templateNameSetting?.value?.trim() || '';

  // نص الرسالة
  let messageText = '';
  if (purpose === 'reset') {
    messageText = `مرحباً بك في السريع ون 🛵\nرمز استعادة كلمة المرور الخاص بك هو: *${code}*\nصالح لمدة 10 دقائق. يرجى عدم مشاركته مع أي شخص.`;
  } else {
    messageText = `مرحباً بك في السريع ون 🛵\nرمز التحقق الخاص بك لإنشاء الحساب هو: *${code}*\nصالح لمدة 10 دقائق. لا تشارك هذا الرمز مع أي شخص.`;
  }

  const encodedMsg = encodeURIComponent(messageText);
  // رابط الواتساب المباشر للعميل
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMsg}`;

  // محاولة الإرسال عبر Meta Cloud API إذا تم توفير معرّف رقم الهاتف ورمز الوصول
  if (accessToken && phoneNumberId) {
    try {
      console.log(`🌐 [WhatsApp Cloud API] جاري إرسال رمز OTP إلى: ${formattedPhone} عبر معرّف: ${phoneNumberId}`);

      let payload: any;

      if (templateName) {
        // إرسال عبر قالب Meta معتمد
        // القوالب في Meta تدعم تمرير رمز التحقق كمتغير في الـ body
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateName === 'hello_world' ? 'en_US' : 'ar' },
            ...(templateName !== 'hello_world' ? {
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: code }
                  ]
                }
              ]
            } : {})
          }
        };
      } else {
        // إرسال كرسالة نصية مباشرة
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: {
            preview_url: false,
            body: messageText
          }
        };
      }

      const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const metaResult: any = await metaResponse.json().catch(() => ({}));

      if (metaResponse.ok && metaResult.messages && metaResult.messages[0]) {
        console.log(`✅ [WhatsApp Cloud API] تم إرسال رسالة OTP بنجاح! معرف الرسالة:`, metaResult.messages[0].id);
        return {
          success: true,
          deliveryMethod: 'meta_cloud_api',
          messageId: metaResult.messages[0].id,
          whatsappUrl,
          whatsappSender,
          formattedPhone
        };
      } else {
        const errorMsg = metaResult?.error?.message || metaResult?.error?.error_user_msg || `فشل الإرسال: رمز الاستجابة ${metaResponse.status}`;
        console.warn(`⚠️ [WhatsApp Cloud API] تنبيه استجابة Meta:`, JSON.stringify(metaResult));
        
        // في حال فشل الإرسال السحابي (مثل انتهاء صلاحية الرمز أو رقم الهاتف غير مسجل في الاختبار)، يتم الاعتماد على الرابط المباشر
        return {
          success: true, // نرجع true لكي يستمر العميل عبر الرابط المباشر للواتساب
          deliveryMethod: 'direct_link',
          error: errorMsg,
          whatsappUrl,
          whatsappSender,
          formattedPhone
        };
      }
    } catch (apiError: any) {
      console.error('❌ [WhatsApp Cloud API] خطأ أثناء الاتصال بسيرفر Meta:', apiError);
      return {
        success: true,
        deliveryMethod: 'direct_link',
        error: apiError?.message || 'تعذر الاتصال بواجهة Meta',
        whatsappUrl,
        whatsappSender,
        formattedPhone
      };
    }
  }

  // إذا لم يتوفر معرّف رقم الهاتف، يتم استخدام الرابط المباشر الذكي
  console.log(`📱 [WhatsApp Direct] استخدام الرابط المباشر للرقم: ${formattedPhone}`);
  return {
    success: true,
    deliveryMethod: 'direct_link',
    whatsappUrl,
    whatsappSender,
    formattedPhone
  };
}

/**
 * فحص صحة رمز الوصول ومعلومات حساب واتساب لدى Meta
 */
export async function verifyWhatsAppToken(token: string): Promise<{
  isValid: boolean;
  appName?: string;
  appId?: string;
  userName?: string;
  userId?: string;
  scopes?: string[];
  expiresAt?: string;
  error?: string;
}> {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { isValid: false, error: 'رمز الوصول مطلوب' };
    }

    const debugUrl = `https://graph.facebook.com/v20.0/debug_token?input_token=${cleanToken}&access_token=${cleanToken}`;
    const debugRes = await fetch(debugUrl);
    const debugData: any = await debugRes.json().catch(() => ({}));

    if (debugData?.data?.is_valid) {
      const data = debugData.data;
      const expiresAt = data.expires_at ? new Date(data.expires_at * 1000).toLocaleString('ar-YE') : 'دائم / طويل الأمد';

      return {
        isValid: true,
        appName: data.application || 'تطبيق واتساب للأعمال',
        appId: data.app_id,
        userId: data.user_id,
        scopes: data.scopes || [],
        expiresAt
      };
    } else {
      // تجربة فحص /me
      const meUrl = `https://graph.facebook.com/v20.0/me?access_token=${cleanToken}`;
      const meRes = await fetch(meUrl);
      const meData: any = await meRes.json().catch(() => ({}));

      if (meData?.id) {
        return {
          isValid: true,
          userName: meData.name,
          userId: meData.id
        };
      }

      return {
        isValid: false,
        error: debugData?.error?.message || 'رمز الوصول غير صالح أو منتهي الصلاحية'
      };
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: err?.message || 'تعذر التحقق من رمز الوصول'
    };
  }
}
