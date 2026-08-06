// @ts-nocheck
import express from 'express';
import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import { normalizeYemeniPhone, validateYemeniPhone } from '../../shared/phoneUtils.js';

const router = express.Router();

// فحص حالة الإعداد الأولي - هل توجد حسابات في قاعدة البيانات؟
router.get('/setup-status', async (req, res) => {
  try {
    const driversList = await storage.getDrivers().catch(() => []);
    const usersList = await storage.getUsers().catch(() => []);

    res.json({
      adminExists: true,
      driverExists: driversList.length > 0,
      userExists: usersList.length > 0,
    });
  } catch (error) {
    res.json({ adminExists: true, driverExists: true, userExists: true });
  }
});

// دالة مساعدة للتحقق من كلمة المرور - تدعم كل من كلمات المرور المشفرة والعادية
async function verifyPassword(inputPassword: string, storedPassword: string): Promise<boolean> {
  if (!inputPassword || !storedPassword) return false;
  
  const isBcryptHash = storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2y$');
  
  if (isBcryptHash) {
    return await bcrypt.compare(inputPassword, storedPassword);
  } else {
    return inputPassword === storedPassword;
  }
}

// دالة لتشفير كلمة المرور وتحديثها في قاعدة البيانات إذا كانت غير مشفرة
async function upgradePasswordIfNeeded(
  storedPassword: string,
  inputPassword: string,
  updateFn: (hashedPassword: string) => Promise<void>
): Promise<void> {
  const isBcryptHash = storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2y$');
  if (!isBcryptHash) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(inputPassword, salt);
      await updateFn(hashedPassword);
      console.log('🔒 تم ترقية كلمة المرور إلى هاش bcrypt تلقائياً');
    } catch (err) {
      console.error('⚠️ فشل في ترقية كلمة المرور:', err);
    }
  }
}

// تسجيل الدخول للعملاء
router.post('/login', async (req, res) => {
  try {
    const rawIdentifier = req.body?.identifier;
    const rawPassword = req.body?.password;

    if (!rawIdentifier || !rawPassword) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم/الهاتف وكلمة المرور مطلوبان'
      });
    }

    const arabicToLatinDigits = (s: string) =>
      s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
       .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

    const identifier = arabicToLatinDigits(String(rawIdentifier).trim());
    const password = String(rawPassword);

    console.log('🔐 محاولة تسجيل دخول عميل:', identifier);

    const user = await storage.findUserByIdentifier(identifier);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير مفعل'
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password || '');

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    await upgradePasswordIfNeeded(user.password || '', password, async (hashedPwd) => {
      await storage.updateUser(user.id, { password: hashedPwd });
    });

    const token = user.id;
    console.log('🎉 تم تسجيل الدخول بنجاح للعميل:', user.name);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        userType: 'customer'
      },
      message: 'تم تسجيل الدخول بنجاح'
    });

  } catch (error) {
    console.error('خطأ في تسجيل دخول العميل:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// التحقق من صحة الرمز وجلب بيانات المستخدم
router.post('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'جلسة غير صالحة' });
    }

    const user = await storage.getUserById(token);
    if (user) {
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'الحساب غير مفعل' });
      }
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          userType: 'customer',
          isActive: user.isActive
        }
      });
    }

    const driver = await storage.getDriverById(token);
    if (driver) {
      return res.json({
        success: true,
        user: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          userType: 'driver'
        }
      });
    }

    const admin = await storage.getAdminById(token);
    if (admin) {
      return res.json({
        success: true,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          userType: admin.userType
        }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'جلسة غير صالحة'
    });
  } catch (error) {
    console.error('خطأ في التحقق من الرمز:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// التحقق من صحة رقم الهاتف اليمني
function validateYemeniPhone(phone: string): string | null {
  if (!phone) return 'رقم الهاتف مطلوب';
  if (!/^\d{9}$/.test(phone)) return 'رقم الهاتف يجب أن يتكون من 9 أرقام بالضبط';
  if (!/^(77|78|71|70|73)/.test(phone)) return 'رقم الهاتف يجب أن يبدأ بـ 77 أو 78 أو 71 أو 70 أو 73';
  return null;
}

interface OtpRecord {
  code: string;
  expiresAt: number;
  verified: boolean;
}

const otpStore = new Map<string, OtpRecord>();

// إرسال رمز التحقق OTP لرقم الهاتف
router.post('/send-otp', async (req, res) => {
  try {
    const arabicToLatinDigits = (s: string) =>
      s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
       .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

    const rawPhone = req.body?.phone || '';
    const purpose = req.body?.purpose || 'register';
    const phone = arabicToLatinDigits(String(rawPhone).trim()).replace(/\s+/g, '');

    const phoneError = validateYemeniPhone(phone);
    if (phoneError) {
      return res.status(400).json({ success: false, message: phoneError });
    }

    if (purpose === 'register') {
      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'رقم الهاتف مسجل مسبقاً لحساب آخر'
        });
      }
    }

    // جلب إعدادات القناة والرمز من لوحة التحكم
    const enableOtpSetting = await storage.getUiSetting('enable_otp');
    const isOtpEnabled = enableOtpSetting ? enableOtpSetting.value !== 'false' : true;

    const otpChannelSetting = await storage.getUiSetting('otp_channel');
    const otpChannel = otpChannelSetting?.value || 'whatsapp';

    // إذا كانت ميزة OTP معطلة من لوحة التحكم
    if (!isOtpEnabled || otpChannel === 'disabled') {
      otpStore.set(phone, { code: '0000', expiresAt, verified: true });
      return res.json({
        success: true,
        disabled: true,
        message: 'تم تخطي رمز التحقق تلقائياً حسب إعدادات لوحة التحكم',
        phone
      });
    }

    // توليد رمز من 4 أرقام
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 دقائق

    otpStore.set(phone, { code, expiresAt, verified: false });

    const whatsappNumberSetting = await storage.getUiSetting('otp_whatsapp_number');
    const whatsappSender = whatsappNumberSetting?.value || '967777777777';

    const smsUrlSetting = await storage.getUiSetting('otp_sms_provider_url');
    const smsGatewayUrl = smsUrlSetting?.value || '';

    // إرسال SMS إذا توفر رابط البوابة
    if (smsGatewayUrl && (otpChannel === 'sms' || otpChannel === 'both')) {
      try {
        const targetUrl = smsGatewayUrl
          .replace('{phone}', encodeURIComponent(phone))
          .replace('{code}', encodeURIComponent(code));
        fetch(targetUrl).catch(err => console.error('خطأ إرسال SMS عبر البوابة:', err));
      } catch (e) {
        console.error('فشل إعداد رابط SMS:', e);
      }
    }

    // تجهيز رابط الواتساب المباشر بالرسالة الجاهزة
    const waMessage = encodeURIComponent(`مرحباً بك في السريع ون 🛵\nرمز التحقق الخاص بك هو: ${code}\nيرجى إدخاله لإنشاء حسابك بنجاح.`);
    const yemenPhoneWithCountryCode = phone.startsWith('967') ? phone : `967${phone}`;
    const whatsappUrl = `https://wa.me/${yemenPhoneWithCountryCode}?text=${waMessage}`;

    console.log(`📱 [OTP] القناة المفعلة: ${otpChannel} | الرقم ${phone} | الكود: ${code}`);

    res.json({
      success: true,
      message: `تم إرسال رمز التحقق إلى الرقم ${phone}`,
      phone,
      channel: otpChannel,
      whatsappUrl,
      whatsappSender,
      otpCode: code
    });
  } catch (error) {
    console.error('خطأ في إرسال رمز التحقق:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// التحقق من رمز OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const arabicToLatinDigits = (s: string) =>
      s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
       .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

    const rawPhone = req.body?.phone || '';
    const rawCode = req.body?.code || '';
    const phone = arabicToLatinDigits(String(rawPhone).trim()).replace(/\s+/g, '');
    const code = arabicToLatinDigits(String(rawCode).trim());

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'رقم الهاتف ورمز التحقق مطلوبان' });
    }

    const record = otpStore.get(phone);
    if (!record) {
      return res.status(400).json({ success: false, message: 'لم يتم طلب رمز تحقق لهذا الرقم أو انتهت صلاحيته' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, message: 'رمز التحقق منتهي الصلاحية، يرجى طلب رمز جديد' });
    }

    if (record.code !== code) {
      return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح' });
    }

    record.verified = true;
    otpStore.set(phone, record);

    res.json({
      success: true,
      message: 'تم التحقق من رقم الهاتف بنجاح',
      phone
    });
  } catch (error) {
    console.error('خطأ في التحقق من رمز OTP:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// تسجيل عميل جديد
router.post('/register', async (req, res) => {
  try {
    const arabicToLatinDigits = (s: string) =>
      s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
       .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

    let rawName = req.body?.name || '';
    let rawPhone = req.body?.phone || '';
    let rawPassword = req.body?.password || '';
    let rawUsername = req.body?.username || '';
    let rawEmail = req.body?.email || '';
    let rawOtpCode = req.body?.otpCode || '';

    const name = String(rawName).trim();
    const phone = arabicToLatinDigits(String(rawPhone).trim()).replace(/\s+/g, '');
    const password = String(rawPassword);
    const email = String(rawEmail).trim().toLowerCase();
    const otpCode = arabicToLatinDigits(String(rawOtpCode).trim());

    if (!name) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال الاسم بالكامل' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال رقم الهاتف' });
    }

    const phoneError = validateYemeniPhone(phone);
    if (phoneError) {
      return res.status(400).json({ success: false, message: phoneError });
    }

    if (!password || password.length < 3) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن لا تقل عن 3 أحرف' });
    }

    const existingPhoneUser = await storage.getUserByPhone(phone);
    if (existingPhoneUser) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مسجل مسبقاً لحساب آخر'
      });
    }

    // التحقق من حالة OTP
    const otpRecord = otpStore.get(phone);
    if (!otpRecord || (!otpRecord.verified && otpRecord.code !== otpCode)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى التحقق من رقم الهاتف باستخدام رمز OTP أولاً'
      });
    }

    let username = rawUsername ? String(rawUsername).trim().slice(0, 50) : name.slice(0, 50);
    if (!username) {
      username = phone;
    }

    const existingUsernameUser = await storage.getUserByUsername(username);
    if (existingUsernameUser) {
      username = phone;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await storage.createUser({
      name,
      phone,
      password: hashedPassword,
      username,
      email: email || undefined,
      isActive: true,
    });

    // مسح الرمز بعد استخدام النجاح
    otpStore.delete(phone);

    const token = newUser.id;

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        userType: 'customer'
      },
      message: 'تم إنشاء الحساب بنجاح'
    });
  } catch (error: any) {
    console.error('خطأ في تسجيل عميل جديد:', error);
    res.status(400).json({
      success: false,
      message: error?.message || 'تعذر إنشاء الحساب، يرجى التأكد من البيانات والمحاولة مجدداً'
    });
  }
});

// تسجيل الدخول عبر التواصل الاجتماعي (Google / Apple)
router.post('/social-login', async (req, res) => {
  try {
    const { provider, socialId, email, name, phone } = req.body;

    if (!provider || !socialId) {
      return res.status(400).json({
        success: false,
        message: 'مزود الخدمة ومعرف التواصل الاجتماعي مطلوبان'
      });
    }

    console.log(`🔐 محاولة تسجيل دخول اجتماعي (${provider}):`, socialId);

    const allUsers = await storage.getUsers();
    let user = allUsers.find(u => provider === 'google' ? u.googleId === socialId : u.appleId === socialId);

    if (!user && email) {
      user = allUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        const updateData: any = {};
        if (provider === 'google') updateData.googleId = socialId;
        if (provider === 'apple') updateData.appleId = socialId;
        await storage.updateUser(user.id, updateData);
      }
    }

    if (!user) {
      user = await storage.createUser({
        name: name || 'مستخدم جديد',
        email: email || undefined,
        phone: phone || '770000000',
        username: phone || socialId.slice(0, 20),
        googleId: provider === 'google' ? socialId : undefined,
        appleId: provider === 'apple' ? socialId : undefined,
        isActive: true,
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير مفعل'
      });
    }

    const token = user.id;
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType: 'customer'
      },
      message: 'تم تسجيل الدخول بنجاح'
    });

  } catch (error) {
    console.error('خطأ في تسجيل الدخول الاجتماعي:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// تسجيل الدخول للمديرين
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailInput = email ? String(email).trim() : '';
    const passInput = password ? String(password).trim() : '';

    if (!emailInput || !passInput) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني/اسم المستخدم/رقم الهاتف وكلمة المرور مطلوبان'
      });
    }

    console.log('🔐 محاولة تسجيل دخول مدير:', emailInput);

    const admin = (await storage.getAdminByEmail(emailInput)) || (await storage.getAdminByPhone(emailInput));

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير مفعل'
      });
    }

    const isPasswordValid = await verifyPassword(passInput, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    const token = admin.id;
    console.log('🎉 تم تسجيل الدخول بنجاح للمدير:', admin.name);

    let permissions: string[] = [];
    try {
      permissions = admin.permissions ? JSON.parse(admin.permissions) : [];
    } catch {}

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        userType: admin.userType,
        permissions,
      },
      message: 'تم تسجيل الدخول بنجاح'
    });

  } catch (error) {
    console.error('خطأ في تسجيل دخول المدير:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// تسجيل الدخول للسائقين
router.post('/driver/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف وكلمة المرور مطلوبان'
      });
    }

    console.log('🔐 محاولة تسجيل دخول سائق:', phone);

    const driversList = await storage.getDrivers();
    const driver = driversList.find(d => d.phone === phone);

    if (!driver) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    if (!driver.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير مفعل'
      });
    }

    const isPasswordValid = await verifyPassword(password, driver.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    const token = driver.id;
    console.log('🎉 تم تسجيل الدخول بنجاح للسائق:', driver.name);

    res.json({
      success: true,
      token,
      user: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        userType: 'driver'
      },
      message: 'تم تسجيل الدخول بنجاح'
    });

  } catch (error) {
    console.error('خطأ في تسجيل دخول السائق:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// تسجيل الخروج
router.post('/logout', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    });
  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

export default router;
