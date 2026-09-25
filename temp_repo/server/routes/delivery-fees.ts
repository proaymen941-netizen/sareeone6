/**
 * مسارات API لرسوم التوصيل
 * Delivery Fee API Routes
 */

// @ts-nocheck
import express from "express";
import { storage } from "../storage";
import { calculateDeliveryFee, calculateDistance, estimateDeliveryTime } from "../services/deliveryFeeService";
import { deliveryFeeCache } from "../utils/cache";
import { z } from "zod";
import { coerceRequestData } from "../utils/coercion";
import { broadcastSettingsChanged } from "../broadcast";
import { 
  insertGeoZoneSchema, 
  insertDeliveryRuleSchema, 
  insertDeliveryDiscountSchema 
} from "@shared/schema";

const router = express.Router();

router.post("/calculate", async (req, res) => {
  try {
    const { customerLat, customerLng, customerLocation, restaurantId, orderSubtotal } = req.body;

    const lat = customerLat !== undefined && customerLat !== null 
      ? parseFloat(customerLat) 
      : (customerLocation?.lat !== undefined ? parseFloat(customerLocation.lat) : NaN);

    const lng = customerLng !== undefined && customerLng !== null 
      ? parseFloat(customerLng) 
      : (customerLocation?.lng !== undefined ? parseFloat(customerLocation.lng) : NaN);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        error: "بيانات ناقصة",
        details: "يجب توفير إحداثيات العميل (lat و lng)"
      });
    }

    const subtotal = parseFloat(orderSubtotal || '0');
    
    const cacheKey = deliveryFeeCache.generateKey(
      Math.round(lat * 1000),
      Math.round(lng * 1000),
      restaurantId,
      Math.round(subtotal)
    );

    let result = deliveryFeeCache.get(cacheKey);
    
    if (!result) {
      result = await calculateDeliveryFee(
        { lat, lng },
        restaurantId || null,
        subtotal
      );
      deliveryFeeCache.set(cacheKey, result);
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('خطأ في حساب رسوم التوصيل:', error);
    res.status(500).json({ error: error.message || "خطأ في الخادم" });
  }
});

// حساب المسافة بين نقطتين
router.post("/distance", async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.body;

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({
        error: "بيانات ناقصة",
        details: "يجب توفير إحداثيات النقطتين"
      });
    }

    const distance = calculateDistance(
      { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
      { lat: parseFloat(toLat), lng: parseFloat(toLng) }
    );

    const estimatedTime = estimateDeliveryTime(distance);

    res.json({
      success: true,
      distance,
      unit: 'km',
      estimatedTime
    });
  } catch (error: any) {
    console.error('خطأ في حساب المسافة:', error);
    res.status(500).json({ error: error.message || "خطأ في الخادم" });
  }
});

// جلب إعدادات رسوم التوصيل
router.get("/settings", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const settings = await storage.getDeliveryFeeSettings(restaurantId as string);
    
    if (!settings) {
      // إرجاع الإعدادات الافتراضية
      return res.json({
        type: 'per_km',
        baseFee: '5',
        perKmFee: '2',
        minFee: '3',
        maxFee: '50',
        freeDeliveryThreshold: '0',
        isDefault: true
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('خطأ في جلب إعدادات رسوم التوصيل:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إنشاء أو تحديث إعدادات رسوم التوصيل (للمدير)
router.post("/settings", async (req, res) => {
  try {
    console.log('📥 تم استقبال طلب حفظ إعدادات التوصيل:', JSON.stringify(req.body, null, 2));
    
    const coercedData = coerceRequestData(req.body);
    console.log('🔄 البيانات بعد التحويل:', JSON.stringify(coercedData, null, 2));
    
    const settingsSchema = z.object({
      type: z.enum(['fixed', 'per_km', 'zone_based', 'geo_zone', 'hybrid', 'restaurant_custom'])
        .refine(val => val, { message: 'نوع الحساب مطلوب' }),
      baseFee: z.string().optional(),
      perKmFee: z.string().optional(),
      minFee: z.string().optional(),
      maxFee: z.string().optional(),
      freeDeliveryThreshold: z.string().optional(),
      restaurantId: z.string().optional()
    });

    const validatedData = settingsSchema.parse(coercedData);
    console.log('✅ البيانات تم التحقق منها بنجاح:', JSON.stringify(validatedData, null, 2));
    
    // التحقق من صحة القيم الرقمية
    const validateNumber = (value: string | undefined, fieldName: string): string => {
      if (!value || value === '') {
        console.log(`⚠️ ${fieldName} فارغة - سيتم استخدام القيمة الافتراضية 0`);
        return '0';
      }
      const num = parseFloat(value);
      if (isNaN(num)) {
        const errorMsg = `❌ ${fieldName} = "${value}" ليست قيمة رقمية صحيحة`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      if (num < 0) {
        const errorMsg = `❌ ${fieldName} يجب أن تكون قيمة موجبة أو صفر، القيمة المدخلة: ${num}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      console.log(`✓ ${fieldName}: ${value} → ${num}`);
      return num.toString();
    };

    const restId = (validatedData.restaurantId && validatedData.restaurantId.trim() !== '') ? validatedData.restaurantId : undefined;

    const sanitizedData = {
      ...validatedData,
      restaurantId: restId,
      baseFee: validateNumber(validatedData.baseFee, 'الرسوم الأساسية'),
      perKmFee: validateNumber(validatedData.perKmFee, 'رسوم لكل كيلومتر'),
      minFee: validateNumber(validatedData.minFee, 'الحد الأدنى'),
      maxFee: validateNumber(validatedData.maxFee, 'الحد الأقصى'),
      freeDeliveryThreshold: validateNumber(validatedData.freeDeliveryThreshold, 'حد التوصيل المجاني'),
    };

    console.log('🧹 البيانات بعد التنظيف:', JSON.stringify(sanitizedData, null, 2));

    // التحقق من أن maxFee أكبر من أو يساوي minFee
    const minFeeNum = parseFloat(sanitizedData.minFee || '0');
    const maxFeeNum = parseFloat(sanitizedData.maxFee || '1000');
    
    console.log(`📊 التحقق من الحدود: minFee=${minFeeNum}, maxFee=${maxFeeNum}`);
    
    if (maxFeeNum < minFeeNum) {
      const errorMsg = `❌ الحد الأقصى (${maxFeeNum}) يجب أن يكون أكبر من أو يساوي الحد الأدنى (${minFeeNum})`;
      console.error(errorMsg);
      return res.status(400).json({
        success: false,
        error: "بيانات غير صحيحة",
        field: "maxFee",
        message: errorMsg,
        details: {
          minFee: minFeeNum,
          maxFee: maxFeeNum,
          issue: "الحد الأقصى أقل من الحد الأدنى"
        }
      });
    }

    // التحقق من أن القيم معقولة
    if (maxFeeNum > 100000) {
      console.warn(`⚠️ تحذير: الحد الأقصى (${maxFeeNum}) يبدو مرتفعاً جداً`);
    }
    
    // التحقق من وجود إعدادات سابقة
    console.log(`🔍 البحث عن إعدادات سابقة للمطعم: ${sanitizedData.restaurantId || 'عام'}`);
    const existing = await storage.getDeliveryFeeSettings(sanitizedData.restaurantId);
    
    if (existing) {
      console.log(`📝 تحديث الإعدادات الموجودة: ${existing.id}`);
      const updated = await storage.updateDeliveryFeeSettings(existing.id, sanitizedData);
      console.log(`✅ تم التحديث بنجاح`);
      // مسح كاش رسوم التوصيل وإرسال broadcast للتحديث الفوري
      deliveryFeeCache.clear();
      broadcastSettingsChanged('delivery_fee_settings');
      return res.json({ 
        success: true, 
        message: 'تم تحديث الإعدادات بنجاح',
        settings: updated 
      });
    }

    console.log(`✨ إنشاء إعدادات جديدة`);
    const newSettings = await storage.createDeliveryFeeSettings(sanitizedData);
    console.log(`✅ تم الإنشاء بنجاح`);
    // مسح كاش رسوم التوصيل وإرسال broadcast للتحديث الفوري
    deliveryFeeCache.clear();
    broadcastSettingsChanged('delivery_fee_settings');
    res.status(201).json({ 
      success: true, 
      message: 'تم حفظ الإعدادات بنجاح',
      settings: newSettings 
    });
  } catch (error: any) {
    console.error('💥 خطأ في حفظ إعدادات رسوم التوصيل:', error);
    
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => ({
        field: e.path.join('.') || 'unknown',
        message: e.message,
        code: e.code
      }));
      console.error('❌ أخطاء Zod validation:', JSON.stringify(errorDetails, null, 2));
      
      return res.status(400).json({
        success: false,
        error: "خطأ في البيانات المدخلة",
        validationErrors: errorDetails,
        hint: "تحقق من أن جميع الحقول تحتوي على قيم صحيحة"
      });
    }
    
    if (error.message && error.message.includes('يجب أن يكون')) {
      return res.status(400).json({
        success: false,
        error: "خطأ في القيم المدخلة",
        message: error.message,
        hint: "تأكد من إدخال أرقام صحيحة في جميع الحقول"
      });
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('❌ عدم القدرة على الاتصال بقاعدة البيانات');
      return res.status(500).json({
        success: false,
        error: "خطأ في الاتصال",
        message: "تعذر الاتصال بقاعدة البيانات",
        hint: "تأكد من أن خادم قاعدة البيانات يعمل"
      });
    }

    return res.status(400).json({ 
      success: false,
      error: "خطأ في حفظ الإعدادات",
      message: error.message || "حدث خطأ غير متوقع",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hint: "تحقق من وحدة التحكم (Console) لمزيد من التفاصيل"
    });
  }
});

// جلب مناطق التوصيل
router.get("/zones", async (req, res) => {
  try {
    const zones = await storage.getDeliveryZones();
    res.json(zones);
  } catch (error) {
    console.error('خطأ في جلب مناطق التوصيل:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إضافة منطقة توصيل جديدة
router.post("/zones", async (req, res) => {
  try {
    const zoneSchema = z.object({
      name: z.string().min(1, "اسم المنطقة مطلوب"),
      description: z.string().optional(),
      minDistance: z.string().optional(),
      maxDistance: z.string(),
      deliveryFee: z.string(),
      estimatedTime: z.string().optional(),
      isActive: z.boolean().optional()
    });

    const validatedData = zoneSchema.parse(req.body);
    const newZone = await storage.createDeliveryZone(validatedData);
    
    // تفريغ الكاش لضمان تطبيق التغييرات فوراً للعملاء
    deliveryFeeCache.clear();

    res.status(201).json({ success: true, zone: newZone });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "بيانات غير صحيحة",
        details: error.errors
      });
    }
    console.error('خطأ في إضافة منطقة التوصيل:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث منطقة توصيل (دعم PUT و PATCH)
const handleUpdateDeliveryZone = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updated = await storage.updateDeliveryZone(id, req.body);
    
    if (!updated) {
      return res.status(404).json({ error: "المنطقة غير موجودة" });
    }

    // تفريغ الكاش لضمان تطبيق التغييرات فوراً للعملاء
    deliveryFeeCache.clear();

    res.json({ success: true, zone: updated, message: "تم تحديث شريحة المسافة بنجاح" });
  } catch (error) {
    console.error('خطأ في تحديث منطقة التوصيل:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
};
router.put("/zones/:id", handleUpdateDeliveryZone);
router.patch("/zones/:id", handleUpdateDeliveryZone);

// حذف منطقة توصيل
router.delete("/zones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteDeliveryZone(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "المنطقة غير موجودة" });
    }

    // تفريغ الكاش لضمان تطبيق التغييرات فوراً للعملاء
    deliveryFeeCache.clear();

    res.json({ success: true, message: "تم حذف المنطقة بنجاح" });
  } catch (error) {
    console.error('خطأ في حذف منطقة التوصيل:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إنشاء شرائح المسافة الافتراضية بنقرة واحدة
router.post("/zones/seed-defaults", async (req, res) => {
  try {
    const defaultZones = [
      { name: "القريبة (0 - 3 كم)", minDistance: "0", maxDistance: "3", deliveryFee: "500", estimatedTime: "15-25 دقيقة", description: "المناطق المجاورة للمتجر مباشرة" },
      { name: "المتوسطة (3 - 7 كم)", minDistance: "3", maxDistance: "7", deliveryFee: "1000", estimatedTime: "25-40 دقيقة", description: "الأحياء والمدن المحيطة القريبة" },
      { name: "البعيدة (7 - 12 كم)", minDistance: "7", maxDistance: "12", deliveryFee: "1500", estimatedTime: "40-60 دقيقة", description: "أطراف المدينة" },
      { name: "النائية (12 - 25 كم)", minDistance: "12", maxDistance: "25", deliveryFee: "2500", estimatedTime: "60-90 دقيقة", description: "المناطق الخارجية والضواحي" }
    ];

    const created = [];
    for (const z of defaultZones) {
      const zone = await storage.createDeliveryZone(z);
      created.push(zone);
    }

    deliveryFeeCache.clear();

    res.json({ success: true, message: "تم إنشاء شرائح المسافة الافتراضية بنجاح", count: created.length, zones: created });
  } catch (error: any) {
    console.error('خطأ في إنشاء الشرائح الافتراضية:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// --- Geo-Zones (Polygons & Map Areas) ---

router.get("/geo-zones", async (req, res) => {
  try {
    const zones = await storage.getGeoZones();
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب المناطق الجغرافية" });
  }
});

// إضافة منطقة جغرافية
router.post("/geo-zones", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertGeoZoneSchema.parse(coercedData);
    const zone = await storage.createGeoZone(validatedData);
    deliveryFeeCache.clear();
    res.status(201).json(zone);
  } catch (error: any) {
    console.error('خطأ في إضافة المنطقة الجغرافية:', error);
    res.status(400).json({ error: error.message || "بيانات المنطقة غير صحيحة" });
  }
});

// إنشاء مناطق جغرافية افتراضية لصنعاء والمدن
router.post("/geo-zones/seed-defaults", async (req, res) => {
  try {
    const defaultGeoZones = [
      {
        name: "منطقة حدة والسبعين",
        description: "حي حدة وشارع السبعين والمناطق السكنية والتجارية الراقية",
        deliveryFee: "1000",
        surgeMultiplier: "1.00",
        coordinates: JSON.stringify({
          type: "circle",
          center: { lat: 15.3180, lng: 44.1950 },
          radiusKm: 4.5
        }),
        isActive: true
      },
      {
        name: "منطقة التحرير وصنعاء القديمة",
        description: "وسط العاصمة وصنعاء القديمة وباب اليمن",
        deliveryFee: "800",
        surgeMultiplier: "1.00",
        coordinates: JSON.stringify({
          type: "circle",
          center: { lat: 15.3550, lng: 44.2080 },
          radiusKm: 3.5
        }),
        isActive: true
      },
      {
        name: "منطقة مذبح وشارع الستين",
        description: "مذبح، الستين الغربي وجامعة صنعاء والمناطق المحيطة",
        deliveryFee: "1200",
        surgeMultiplier: "1.00",
        coordinates: JSON.stringify({
          type: "circle",
          center: { lat: 15.3780, lng: 44.1700 },
          radiusKm: 4.0
        }),
        isActive: true
      },
      {
        name: "منطقة الحصبة والمطار",
        description: "شمال صنعاء، الحصبة وشارع المطار وجولة آية",
        deliveryFee: "1500",
        surgeMultiplier: "1.10",
        coordinates: JSON.stringify({
          type: "circle",
          center: { lat: 15.4100, lng: 44.2150 },
          radiusKm: 5.0
        }),
        isActive: true
      }
    ];

    const created = [];
    for (const gz of defaultGeoZones) {
      const zone = await storage.createGeoZone(gz as any);
      created.push(zone);
    }

    deliveryFeeCache.clear();

    res.json({ success: true, message: "تم إنشاء المناطق الجغرافية الافتراضية بنجاح", count: created.length, zones: created });
  } catch (error: any) {
    console.error('خطأ في إنشاء المناطق الجغرافية الافتراضية:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث منطقة جغرافية (دعم PATCH و PUT)
const handleUpdateGeoZone = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertGeoZoneSchema.partial().parse(coercedData);
    const zone = await storage.updateGeoZone(id, validatedData);
    if (!zone) return res.status(404).json({ error: "المنطقة غير موجودة" });
    
    // تفريغ الكاش لضمان تطبيق التغييرات فوراً للعملاء
    deliveryFeeCache.clear();

    res.json({ success: true, zone, message: "تم تحديث المنطقة الجغرافية بنجاح" });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "بيانات المنطقة غير صحيحة" });
  }
};
router.patch("/geo-zones/:id", handleUpdateGeoZone);
router.put("/geo-zones/:id", handleUpdateGeoZone);

router.delete("/geo-zones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteGeoZone(id);
    if (!success) return res.status(404).json({ error: "المنطقة غير موجودة" });

    // تفريغ الكاش لضمان تطبيق التغييرات فوراً للعملاء
    deliveryFeeCache.clear();

    res.json({ success: true, message: "تم حذف المنطقة الجغرافية بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف المنطقة" });
  }
});

// --- Delivery Rules ---

router.get("/rules", async (req, res) => {
  try {
    const rules = await storage.getDeliveryRules();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب القواعد" });
  }
});

router.post("/rules", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertDeliveryRuleSchema.parse(coercedData);
    const rule = await storage.createDeliveryRule(validatedData);
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: "بيانات القاعدة غير صحيحة" });
  }
});

router.patch("/rules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertDeliveryRuleSchema.partial().parse(coercedData);
    const rule = await storage.updateDeliveryRule(id, validatedData);
    if (!rule) return res.status(404).json({ error: "القاعدة غير موجودة" });
    res.json(rule);
  } catch (error) {
    res.status(400).json({ error: "بيانات القاعدة غير صحيحة" });
  }
});

router.delete("/rules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteDeliveryRule(id);
    if (!success) return res.status(404).json({ error: "القاعدة غير موجودة" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "فشل حذف القاعدة" });
  }
});

// --- Delivery Discounts ---

router.get("/discounts", async (req, res) => {
  try {
    const discounts = await storage.getDeliveryDiscounts();
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الخصومات" });
  }
});

router.post("/discounts", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertDeliveryDiscountSchema.parse(coercedData);
    const discount = await storage.createDeliveryDiscount(validatedData);
    res.status(201).json(discount);
  } catch (error) {
    res.status(400).json({ error: "بيانات الخصم غير صحيحة" });
  }
});

router.patch("/discounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertDeliveryDiscountSchema.partial().parse(coercedData);
    const discount = await storage.updateDeliveryDiscount(id, validatedData);
    if (!discount) return res.status(404).json({ error: "الخصم غير موجود" });
    res.json(discount);
  } catch (error) {
    res.status(400).json({ error: "بيانات الخصم غير صحيحة" });
  }
});

router.delete("/discounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteDeliveryDiscount(id);
    if (!success) return res.status(404).json({ error: "الخصم غير موجود" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "فشل حذف الخصم" });
  }
});

// --- Delivery Zone Restriction (مناطق ونطاق التوصيل المسموح بها) ---

router.get("/zone-restriction", async (req, res) => {
  try {
    const uiSettings = await storage.getUiSettings();
    const map = new Map((uiSettings || []).map((s: any) => [s.key, s.value]));

    res.json({
      enableRestriction: map.get('enable_delivery_zone_restriction') === 'true',
      maxDistanceKm: parseFloat(map.get('max_delivery_distance_km') || '25'),
      restrictionMode: map.get('delivery_restriction_mode') || 'both',
      centerLat: parseFloat(map.get('store_lat') || map.get('delivery_center_lat') || '15.3694'),
      centerLng: parseFloat(map.get('store_lng') || map.get('delivery_center_lng') || '44.1910'),
    });
  } catch (error) {
    console.error('خطأ في جلب إعدادات تقييد نطاق التوصيل:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/zone-restriction", async (req, res) => {
  try {
    const { enableRestriction, maxDistanceKm, restrictionMode, centerLat, centerLng } = req.body;

    const saveSetting = async (key: string, val: string) => {
      if (typeof storage.setUiSetting === 'function') {
        await storage.setUiSetting(key, val);
      } else if (typeof storage.updateUiSetting === 'function') {
        await storage.updateUiSetting(key, val);
      }
    };

    if (enableRestriction !== undefined) {
      await saveSetting('enable_delivery_zone_restriction', enableRestriction ? 'true' : 'false');
    }
    if (maxDistanceKm !== undefined) {
      await saveSetting('max_delivery_distance_km', String(maxDistanceKm));
    }
    if (restrictionMode !== undefined) {
      await saveSetting('delivery_restriction_mode', String(restrictionMode));
    }
    if (centerLat !== undefined && centerLat !== null) {
      await saveSetting('delivery_center_lat', String(centerLat));
      await saveSetting('store_lat', String(centerLat));
    }
    if (centerLng !== undefined && centerLng !== null) {
      await saveSetting('delivery_center_lng', String(centerLng));
      await saveSetting('store_lng', String(centerLng));
    }

    // أيضاً تحديث إعدادات المتجر في جدول delivery_fee_settings لمطابقة الدبوس بدقة
    try {
      const existingSettings = await storage.getDeliveryFeeSettings();
      if (existingSettings && existingSettings.length > 0) {
        const updatePayload: any = {};
        if (centerLat !== undefined && centerLat !== null) updatePayload.storeLat = parseFloat(String(centerLat));
        if (centerLng !== undefined && centerLng !== null) updatePayload.storeLng = parseFloat(String(centerLng));
        if (Object.keys(updatePayload).length > 0) {
          await storage.updateDeliveryFeeSettings(existingSettings[0].id, updatePayload);
        }
      }
    } catch (syncErr) {
      console.warn('تنبيه: تعذر مزامنة موقع الدبوس مع جدول delivery_fee_settings:', syncErr);
    }

    // تفريغ كاش حساب الرسوم لضمان التطبيق اللحظي
    deliveryFeeCache.clear();

    // بث التحديث لجميع واجهات التطبيق المتصلة
    broadcastSettingsChanged();

    res.json({
      success: true,
      message: "تم حفظ وتحديث إعدادات نطاق ومناطق التوصيل المسموح بها بنجاح"
    });
  } catch (error: any) {
    console.error('خطأ في حفظ إعدادات تقييد نطاق التوصيل:', error);
    res.status(500).json({ error: error.message || "خطأ في الخادم" });
  }
});

export default router;
