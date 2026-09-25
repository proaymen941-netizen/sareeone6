/**
 * خدمة حساب رسوم التوصيل
 * Delivery Fee Calculation Service
 * 
 * تدعم طرق متعددة لحساب رسوم التوصيل:
 * 1. رسوم ثابتة (fixed)
 * 2. حسب المسافة (per_km)
 * 3. حسب المناطق (zone_based)
 * 4. إعدادات المطعم الخاصة (restaurant_custom)
 */

import { storage } from "../storage";

// ثوابت افتراضية (بالريال السعودي)
const DEFAULT_BASE_FEE = 5;     // 5 ريال رسوم أساسية
const DEFAULT_PER_KM_FEE = 2;   // 2 ريال لكل كيلومتر
const DEFAULT_MIN_FEE = 3;      // 3 ريال حد أدنى
const DEFAULT_MAX_FEE = 50;     // 50 ريال حد أقصى
const EARTH_RADIUS_KM = 6371; // نصف قطر الأرض بالكيلومتر

export interface DeliveryLocation {
  lat: number;
  lng: number;
}

export interface DeliveryFeeResult {
  fee: number;
  distance: number;
  estimatedTime: string;
  calculationMethod: string;
  isOutsideDeliveryZone?: boolean;
  outsideReason?: string;
  feeBreakdown: {
    baseFee: number;
    distanceFee: number;
    totalBeforeLimit: number;
  };
  isFreeDelivery: boolean;
  freeDeliveryReason?: string;
  appliedRuleId?: string;
  appliedDiscountId?: string;
  matchedGeoZone?: {
    id: string;
    name: string;
    deliveryFee?: number;
    surgeMultiplier?: number;
  };
  matchedDeliveryZone?: {
    id: string;
    name: string;
    minDistance: string;
    maxDistance: string;
    deliveryFee: string;
  };
  appliedRule?: {
    id: string;
    name: string;
    ruleType: string;
    fee: string;
  };
  appliedDiscount?: {
    id: string;
    name: string;
    discountType: string;
    discountValue: string;
  };
  surgeMultiplierApplied?: number;
}

export interface DeliveryFeeSettings {
  type: 'fixed' | 'per_km' | 'zone_based' | 'geo_zone' | 'hybrid' | 'restaurant_custom';
  baseFee: number;
  perKmFee: number;
  minFee: number;
  maxFee: number;
  freeDeliveryThreshold: number;
  storeLat?: number;
  storeLng?: number;
}

/**
 * حساب المسافة بين نقطتين باستخدام صيغة Haversine
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  point1: DeliveryLocation,
  point2: DeliveryLocation
): number {
  const lat1Rad = toRadians(point1.lat);
  const lat2Rad = toRadians(point2.lat);
  const deltaLat = toRadians(point2.lat - point1.lat);
  const deltaLng = toRadians(point2.lng - point1.lng);

  const a = 
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  const distance = EARTH_RADIUS_KM * c;
  
  // تقريب إلى رقمين عشريين
  return Math.round(distance * 100) / 100;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * التحقق مما إذا كانت النقطة داخل مضلع (Geo-Zone)
 */
export function isPointInPolygon(point: DeliveryLocation, polygon: DeliveryLocation[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = point.lat, yi = point.lng;
    const x1 = polygon[i].lat, y1 = polygon[i].lng;
    const x2 = polygon[j].lat, y2 = polygon[j].lng;
    
    const intersect = ((y1 > yi) !== (y2 > yi)) &&
        (xi < (x2 - x1) * (yi - y1) / (y2 - y1) + x1);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * التحقق مما إذا كانت النقطة داخل منطقة جغرافية (سواء مضلع أو دائرة نصف قطر)
 */
export function isPointInGeoZone(point: DeliveryLocation, coordinatesStr: string): boolean {
  if (!coordinatesStr) return false;
  try {
    const data = JSON.parse(coordinatesStr);

    // 1. مضلع إحداثيات كمصفوفة نقاط [{lat, lng}, ...]
    if (Array.isArray(data)) {
      return isPointInPolygon(point, data);
    }

    // 2. كائن دائري أو مضلع مغلف
    if (data && typeof data === 'object') {
      if (data.type === 'circle' || data.center) {
        const center: DeliveryLocation = data.center || { lat: Number(data.lat), lng: Number(data.lng) };
        const radiusKm = Number(data.radiusKm || (data.radius ? Number(data.radius) / 1000 : 5));
        const dist = calculateDistance(point, center);
        return dist <= radiusKm;
      }
      if (Array.isArray(data.polygon)) {
        return isPointInPolygon(point, data.polygon);
      }
      if (Array.isArray(data.coordinates)) {
        return isPointInPolygon(point, data.coordinates);
      }
    }
  } catch (e) {
    console.error('فشل في قراءة إحداثيات المنطقة الجغرافية:', e);
  }
  return false;
}

/**
 * تقدير وقت التوصيل بناءً على المسافة
 * Estimate delivery time based on distance
 */
export function estimateDeliveryTime(distanceKm: number): string {
  // متوسط سرعة التوصيل: 30 كم/ساعة في المدينة
  const avgSpeedKmH = 30;
  // وقت التحضير المتوسط: 15 دقيقة
  const prepTimeMinutes = 15;
  
  const travelTimeMinutes = (distanceKm / avgSpeedKmH) * 60;
  const totalTimeMinutes = Math.ceil(prepTimeMinutes + travelTimeMinutes);
  
  // إضافة هامش زمني
  const minTime = totalTimeMinutes;
  const maxTime = Math.ceil(totalTimeMinutes * 1.3); // +30% هامش
  
  if (maxTime <= 30) {
    return `${minTime}-${maxTime} دقيقة`;
  } else if (maxTime <= 60) {
    return `${minTime}-${maxTime} دقيقة`;
  } else {
    const minHours = Math.floor(minTime / 60);
    const maxHours = Math.ceil(maxTime / 60);
    if (minHours === maxHours) {
      return `حوالي ${minHours} ساعة`;
    }
    return `${minHours}-${maxHours} ساعة`;
  }
}

/**
 * جلب إعدادات رسوم التوصيل مع جلب إعدادات النظام للقيم الافتراضية
 */
async function getDeliveryFeeSettings(): Promise<DeliveryFeeSettings> {
  let baseFee = DEFAULT_BASE_FEE;
  let perKmFee = DEFAULT_PER_KM_FEE;
  let minFee = DEFAULT_MIN_FEE;
  let maxFee = DEFAULT_MAX_FEE;
  let freeDeliveryThreshold = 0;
  let type: DeliveryFeeSettings['type'] = 'per_km';
  let storeLat: number | undefined = undefined;
  let storeLng: number | undefined = undefined;

  try {
    const globalSettings = await storage.getDeliveryFeeSettings();
    if (globalSettings) {
      if (globalSettings.type) {
        type = globalSettings.type as DeliveryFeeSettings['type'];
      }
      const parsedBase = parseFloat(globalSettings.baseFee || '0');
      const parsedPerKm = parseFloat(globalSettings.perKmFee || '0');
      const parsedMin = parseFloat(globalSettings.minFee || '0');
      const parsedMax = parseFloat(globalSettings.maxFee || '0');
      const parsedFree = parseFloat(globalSettings.freeDeliveryThreshold || '0');

      if (parsedBase > 0) baseFee = parsedBase;
      if (parsedPerKm > 0) perKmFee = parsedPerKm;
      if (parsedMin > 0) minFee = parsedMin;
      if (parsedMax > 0) maxFee = parsedMax;
      if (parsedFree > 0) freeDeliveryThreshold = parsedFree;

      if (globalSettings.storeLat && globalSettings.storeLng) {
        const sLat = parseFloat(globalSettings.storeLat);
        const sLng = parseFloat(globalSettings.storeLng);
        if (!isNaN(sLat) && !isNaN(sLng) && sLat !== 0) {
          storeLat = sLat;
          storeLng = sLng;
        }
      }
    }

    // فحص إعدادات النظام
    const uiSettings = await storage.getUiSettings();
    if (uiSettings && uiSettings.length > 0) {
      const settingsMap = new Map(uiSettings.map((s: any) => [s.key, s.value]));
      const sysBase = parseFloat(settingsMap.get('delivery_base_fee') || settingsMap.get('delivery_fee_default') || '0');
      const sysPerKm = parseFloat(settingsMap.get('delivery_fee_per_km') || '0');
      const sysMin = parseFloat(settingsMap.get('min_delivery_fee') || '0');
      const sysLat = parseFloat(settingsMap.get('store_lat') || settingsMap.get('latitude') || '0');
      const sysLng = parseFloat(settingsMap.get('store_lng') || settingsMap.get('longitude') || '0');

      if (baseFee === DEFAULT_BASE_FEE && sysBase > 0) baseFee = sysBase;
      if (perKmFee === DEFAULT_PER_KM_FEE && sysPerKm > 0) perKmFee = sysPerKm;
      if (minFee === DEFAULT_MIN_FEE && sysMin > 0) minFee = sysMin;
      if (!storeLat && sysLat !== 0 && !isNaN(sysLat)) {
        storeLat = sysLat;
        storeLng = sysLng;
      }
    }
  } catch (error) {
    console.error('Error fetching delivery fee settings:', error);
  }

  return {
    type,
    baseFee,
    perKmFee,
    minFee,
    maxFee,
    freeDeliveryThreshold,
    storeLat,
    storeLng
  };
}

/**
 * حساب رسوم التوصيل الكاملة
 * Calculate complete delivery fee
 */
export async function calculateDeliveryFee(
  customerLocation: DeliveryLocation,
  restaurantId: string | null,
  orderSubtotal: number
): Promise<DeliveryFeeResult> {
  // 1. جلب جميع البيانات المطلوبة بشكل متوازي للأداء الأمثل
  const [geoZones, deliveryRules, discounts, deliverySettings, restaurant, uiSettingsList] = await Promise.all([
    storage.getGeoZones(),
    storage.getDeliveryRules(),
    storage.getDeliveryDiscounts(),
    getDeliveryFeeSettings(),
    restaurantId ? storage.getRestaurant(restaurantId) : Promise.resolve(null),
    storage.getUiSettings()
  ]);

  const activeGeoZones = geoZones.filter(z => z.isActive);
  const activeRules = deliveryRules.filter(r => r.isActive);
  const activeDiscounts = discounts.filter(d => d.isActive);

  // إعدادات التحقق من نطاق التوصيل المسموح به
  const uiSettingsMap = new Map((uiSettingsList || []).map((s: any) => [s.key, s.value]));
  const isRestrictionEnabled = uiSettingsMap.get('enable_delivery_zone_restriction') === 'true';
  const maxAllowedDistance = parseFloat(uiSettingsMap.get('max_delivery_distance_km') || '25');
  const restrictionMode = uiSettingsMap.get('delivery_restriction_mode') || 'both'; // 'geo_zones' | 'max_distance' | 'both'

  // 2. تحديد موقع المتجر (إعدادات دبوس التوصيل بالخريطة -> المطعم -> إعدادات رسوم التوصيل -> صنعاء كافتراضي)
  let storeLocation: DeliveryLocation = { lat: 15.3694, lng: 44.1910 };

  const centerLatVal = parseFloat(uiSettingsMap.get('delivery_center_lat') || uiSettingsMap.get('store_lat') || '0');
  const centerLngVal = parseFloat(uiSettingsMap.get('delivery_center_lng') || uiSettingsMap.get('store_lng') || '0');

  if (centerLatVal !== 0 && !isNaN(centerLatVal) && centerLngVal !== 0 && !isNaN(centerLngVal)) {
    storeLocation = {
      lat: centerLatVal,
      lng: centerLngVal
    };
  } else if (restaurant && restaurant.latitude && restaurant.longitude && parseFloat(String(restaurant.latitude)) !== 0) {
    storeLocation = {
      lat: parseFloat(String(restaurant.latitude)),
      lng: parseFloat(String(restaurant.longitude))
    };
  } else if (deliverySettings.storeLat && deliverySettings.storeLng && deliverySettings.storeLat !== 0) {
    storeLocation = {
      lat: deliverySettings.storeLat,
      lng: deliverySettings.storeLng
    };
  }

  // حساب المسافة بين موقع العميل وموقع المتجر/المطعم
  const distance = calculateDistance(customerLocation, storeLocation);
  const estimatedTime = estimateDeliveryTime(distance);

  // 4. تحديد المنطقة الجغرافية (Geo-Zone)
  let matchingGeoZone: any = null;
  for (const zone of activeGeoZones) {
    if (isPointInGeoZone(customerLocation, zone.coordinates)) {
      matchingGeoZone = zone;
      break; // أول منطقة مطابقة
    }
  }

  // تحديد شريحة المسافة (Distance Zone)
  const allDeliveryZones = await storage.getDeliveryZones();
  const activeDeliveryZones = (allDeliveryZones || []).filter((z: any) => z.isActive !== false);
  const matchingDeliveryZone = activeDeliveryZones.find((z: any) => {
    const minD = parseFloat(z.minDistance || '0');
    const maxD = parseFloat(z.maxDistance || '99999');
    return distance >= minD && distance <= maxD;
  });

  // 5. تطبيق القواعد الديناميكية (Dynamic Rules)
  // القواعد مرتبة حسب الأولوية (Priority) من الأعلى إلى الأقل
  let appliedFee: number | null = null;
  let appliedRuleId: string | undefined;
  let appliedRuleObj: any = null;
  let calculationMethod: string = deliverySettings.type;

  for (const rule of activeRules) {
    let matches = false;

    if (rule.ruleType === 'zone' && matchingGeoZone && rule.geoZoneId === matchingGeoZone.id) {
      matches = true;
    } else if (rule.ruleType === 'distance') {
      const minD = rule.minDistance ? parseFloat(rule.minDistance) : 0;
      const maxD = rule.maxDistance ? parseFloat(rule.maxDistance) : Infinity;
      if (distance >= minD && distance <= maxD) matches = true;
    } else if (rule.ruleType === 'order_value') {
      const minV = rule.minOrderValue ? parseFloat(rule.minOrderValue) : 0;
      const maxV = rule.maxOrderValue ? parseFloat(rule.maxOrderValue) : Infinity;
      if (orderSubtotal >= minV && orderSubtotal <= maxV) matches = true;
    }

    if (matches) {
      appliedFee = parseFloat(rule.fee);
      appliedRuleId = rule.id;
      appliedRuleObj = rule;
      calculationMethod = `dynamic_rule_${rule.ruleType}`;
      break; // نطبق أول قاعدة مطابقة حسب الأولوية
    }
  }

  // 6. استخدام الحساب بناءً على نوع النظام المختار
  if (appliedFee === null) {
    switch (deliverySettings.type) {
      case 'fixed':
        appliedFee = deliverySettings.baseFee;
        calculationMethod = 'fixed';
        break;

      case 'geo_zone':
        if (matchingGeoZone && matchingGeoZone.deliveryFee && parseFloat(matchingGeoZone.deliveryFee) > 0) {
          appliedFee = parseFloat(matchingGeoZone.deliveryFee);
          calculationMethod = 'geo_zone';
        } else if (matchingDeliveryZone && matchingDeliveryZone.deliveryFee) {
          appliedFee = parseFloat(matchingDeliveryZone.deliveryFee);
          calculationMethod = 'zone_based';
        } else {
          appliedFee = deliverySettings.baseFee + (distance * deliverySettings.perKmFee);
          calculationMethod = 'per_km_fallback';
        }
        break;

      case 'hybrid':
        // هجين ذكي: إذا كان في منطقة جغرافية برسوم محددة نستخدمها، وإلا شريحة المسافة، وإلا بالكيلومتر
        if (matchingGeoZone && matchingGeoZone.deliveryFee && parseFloat(matchingGeoZone.deliveryFee) > 0) {
          appliedFee = parseFloat(matchingGeoZone.deliveryFee);
          calculationMethod = 'hybrid_geo_zone';
        } else if (matchingDeliveryZone && matchingDeliveryZone.deliveryFee) {
          appliedFee = parseFloat(matchingDeliveryZone.deliveryFee);
          calculationMethod = 'hybrid_distance_zone';
        } else {
          appliedFee = deliverySettings.baseFee + (distance * deliverySettings.perKmFee);
          calculationMethod = 'hybrid_per_km';
        }
        break;

      case 'zone_based':
        if (matchingDeliveryZone && matchingDeliveryZone.deliveryFee) {
          appliedFee = parseFloat(matchingDeliveryZone.deliveryFee);
          calculationMethod = 'zone_based';
        } else {
          appliedFee = deliverySettings.baseFee + (distance * deliverySettings.perKmFee);
          calculationMethod = 'per_km_fallback';
        }
        break;

      case 'restaurant_custom':
        // حسب إعدادات المطعم إذا توفرت
        appliedFee = deliverySettings.baseFee + (distance * deliverySettings.perKmFee);
        calculationMethod = 'restaurant_custom';
        break;

      case 'per_km':
      default:
        appliedFee = deliverySettings.baseFee + (distance * deliverySettings.perKmFee);
        calculationMethod = 'per_km';
        break;
    }
  }

  // تطبيق معامل الذروة / الزيادة للمنطقة الجغرافية (Surge Multiplier) إذا كان موجوداً
  let surgeMultiplierApplied = 1;
  if (matchingGeoZone && matchingGeoZone.surgeMultiplier && parseFloat(matchingGeoZone.surgeMultiplier) > 1) {
    surgeMultiplierApplied = parseFloat(matchingGeoZone.surgeMultiplier);
    appliedFee = appliedFee * surgeMultiplierApplied;
  }

  // 7. تطبيق التوصيل المجاني والخصومات
  let isFreeDelivery = false;
  let freeDeliveryReason: string | undefined;
  let appliedDiscountId: string | undefined;
  let appliedDiscountObj: any = null;

  if (deliverySettings.freeDeliveryThreshold > 0 && orderSubtotal >= deliverySettings.freeDeliveryThreshold) {
    isFreeDelivery = true;
    freeDeliveryReason = `توصيل مجاني للطلبات فوق ${deliverySettings.freeDeliveryThreshold} ريال`;
    appliedFee = 0;
  } else {
    const now = new Date();
    for (const discount of activeDiscounts) {
      if (discount.validFrom && new Date(discount.validFrom) > now) continue;
      if (discount.validUntil && new Date(discount.validUntil) < now) continue;
      if (discount.minOrderValue && orderSubtotal < parseFloat(discount.minOrderValue)) continue;

      appliedDiscountId = discount.id;
      appliedDiscountObj = discount;
      if (discount.discountType === 'percentage') {
        const discountAmount = appliedFee * (parseFloat(discount.discountValue) / 100);
        appliedFee -= discountAmount;
        if (parseFloat(discount.discountValue) === 100) {
          isFreeDelivery = true;
          freeDeliveryReason = `خصم توصيل مجاني: ${discount.name}`;
        }
      } else {
        appliedFee -= parseFloat(discount.discountValue);
        if (appliedFee <= 0) {
          appliedFee = 0;
          isFreeDelivery = true;
          freeDeliveryReason = `توصيل مجاني: ${discount.name}`;
        }
      }
      break;
    }
  }

  // التحقق مما إذا كان موقع العميل خارج نطاق التوصيل المسموح به
  let isOutsideDeliveryZone = false;
  let outsideReason: string | undefined = undefined;

  if (isRestrictionEnabled) {
    if (restrictionMode === 'max_distance') {
      if (distance > maxAllowedDistance) {
        isOutsideDeliveryZone = true;
        outsideReason = `الموقع يبعد ${(Number(distance) || 0).toFixed(1)} كم عن نطاق المتجر، وهو خارج الحد الأقصى للتوصيل (${maxAllowedDistance} كم).`;
      }
    } else if (restrictionMode === 'geo_zones') {
      if (activeGeoZones.length > 0) {
        if (!matchingGeoZone) {
          isOutsideDeliveryZone = true;
          outsideReason = 'الموقع المحدد يقع خارج مناطق وأحياء التوصيل المعتمدة لدينا.';
        }
      } else if (distance > maxAllowedDistance) {
        isOutsideDeliveryZone = true;
        outsideReason = `الموقع المحدد يبعد ${(Number(distance) || 0).toFixed(1)} كم وهو خارج نطاق التوصيل المتاح.`;
      }
    } else {
      // وضع كلاهما (both): يجب أن يقع ضمن إحدى المناطق المسموحة (إذا كانت معرّفة) وضمن الحد الأقصى للمسافة
      if (activeGeoZones.length > 0 && !matchingGeoZone) {
        isOutsideDeliveryZone = true;
        outsideReason = 'الموقع المحدد يقع خارج مناطق وأحياء التوصيل المعتمدة لدينا.';
      } else if (distance > maxAllowedDistance) {
        isOutsideDeliveryZone = true;
        outsideReason = `الموقع المحدد يبعد ${(Number(distance) || 0).toFixed(1)} كم عن المتجر وهو خارج أقصى نطاق للتوصيل (${maxAllowedDistance} كم).`;
      }
    }
  }

  // تطبيق حدود الحد الأدنى والحد الأقصى لرسوم التوصيل
  if (!isFreeDelivery) {
    const minAllowed = deliverySettings.minFee > 0 ? deliverySettings.minFee : DEFAULT_MIN_FEE;
    const maxAllowed = deliverySettings.maxFee > 0 ? deliverySettings.maxFee : DEFAULT_MAX_FEE;
    appliedFee = Math.max(minAllowed, Math.min(maxAllowed, appliedFee));
  }

  appliedFee = Math.round(appliedFee * 100) / 100;

  return {
    fee: appliedFee,
    distance,
    estimatedTime,
    calculationMethod,
    isOutsideDeliveryZone,
    outsideReason,
    feeBreakdown: {
      baseFee: isFreeDelivery ? 0 : deliverySettings.baseFee,
      distanceFee: isFreeDelivery ? 0 : Math.max(0, Math.round((appliedFee - deliverySettings.baseFee) * 100) / 100),
      totalBeforeLimit: appliedFee
    },
    isFreeDelivery,
    freeDeliveryReason,
    appliedRuleId,
    appliedDiscountId,
    matchedGeoZone: matchingGeoZone ? {
      id: matchingGeoZone.id,
      name: matchingGeoZone.name,
      deliveryFee: matchingGeoZone.deliveryFee ? parseFloat(matchingGeoZone.deliveryFee) : undefined,
      surgeMultiplier: matchingGeoZone.surgeMultiplier ? parseFloat(matchingGeoZone.surgeMultiplier) : undefined
    } : undefined,
    matchedDeliveryZone: matchingDeliveryZone ? {
      id: matchingDeliveryZone.id,
      name: matchingDeliveryZone.name,
      minDistance: matchingDeliveryZone.minDistance,
      maxDistance: matchingDeliveryZone.maxDistance,
      deliveryFee: matchingDeliveryZone.deliveryFee
    } : undefined,
    appliedRule: appliedRuleObj ? {
      id: appliedRuleObj.id,
      name: appliedRuleObj.name,
      ruleType: appliedRuleObj.ruleType,
      fee: String(appliedRuleObj.fee)
    } : undefined,
    appliedDiscount: appliedDiscountObj ? {
      id: appliedDiscountObj.id,
      name: appliedDiscountObj.name,
      discountType: appliedDiscountObj.discountType,
      discountValue: String(appliedDiscountObj.discountValue)
    } : undefined,
    surgeMultiplierApplied: surgeMultiplierApplied > 1 ? surgeMultiplierApplied : undefined
  };
}

/**
 * حساب رسوم التوصيل حسب المناطق
 */
async function getZoneBasedFee(distance: number): Promise<number> {
  try {
    const zones = await storage.getDeliveryZones();
    
    if (zones && zones.length > 0) {
      // البحث عن المنطقة المناسبة
      const matchingZone = zones.find(zone => 
        distance >= parseFloat(zone.minDistance || '0') &&
        distance <= parseFloat(zone.maxDistance || '999')
      );

      if (matchingZone) {
        return parseFloat(matchingZone.deliveryFee || String(DEFAULT_BASE_FEE));
      }
    }
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
  }

  // رسوم افتراضية إذا لم توجد منطقة مطابقة
  return DEFAULT_BASE_FEE + (distance * DEFAULT_PER_KM_FEE);
}

/**
 * حساب رسوم التوصيل السريع
 * Quick delivery fee calculation (simplified)
 */
export function calculateQuickDeliveryFee(
  distanceKm: number,
  baseFee: number = DEFAULT_BASE_FEE,
  perKmFee: number = DEFAULT_PER_KM_FEE
): number {
  const fee = baseFee + (distanceKm * perKmFee);
  return Math.round(Math.max(DEFAULT_MIN_FEE, Math.min(DEFAULT_MAX_FEE, fee)) * 100) / 100;
}

export default {
  calculateDistance,
  calculateDeliveryFee,
  calculateQuickDeliveryFee,
  estimateDeliveryTime
};
