// @ts-nocheck
import express from "express";
import { storage } from "../storage";
import { z } from "zod";
import { insertDriverSchema } from "@shared/schema";
import { coerceRequestData } from "../utils/coercion";
import { requireDriverAuth, AuthenticatedRequest } from "../utils/auth-middleware";
import { AdvancedDatabaseStorage } from "../db-advanced";

const router = express.Router();

// ================================================================
// المسارات العامة (للإدارة - لا تتطلب توكن سائق)
// ================================================================

// جلب جميع السائقين
router.get("/", async (req, res) => {
  try {
    const { available } = req.query;
    let drivers;
    if (available === 'true') {
      drivers = await storage.getAvailableDrivers();
    } else {
      drivers = await storage.getDrivers();
    }
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch drivers" });
  }
});

// إنشاء سائق جديد (من لوحة التحكم)
router.post("/", async (req, res) => {
  try {
    const validatedData = insertDriverSchema.parse(req.body);
    const driver = await storage.createDriver(validatedData);
    res.status(201).json(driver);
  } catch (error) {
    console.error("خطأ في إضافة سائق:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "بيانات السائق غير صحيحة",
        details: error.errors
      });
    }
    res.status(400).json({
      message: error instanceof Error ? error.message : "حدث خطأ أثناء إضافة السائق"
    });
  }
});

// ================================================================
// مسارات تطبيق السائق المحمية (تتطلب توكن سائق)
// ملاحظة مهمة: يجب تعريف المسارات المحددة قبل مسارات الـ wildcard
// ================================================================

// لوحة معلومات السائق
router.get("/app/dashboard", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;

    const driver = await storage.getDriver(driverId);
    if (!driver) {
      return res.status(404).json({ error: "السائق غير موجود" });
    }

    const allOrders = await storage.getOrders();
    const driverOrders = allOrders.filter(order => order.driverId === driverId);

    const driverBalance = await storage.getDriverBalance(driverId);
    const driverCommissions = await storage.getDriverCommissions(driverId);

    const advStorage = new AdvancedDatabaseStorage(storage.db);
    const driverReviews = await advStorage.getDriverReviews(driverId);

    const todayStr = new Date().toDateString();

    const todayOrders = driverOrders.filter(order => {
      try {
        const createdDate = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
        return createdDate.toDateString() === todayStr;
      } catch (e) {
        return false;
      }
    });
    const completedToday = todayOrders.filter(order => order.status === "delivered");

    const commissionsToday = driverCommissions.filter(commission => {
      try {
        const createdDate = commission.createdAt instanceof Date ? commission.createdAt : new Date(commission.createdAt);
        return createdDate.toDateString() === todayStr;
      } catch (e) {
        return false;
      }
    });
    const todayEarnings = commissionsToday.reduce((sum, commission) =>
      sum + (parseFloat(commission.commissionAmount?.toString()) || 0), 0
    );

    const totalEarnings = driverCommissions.reduce((sum, commission) =>
      sum + (parseFloat(commission.commissionAmount?.toString()) || 0), 0
    );

    const availableOrders = allOrders
      .filter(order => (order.status === "confirmed" || order.status === "assigned") && order.driverId === driverId)
      .slice(0, 10);

    const currentOrders = driverOrders.filter(order =>
      ["preparing", "ready", "picked_up", "on_way"].includes(order.status)
    );

    res.json({
      stats: {
        todayOrders: todayOrders.length,
        todayEarnings,
        completedToday: completedToday.length,
        totalOrders: driverOrders.length,
        totalEarnings,
        availableBalance: parseFloat(driverBalance?.availableBalance?.toString() || "0"),
        withdrawnAmount: parseFloat(driverBalance?.withdrawnAmount?.toString() || "0"),
        totalCommissions: driverCommissions.length,
        averageRating: parseFloat(driver.averageRating?.toString() || "4.5")
      },
      driver: {
        id: driver.id,
        name: driver.name,
        isAvailable: driver.isAvailable,
        isActive: driver.isActive
      },
      availableOrders,
      currentOrders,
      reviews: driverReviews || [],
      balance: driverBalance || {
        availableBalance: "0",
        totalBalance: "0",
        withdrawnAmount: "0",
        pendingAmount: "0"
      }
    });
  } catch (error) {
    console.error("خطأ في لوحة معلومات السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب الطلبات المتاحة (قبل /orders لأنه أكثر تحديداً)
router.get("/orders/available", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const driver = await storage.getDriver(driverId);
    const allOrders = await storage.getOrders();

    // الطلبات غير المعينة أو المعينة لهذا السائق وتكون في حالة غير منتهية
    const availableOrders = allOrders.filter(order => {
      const isNotDone = !['delivered', 'cancelled', 'completed'].includes(order.status);
      const isUnassigned = !order.driverId || order.driverId === driverId;
      return isNotDone && isUnassigned;
    });

    // حساب المسافة وترتيبها حسب الأقرب للسائق إذا كانت إحداثيات السائق متوفرة
    const driverLat = driver?.latitude ? parseFloat(driver.latitude) : null;
    const driverLng = driver?.longitude ? parseFloat(driver.longitude) : null;

    const enrichedOrders = await Promise.all(availableOrders.map(async (order) => {
      let storeLat: number | null = order.pickupLocationLat ? parseFloat(order.pickupLocationLat) : null;
      let storeLng: number | null = order.pickupLocationLng ? parseFloat(order.pickupLocationLng) : null;
      let restaurantName = order.restaurantName || 'المتجر الرئيسي';

      if (!storeLat && order.restaurantId) {
        try {
          const rest = await storage.getRestaurant(order.restaurantId);
          if (rest) {
            storeLat = rest.latitude ? parseFloat(rest.latitude) : null;
            storeLng = rest.longitude ? parseFloat(rest.longitude) : null;
            if (rest.name) restaurantName = rest.name;
          }
        } catch (_) {}
      }

      if (!storeLat && order.customerLocationLat) {
        storeLat = parseFloat(order.customerLocationLat);
        storeLng = parseFloat(order.customerLocationLng);
      }

      let distanceKm: number | null = null;
      if (driverLat !== null && driverLng !== null && storeLat !== null && storeLng !== null) {
        const R = 6371;
        const dLat = (storeLat - driverLat) * (Math.PI / 180);
        const dLon = (storeLng - driverLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(driverLat * (Math.PI / 180)) * Math.cos(storeLat * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(R * c * 10) / 10;
      }

      return {
        ...order,
        restaurantName,
        distanceKm,
        isNearest: false,
      };
    }));

    // الترتيب: الأقرب مسافة أولاً، ثم الأحدث تاريخاً
    enrichedOrders.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (enrichedOrders.length > 0 && enrichedOrders[0].distanceKm !== null) {
      enrichedOrders[0].isNearest = true;
    }

    res.json(enrichedOrders);
  } catch (error) {
    console.error("خطأ في جلب الطلبات المتاحة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب طلبات السائق (فلترة حسب الحالة)
router.get("/orders", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { status } = req.query;

    const allOrders = await storage.getOrders();
    let driverOrders = allOrders.filter(order => order.driverId === driverId);

    if (status === 'active') {
      driverOrders = driverOrders.filter(order =>
        ['preparing', 'ready', 'picked_up', 'on_way', 'assigned', 'confirmed'].includes(order.status)
      );
    } else if (status === 'history') {
      driverOrders = driverOrders.filter(order =>
        ['delivered', 'cancelled'].includes(order.status)
      );
    } else if (status && typeof status === 'string') {
      driverOrders = driverOrders.filter(order => order.status === status);
    }

    driverOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(driverOrders);
  } catch (error) {
    console.error("خطأ في جلب طلبات السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// قبول / استلام طلب من السائق
router.post("/orders/:id/accept", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const driverId = req.driverId!;

    let driver = await storage.getDriver(driverId);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });

    let order = await storage.getOrder(id);
    if (!order) {
      try {
        const allOrders = await storage.getOrders();
        order = (allOrders || []).find((o: any) => o.id === id);
      } catch (_) {}
    }

    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    // الفحص ضد التزامن: هل تم استلام الطلب من سائق آخر؟
    if (order.driverId && order.driverId !== driverId) {
      let otherDriverName = "سائق آخر";
      try {
        const otherDriver = await storage.getDriver(order.driverId);
        if (otherDriver) otherDriverName = otherDriver.name;
      } catch (_) {}
      return res.status(400).json({
        error: `عذراً، تم استلام هذا الطلب بالفعل من قِبل السائق: ${otherDriverName}`
      });
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: "هذا الطلب ملغي أو مسبوق تسليمه" });
    }

    const commissionRate = parseFloat(driver.commissionRate?.toString() || "70");
    const deliveryFee = parseFloat(order.deliveryFee?.toString() || "0") || 0;
    const commissionAmount = (deliveryFee * commissionRate) / 100;

    let updatedOrder: any = null;
    try {
      updatedOrder = await storage.updateOrder(id, {
        driverId,
        status: "on_way",
        driverCommissionRate: commissionRate.toString(),
        driverCommissionAmount: commissionAmount.toString(),
        commissionProcessed: false,
        updatedAt: new Date()
      });
    } catch (updErr) {
      console.error("⚠️ خطأ عند تحديث قاعدة البيانات لاستلام الطلب (تحويل احتياطي):", updErr);
      order.driverId = driverId;
      order.status = "on_way";
      updatedOrder = order;
    }

    if (!updatedOrder) {
      order.driverId = driverId;
      order.status = "on_way";
      updatedOrder = order;
    }

    const ws = req.app.get('ws');
    if (ws) {
      try {
        // بث عام لجميع السائقين وللإدارة يفيد باستلام الطلب
        if (typeof ws.broadcast === 'function') {
          ws.broadcast('order_claimed', {
            orderId: id,
            orderNumber: order.orderNumber,
            driverId,
            driverName: driver.name,
            isWaselLi: false
          });
        }
        if (typeof ws.notifyOrder === 'function') {
          ws.notifyOrder('order_update', {
            orderId: id,
            orderNumber: order.orderNumber,
            status: 'on_way',
            driverId,
            driverName: driver.name,
            type: 'regular'
          }, {
            customerId: order.customerId,
            customerPhone: order.customerPhone,
            driverId,
            orderId: id,
            includeAdmin: true
          });
        }
      } catch (wsErr) {
        console.error("⚠️ خطأ بث WebSocket لاستلام الطلب (تم التجاهل):", wsErr);
      }
    }

    // إنشاء إشعار للإدارة والعميل والتتبع
    try {
      await storage.createNotification({
        type: 'order_claimed_by_driver',
        title: 'تم استلام الطلب من السائق',
        message: `تم استلام الطلب رقم ${order.orderNumber} بواسطة السائق ${driver.name}`,
        recipientType: 'admin',
        recipientId: null,
        orderId: id,
        isRead: false
      });
    } catch (_) {}

    try {
      if (order.customerId || order.customerPhone) {
        await storage.createNotification({
          type: 'order_status_update',
          title: 'تحديث حالة الطلب',
          message: `طلبك رقم ${order.orderNumber}: السائق ${driver.name} في الطريق لتوصيل طلبك`,
          recipientType: 'customer',
          recipientId: order.customerId || order.customerPhone,
          orderId: id,
          isRead: false
        });
      }
    } catch (_) {}

    try {
      await storage.createOrderTracking({
        orderId: id,
        status: 'on_way',
        message: `تم قبول واستلام الطلب بواسطة السائق ${driver.name}`,
        createdBy: driverId,
        createdByType: 'driver'
      });
    } catch (_) {}

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("خطأ في قبول الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم أثناء استلام الطلب" });
  }
});

// تحديث حالة الطلب
router.put("/orders/:id/status", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, location } = req.body;
    const driverId = req.driverId!;

    const order = await storage.getOrder(id);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    if (order.driverId !== driverId) return res.status(403).json({ error: "غير مصرح لك" });

    const allowedStatuses = ["preparing", "ready", "picked_up", "on_way", "delivered"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "حالة غير صحيحة" });

    if (location) {
      await storage.updateDriver(driverId, { currentLocation: location });
    }

    let updatedOrder;
    if (status === "delivered") {
      updatedOrder = await storage.completeOrder(id);
    } else {
      updatedOrder = await storage.updateOrder(id, { status });
    }

    // إنشاء إشعار للعميل وإدارة وتتبع الطلب
    try {
      const statusMessages: Record<string, string> = {
        preparing: 'جاري تحضير الطلب',
        ready: 'الطلب جاهز للاستلام',
        picked_up: 'تم استلام الطلب من المطعم',
        on_way: 'السائق في الطريق إليك',
        delivered: 'تم تسليم الطلب بنجاح',
      };
      const statusMessage = statusMessages[status] || `تم تحديث حالة الطلب إلى ${status}`;

      if (order.customerId || order.customerPhone) {
        await storage.createNotification({
          type: 'order_status_update',
          title: 'تحديث حالة الطلب',
          message: `طلبك رقم ${order.orderNumber}: ${statusMessage}`,
          recipientType: 'customer',
          recipientId: order.customerId || order.customerPhone,
          orderId: id,
          isRead: false,
        });
      }

      // كتابة قيد تتبع للطلب
      try {
        await storage.createOrderTracking({
          orderId: id,
          status,
          message: statusMessage,
          createdBy: driverId,
          createdByType: 'driver',
        });
      } catch (trackErr) {
        console.error('خطأ في إنشاء قيد التتبع:', trackErr);
      }

      await storage.createNotification({
        type: 'order_status_update',
        title: 'تحديث حالة الطلب من السائق',
        message: `الطلب ${order.orderNumber}: ${statusMessage}`,
        recipientType: 'admin',
        recipientId: null,
        orderId: id,
        isRead: false,
      });
    } catch (notifErr) {
      console.error('خطأ في إنشاء إشعارات السائق:', notifErr);
    }

    const ws = req.app.get('ws');
    if (ws && typeof ws.notifyOrder === 'function') {
      ws.notifyOrder('order_update', { orderId: id, status, driverId }, {
        customerId: order.customerId,
        customerPhone: order.customerPhone,
        driverId,
        orderId: id,
      });
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("خطأ في تحديث حالة الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث الموقع الجغرافي للسائق بشكل دوري
router.post("/location", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { latitude, longitude, currentLocation } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "الإحداثيات مطلوبة" });
    }

    await storage.updateDriver(driverId, {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      currentLocation: currentLocation || undefined
    });

    const ws = req.app.get('ws');
    if (ws) {
      ws.broadcast('driver_location', {
        driverId,
        latitude,
        longitude,
        timestamp: new Date()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في تحديث الموقع:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب تفاصيل طلب محدد
router.get("/orders/:id", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const driverId = req.driverId!;

    const order = await storage.getOrder(id);
    if (!order || order.driverId !== driverId) return res.status(404).json({ error: "الطلب غير موجود" });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب إحصائيات السائق
router.get("/stats", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const driver = await storage.getDriver(driverId);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });

    const driverBalance = await storage.getDriverBalance(driverId);
    const driverCommissions = await storage.getDriverCommissions(driverId);

    const advStorage = new AdvancedDatabaseStorage(storage.db);
    const driverReviews = await advStorage.getDriverReviews(driverId);

    const allOrders = await storage.getOrders();
    const driverOrders = allOrders.filter(order => order.driverId === driverId);
    const deliveredOrders = driverOrders.filter(order => order.status === "delivered");

    const totalEarnings = driverCommissions.reduce((sum, c) => sum + (parseFloat(c.commissionAmount.toString()) || 0), 0);

    res.json({
      totalOrders: driverOrders.length,
      completedOrders: deliveredOrders.length,
      totalEarnings,
      availableBalance: driverBalance?.availableBalance || 0,
      withdrawnAmount: driverBalance?.withdrawnAmount || 0,
      averageRating: driver.averageRating || 4.5,
      successRate: driverOrders.length > 0 ? Math.round((deliveredOrders.length / driverOrders.length) * 100) : 0,
      reviews: driverReviews || [],
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب بيانات الرصيد والمحفظة
router.get("/balance", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const balance = await storage.getDriverBalance(driverId);
    const transactions = await storage.getDriverTransactions(driverId);
    const withdrawals = await storage.getWithdrawalRequests(driverId, 'driver');

    res.json({
      balance: balance || { availableBalance: "0", totalBalance: "0", withdrawnAmount: "0", pendingAmount: "0" },
      transactions,
      withdrawals
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث حالة السائق (متاح / غير متاح)
router.post("/status", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { status } = req.body;

    if (!['available', 'offline'].includes(status)) {
      return res.status(400).json({ error: "حالة غير صحيحة" });
    }

    const isAvailable = status === 'available';
    await storage.updateDriver(driverId, { isAvailable });

    const ws = req.app.get('ws');
    if (ws) {
      ws.broadcast('driver_status_update', {
        driverId,
        isAvailable,
        status,
        timestamp: new Date()
      });

      if (typeof ws.sendToAdmin === 'function') {
        ws.sendToAdmin('driver_status_update', { driverId, isAvailable, status });
      }
    }

    const advStorage = new AdvancedDatabaseStorage(storage.db);

    if (isAvailable) {
      await advStorage.createWorkSession({
        driverId,
        startTime: new Date(),
        isActive: true,
        totalDeliveries: 0,
        totalEarnings: "0"
      });
    } else {
      const activeSession = await advStorage.getActiveWorkSession(driverId);
      if (activeSession) {
        await advStorage.endWorkSession(activeSession.id, 0, 0);
      }
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error("خطأ في تحديث حالة السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث موقع السائق (إحداثيات)
router.post("/location", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { latitude, longitude, address } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "الإحداثيات مطلوبة" });
    }

    await storage.updateDriver(driverId, {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      currentLocation: address || undefined
    });

    const ws = req.app.get('ws');
    if (ws) {
      ws.broadcast('driver_location', {
        driverId,
        latitude,
        longitude,
        timestamp: new Date()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في تحديث موقع السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// طلب سحب رصيد
router.post("/withdraw", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { amount, method, details } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ error: "مبلغ غير صحيح" });

    const balance = await storage.getDriverBalance(driverId);
    const available = parseFloat(balance?.availableBalance?.toString() || "0");

    if (amount > available) return res.status(400).json({ error: "الرصيد غير كافٍ" });

    const withdrawal = await storage.createWithdrawalRequest({
      entityType: 'driver',
      entityId: driverId,
      amount: amount.toString(),
      status: 'pending',
      bankDetails: details || '',
      adminNotes: `وسيلة السحب: ${method || 'كاش'}`
    });

    res.json({ success: true, withdrawal });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب الملف الشخصي
router.get("/profile", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const driver = await storage.getDriver(driverId);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });
    res.json({ success: true, driver });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث الملف الشخصي
router.put("/profile", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertDriverSchema.partial().parse(coercedData);

    const driver = await storage.updateDriver(driverId, validatedData);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });

    const ws = req.app.get('ws');
    if (ws && validatedData.isAvailable !== undefined) {
      ws.broadcast('driver_status_update', {
        driverId,
        isAvailable: driver.isAvailable,
        name: driver.name,
        timestamp: new Date()
      });

      if (typeof ws.sendToAdmin === 'function') {
        ws.sendToAdmin('driver_status_update', {
          driverId,
          isAvailable: driver.isAvailable,
          name: driver.name
        });
      }
    }

    res.json({ success: true, driver });
  } catch (error) {
    console.error("خطأ في تحديث الملف الشخصي:", error);
    res.status(400).json({ error: "بيانات غير صحيحة" });
  }
});

// ================================================================
// مسارات طلبات وصل لي للسائق
// ================================================================

// جلب طلبات وصل لي المتاحة أو المعينة للسائق
router.get("/wasalni", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { status } = req.query;
    const db = (storage as any).db;
    if (!db) return res.status(500).json({ error: "Database not available" });
    const { wasalniRequests } = await import("../../shared/schema");

    const driver = await storage.getDriver(driverId);
    const driverLat = driver?.latitude ? parseFloat(driver.latitude) : null;
    const driverLng = driver?.longitude ? parseFloat(driver.longitude) : null;

    let allRequests = await db.select().from(wasalniRequests);

    if (status === 'available') {
      // جميع طلبات وصل لي التي لم تُلغ ولم تُسلّم بعد، وهي إما غير معينة لسائق أو معينة لهذا السائق
      allRequests = allRequests.filter((r: any) =>
        !['delivered', 'cancelled'].includes(r.status) &&
        (!r.driverId || r.driverId === driverId)
      );
    } else if (status === 'active') {
      allRequests = allRequests.filter((r: any) =>
        r.driverId === driverId && ['confirmed', 'on_way'].includes(r.status)
      );
    } else if (status === 'history') {
      allRequests = allRequests.filter((r: any) =>
        r.driverId === driverId && ['delivered', 'cancelled'].includes(r.status)
      );
    } else {
      allRequests = allRequests.filter((r: any) => r.driverId === driverId);
    }

    const enrichedRequests = allRequests.map((r: any) => {
      let distanceKm: number | null = null;
      const fromLat = r.fromLat ? parseFloat(r.fromLat) : null;
      const fromLng = r.fromLng ? parseFloat(r.fromLng) : null;

      if (driverLat !== null && driverLng !== null && fromLat !== null && fromLng !== null) {
        const R = 6371;
        const dLat = (fromLat - driverLat) * (Math.PI / 180);
        const dLon = (fromLng - driverLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(driverLat * (Math.PI / 180)) * Math.cos(fromLat * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(R * c * 10) / 10;
      }

      return {
        ...r,
        distanceKm,
        isNearest: false,
      };
    });

    enrichedRequests.sort((a: any, b: any) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (enrichedRequests.length > 0 && enrichedRequests[0].distanceKm !== null) {
      enrichedRequests[0].isNearest = true;
    }

    res.json(enrichedRequests);
  } catch (error) {
    console.error("خطأ في جلب طلبات وصل لي للسائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// قبول طلب وصل لي من السائق
router.post("/wasalni/:id/accept", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const driverId = req.driverId!;
    const db = (storage as any).db;
    if (!db) return res.status(500).json({ error: "Database not available" });
    const { wasalniRequests } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");

    const driver = await storage.getDriver(driverId);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });

    const [request] = await db.select().from(wasalniRequests).where(eq(wasalniRequests.id, id));
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // الفحص ضد التزامن
    if (request.driverId && request.driverId !== driverId) {
      let otherDriverName = "سائق آخر";
      try {
        const otherDriver = await storage.getDriver(request.driverId);
        if (otherDriver) otherDriverName = otherDriver.name;
      } catch (_) {}
      return res.status(400).json({
        error: `عذراً، تم استلام هذا الطلب بالفعل من قِبل السائق: ${otherDriverName}`
      });
    }

    if (['delivered', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ error: "طلب وصل لي هذا ملغي أو مسبوق تسليمه" });
    }

    const [updated] = await db.update(wasalniRequests)
      .set({ driverId, status: 'on_way', updatedAt: new Date() })
      .where(eq(wasalniRequests.id, id))
      .returning();

    const ws = req.app.get('ws');
    if (ws) {
      if (typeof ws.broadcast === 'function') {
        ws.broadcast('order_claimed', {
          orderId: id,
          orderNumber: request.requestNumber,
          driverId,
          driverName: driver.name,
          isWaselLi: true
        });
      }
      if (typeof ws.notifyOrder === 'function') {
        ws.notifyOrder('order_update', {
          orderId: id,
          orderNumber: request.requestNumber,
          status: 'on_way',
          driverId,
          driverName: driver.name,
          type: 'wasalni'
        }, {
          customerId: request.customerId,
          customerPhone: request.customerPhone,
          driverId,
          orderId: id,
          includeAdmin: true
        });
      }
    }

    // إشعار للإدارة
    try {
      await storage.createNotification({
        type: 'wasalni_claimed_by_driver',
        title: 'تم استلام طلب وصل لي من السائق',
        message: `تم استلام طلب وصل لي رقم ${request.requestNumber} بواسطة السائق ${driver.name}`,
        recipientType: 'admin',
        recipientId: null,
        orderId: id,
        isRead: false
      });
    } catch (_) {}

    res.json({ success: true, request: updated });
  } catch (error) {
    console.error("خطأ في قبول طلب وصل لي:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// قبول أو تحديث حالة طلب وصل لي من السائق
router.put("/wasalni/:id/status", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.driverId!;

    const db = (storage as any).db;
    if (!db) return res.status(500).json({ error: "Database not available" });
    const { wasalniRequests } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");

    const [request] = await db.select().from(wasalniRequests).where(eq(wasalniRequests.id, id));
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // إن لم يكن محدد السائق بعد، يُسمح بالاستلام
    if (!request.driverId) {
      request.driverId = driverId;
    } else if (request.driverId !== driverId) {
      return res.status(403).json({ error: "غير مصرح لك بتحديث هذا الطلب" });
    }

    const allowedStatuses = ['on_way', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "حالة غير صحيحة" });

    const [updated] = await db.update(wasalniRequests)
      .set({ driverId, status, updatedAt: new Date() })
      .where(eq(wasalniRequests.id, id))
      .returning();

    // بث التحديث عبر WebSocket
    try {
      const ws = req.app.get('ws');
      if (ws) {
        if (typeof ws.notifyOrder === 'function') {
          ws.notifyOrder('order_update', { orderId: id, status, type: 'wasalni', driverId }, {
            customerId: request.customerId,
            customerPhone: request.customerPhone,
            driverId,
            orderId: id,
            includeAdmin: true
          });
        }
      }
    } catch (wsErr) {
      console.error("⚠️ فشل بث WebSocket لتحديث وصل لي من السائق (تم تجاهله):", wsErr);
    }

    // إشعار للعميل
    const statusMessages: Record<string, string> = {
      on_way: 'السائق في طريقه لاستلام طلبك',
      delivered: 'تم تنفيذ طلب وصل لي بنجاح',
      cancelled: 'تم إلغاء طلب وصل لي من قِبل السائق',
    };

    try {
      const cleanPhone = request.customerPhone ? String(request.customerPhone).trim().replace(/\s+/g, '') : null;
      const recipients = Array.from(new Set([request.customerId, cleanPhone].filter(Boolean))) as string[];
      for (const rid of recipients) {
        try {
          await storage.createNotification({
            type: 'wasalni_status_update',
            title: 'تحديث طلب وصل لي',
            message: `${statusMessages[status] || 'تم تحديث حالة الطلب'} - رقم الطلب: ${request.requestNumber}`,
            recipientType: 'customer',
            recipientId: rid,
            orderId: id,
            isRead: false,
          });
        } catch (e) {
          console.error("⚠️ فشل إشعار العميل بتحديث وصل لي (تم تجاهله):", e);
        }
      }
    } catch (notifyErr) {
      console.error("⚠️ خطأ في إشعارات العميل لتحديث وصل لي (تم تجاهله):", notifyErr);
    }

    try {
      await storage.createNotification({
        type: 'wasalni_status_update',
        title: 'تحديث وصل لي من السائق',
        message: `الطلب ${request.requestNumber}: ${statusMessages[status] || status}`,
        recipientType: 'admin',
        recipientId: null,
        orderId: id,
        isRead: false,
      });
    } catch (notifyErr) {
      console.error("⚠️ فشل إشعار المدير بتحديث وصل لي (تم تجاهله):", notifyErr);
    }

    // إذا تم التسليم، أعد السائق للحالة المتاحة
    if (status === 'delivered' || status === 'cancelled') {
      try {
        await storage.updateDriver(driverId, { isAvailable: true });
      } catch (updErr) {
        console.error("⚠️ فشل تحديث حالة السائق بعد إنهاء وصل لي (تم تجاهله):", updErr);
      }
    }

    res.json({ success: true, request: updated });
  } catch (error) {
    console.error("خطأ في تحديث حالة وصل لي:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ================================================================
// مسارات الـ Wildcard للإدارة (يجب أن تكون في النهاية دائماً)
// ================================================================

// جلب سائق محدد بالمعرف
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await storage.getDriver(id);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.json(driver);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch driver" });
  }
});

// تحديث بيانات سائق (من لوحة التحكم)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertDriverSchema.partial().parse(req.body);
    const driver = await storage.updateDriver(id, validatedData);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.json(driver);
  } catch (error) {
    res.status(400).json({ message: "Invalid driver data" });
  }
});

// حذف سائق
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteDriver(id);
    if (!success) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete driver" });
  }
});

export default router;
