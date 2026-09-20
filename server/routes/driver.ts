// @ts-nocheck
import express from "express";
import { storage } from "../storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { insertDriverSchema } from "@shared/schema";
import { coerceRequestData } from "../utils/coercion";
import { requireDriverAuth, AuthenticatedRequest } from "../utils/auth-middleware";
import { AdvancedDatabaseStorage } from "../db-advanced";
import { broadcastEvent } from "../broadcast.js";

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

    let driverReviews: any[] = [];
    try {
      const advStorage = new AdvancedDatabaseStorage(storage.db);
      driverReviews = await advStorage.getDriverReviews(driverId);
    } catch (_) {}

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

    let wasalniList: any[] = [];
    try {
      wasalniList = await storage.getWasalniRequests();
    } catch (_) {}

    const availableWasalni = wasalniList
      .filter((r: any) => !['delivered', 'cancelled', 'completed', 'assigned'].includes(r.status) && !r.driverId)
      .map((r: any) => ({
        id: r.id,
        orderNumber: r.requestNumber || r.id.slice(-6),
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        deliveryAddress: r.toAddress,
        fromAddress: r.fromAddress,
        toAddress: r.toAddress,
        fromLat: r.fromLat,
        fromLng: r.fromLng,
        toLat: r.toLat,
        toLng: r.toLng,
        customerLocationLat: r.toLat,
        customerLocationLng: r.toLng,
        restaurantLatitude: r.fromLat,
        restaurantLongitude: r.fromLng,
        restaurantAddress: r.fromAddress,
        status: r.status,
        items: r.itemsDescription || r.orderType || 'طلب وصل لي',
        totalAmount: String(r.estimatedFee || "0"),
        driverEarnings: String(r.estimatedFee || "0"),
        restaurantName: 'خدمة وصل لي',
        createdAt: r.createdAt,
        driverId: r.driverId,
        isWasalni: true,
      }));

    const currentWasalni = wasalniList
      .filter((r: any) => r.driverId === driverId && ["assigned", "pending", "confirmed", "accepted", "preparing", "ready", "picked_up", "on_way"].includes(r.status))
      .map((r: any) => ({
        id: r.id,
        orderNumber: r.requestNumber || r.id.slice(-6),
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        deliveryAddress: r.toAddress,
        fromAddress: r.fromAddress,
        toAddress: r.toAddress,
        fromLat: r.fromLat,
        fromLng: r.fromLng,
        toLat: r.toLat,
        toLng: r.toLng,
        customerLocationLat: r.toLat,
        customerLocationLng: r.toLng,
        restaurantLatitude: r.fromLat,
        restaurantLongitude: r.fromLng,
        restaurantAddress: r.fromAddress,
        status: r.status,
        items: r.itemsDescription || r.orderType || 'طلب وصل لي',
        totalAmount: String(r.estimatedFee || "0"),
        driverEarnings: String(r.estimatedFee || "0"),
        restaurantName: 'خدمة وصل لي',
        createdAt: r.createdAt,
        driverId: r.driverId,
        isWasalni: true,
      }));

    const availableOrders = [
      ...allOrders.filter(order => !['delivered', 'cancelled', 'completed', 'assigned'].includes(order.status) && !order.driverId),
      ...availableWasalni
    ].slice(0, 10);

    const currentOrders = [
      ...driverOrders.filter(order => ["assigned", "pending", "confirmed", "accepted", "preparing", "ready", "picked_up", "on_way"].includes(order.status)),
      ...currentWasalni
    ];

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

    // الطلبات غير المعينة فقط (بدون سائق وبانتظار الاستلام)
    const availableOrders = allOrders.filter(order => {
      const isNotDone = !['delivered', 'cancelled', 'completed', 'assigned'].includes(order.status);
      const isUnassigned = !order.driverId;
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

      let customerLat = order.customerLocationLat ? parseFloat(order.customerLocationLat) : null;
      let customerLng = order.customerLocationLng ? parseFloat(order.customerLocationLng) : null;

      if (!storeLat && customerLat) {
        storeLat = customerLat;
        storeLng = customerLng;
      }

      let distanceKm: number | null = null;
      let customerDistanceKm: number | null = null;
      let distanceClassification: string | null = null;

      const calcHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
      };

      if (driverLat !== null && driverLng !== null) {
        if (storeLat !== null && storeLng !== null) {
          distanceKm = calcHaversine(driverLat, driverLng, storeLat, storeLng);
          if (distanceKm <= 2) distanceClassification = 'قريب جداً';
          else if (distanceKm <= 5) distanceClassification = 'متوسط المسافة';
          else distanceClassification = 'بعيد';
        }
        if (customerLat !== null && customerLng !== null) {
          customerDistanceKm = calcHaversine(driverLat, driverLng, customerLat, customerLng);
        }
      }

      return {
        ...order,
        restaurantName,
        distanceKm,
        customerDistanceKm,
        distanceClassification,
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

// مسار بديل للطلبات المتاحة للتوافق
router.get("/available-orders", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const allOrders = await storage.getOrders();
    const availableOrders = allOrders.filter(order => {
      const isNotDone = !['delivered', 'cancelled', 'completed', 'assigned'].includes(order.status);
      const isUnassigned = !order.driverId;
      return isNotDone && isUnassigned;
    });
    res.json(availableOrders);
  } catch (error) {
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
        ['pending', 'confirmed', 'assigned', 'accepted', 'preparing', 'ready', 'picked_up', 'on_way'].includes(order.status)
      );
    } else if (status === 'history') {
      driverOrders = driverOrders.filter(order =>
        ['delivered', 'cancelled'].includes(order.status)
      );
    } else if (status && typeof status === 'string') {
      driverOrders = driverOrders.filter(order => order.status === status);
    }

    driverOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const driver = await storage.getDriver(driverId);
    const driverLat = driver?.latitude ? parseFloat(driver.latitude) : null;
    const driverLng = driver?.longitude ? parseFloat(driver.longitude) : null;

    const calcHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    };

    const enrichedOrders = await Promise.all(driverOrders.map(async (order) => {
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

      let customerLat = order.customerLocationLat ? parseFloat(order.customerLocationLat) : null;
      let customerLng = order.customerLocationLng ? parseFloat(order.customerLocationLng) : null;

      if (!storeLat && customerLat) {
        storeLat = customerLat;
        storeLng = customerLng;
      }

      let distanceKm: number | null = null;
      let customerDistanceKm: number | null = null;
      let distanceClassification: string | null = null;

      if (driverLat !== null && driverLng !== null) {
        if (storeLat !== null && storeLng !== null) {
          distanceKm = calcHaversine(driverLat, driverLng, storeLat, storeLng);
          if (distanceKm <= 2) distanceClassification = 'قريب جداً';
          else if (distanceKm <= 5) distanceClassification = 'متوسط المسافة';
          else distanceClassification = 'بعيد';
        }
        if (customerLat !== null && customerLng !== null) {
          customerDistanceKm = calcHaversine(driverLat, driverLng, customerLat, customerLng);
        }
      }

      return {
        ...order,
        restaurantName,
        distanceKm,
        customerDistanceKm,
        distanceClassification
      };
    }));

    res.json(enrichedOrders);
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
        error: `عذراً، تم استلام هذا الطلب بالفعل من قِبل السائق: ${otherDriverName}`,
        driverName: otherDriverName,
        alreadyClaimed: true
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
        status: "assigned",
        driverCommissionRate: commissionRate.toString(),
        driverCommissionAmount: commissionAmount.toString(),
        commissionProcessed: false,
        updatedAt: new Date()
      });
    } catch (updErr) {
      console.error("⚠️ خطأ عند تحديث قاعدة البيانات لاستلام الطلب (تحويل احتياطي):", updErr);
      order.driverId = driverId;
      order.status = "assigned";
      updatedOrder = order;
    }

    if (!updatedOrder) {
      order.driverId = driverId;
      order.status = "assigned";
      updatedOrder = order;
    }

    try {
      broadcastEvent('order_claimed', {
        orderId: id,
        orderNumber: order.orderNumber,
        driverId,
        driverName: driver.name,
        isWaselLi: false
      });
      broadcastEvent('order_update', {
        orderId: id,
        orderNumber: order.orderNumber,
        status: 'assigned',
        driverId,
        driverName: driver.name,
        type: 'regular'
      });
    } catch (_) {}

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
            status: 'assigned',
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
    let { status, location } = req.body;
    const driverId = req.driverId!;

    let order = await storage.getOrder(id);
    if (!order) {
      try {
        const allOrders = await storage.getOrders();
        order = (allOrders || []).find((o: any) => o.id === id);
      } catch (_) {}
    }

    if (!order) {
      try {
        const wasalni = await storage.getWasalniRequest(id);
        if (wasalni) {
          if (wasalni.driverId && wasalni.driverId !== driverId) {
            return res.status(403).json({ error: "غير مصرح لك بتحديث هذا الطلب" });
          }
          if (status === "on_the_way") status = "on_way";
          const updatedWasalni = await storage.updateWasalniRequest(id, { status });
          if (location) {
            await storage.updateDriver(driverId, { currentLocation: location });
          }
          return res.json({ success: true, order: updatedWasalni });
        }
      } catch (_) {}
      return res.status(404).json({ error: "الطلب غير موجود" });
    }
    if (order.driverId && order.driverId !== driverId) return res.status(403).json({ error: "غير مصرح لك بتحديث هذا الطلب" });

    // تطبيع حالة في الطريق
    if (status === "on_the_way") {
      status = "on_way";
    }

    const allowedStatuses = ["assigned", "accepted", "preparing", "ready", "picked_up", "on_way", "on_the_way", "delivered"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "حالة غير صحيحة" });

    if (location) {
      await storage.updateDriver(driverId, { currentLocation: location });
    }

    let updatedOrder: any = null;
    if (status === "delivered") {
      try {
        updatedOrder = await storage.completeOrder(id);
      } catch (completeErr) {
        console.error("⚠️ خطأ عند تنفيذ completeOrder (تحويل احتياطي):", completeErr);
      }
      if (!updatedOrder) {
        updatedOrder = await storage.updateOrder(id, {
          status: "delivered",
          commissionProcessed: true,
          updatedAt: new Date()
        });
        await storage.updateDriver(driverId, { isAvailable: true }).catch(() => {});
      }
    } else {
      updatedOrder = await storage.updateOrder(id, { status, updatedAt: new Date() });
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
    const driver = await storage.getDriver(driverId);
    
    let order = await storage.getOrder(id);
    let orderDataToReturn: any = null;

    if (!order || (order.driverId && order.driverId !== driverId)) {
      try {
        const wasalni = await storage.getWasalniRequest(id);
        if (wasalni && (!wasalni.driverId || wasalni.driverId === driverId)) {
          orderDataToReturn = {
            id: wasalni.id,
            orderNumber: wasalni.requestNumber || wasalni.id.slice(-6),
            customerName: wasalni.customerName,
            customerPhone: wasalni.customerPhone,
            deliveryAddress: wasalni.toAddress,
            toAddress: wasalni.toAddress,
            fromAddress: wasalni.fromAddress,
            customerLocationLat: wasalni.toLat,
            customerLocationLng: wasalni.toLng,
            toLat: wasalni.toLat,
            toLng: wasalni.toLng,
            fromLat: wasalni.fromLat,
            fromLng: wasalni.fromLng,
            restaurantLatitude: wasalni.fromLat,
            restaurantLongitude: wasalni.fromLng,
            restaurantAddress: wasalni.fromAddress,
            restaurantName: 'موقع الاستلام (وصل لي)',
            restaurantPhone: wasalni.customerPhone,
            status: wasalni.status,
            totalAmount: String(wasalni.estimatedFee || "0"),
            driverEarnings: String(wasalni.estimatedFee || "0"),
            driverId: wasalni.driverId,
            notes: wasalni.notes,
            isWasalni: true,
            items: JSON.stringify([{ name: wasalni.orderType || 'طرد وصل لي', quantity: 1, price: wasalni.estimatedFee || 0 }]),
            createdAt: wasalni.createdAt,
            updatedAt: wasalni.updatedAt,
          };
        }
      } catch (_) {}
    } else {
       orderDataToReturn = { ...order };
       if (!orderDataToReturn.restaurantName && orderDataToReturn.restaurantId) {
          try {
             const rest = await storage.getRestaurant(orderDataToReturn.restaurantId);
             if (rest) {
                orderDataToReturn.restaurantName = rest.name;
                orderDataToReturn.restaurantPhone = rest.phone;
                orderDataToReturn.restaurantAddress = rest.address;
                orderDataToReturn.restaurantLatitude = rest.latitude;
                orderDataToReturn.restaurantLongitude = rest.longitude;
             }
          } catch(e) {}
       }
    }

    if (!orderDataToReturn) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    // Calculate Distance
    let driverLat = driver?.latitude ? parseFloat(driver.latitude) : null;
    let driverLng = driver?.longitude ? parseFloat(driver.longitude) : null;
    let storeLat = orderDataToReturn.restaurantLatitude || orderDataToReturn.pickupLocationLat ? parseFloat(orderDataToReturn.restaurantLatitude || orderDataToReturn.pickupLocationLat) : null;
    let storeLng = orderDataToReturn.restaurantLongitude || orderDataToReturn.pickupLocationLng ? parseFloat(orderDataToReturn.restaurantLongitude || orderDataToReturn.pickupLocationLng) : null;
    let customerLat = orderDataToReturn.customerLocationLat ? parseFloat(orderDataToReturn.customerLocationLat) : null;
    let customerLng = orderDataToReturn.customerLocationLng ? parseFloat(orderDataToReturn.customerLocationLng) : null;
    
    if (!storeLat && customerLat) { storeLat = customerLat; storeLng = customerLng; }

    const calcHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    };

    if (driverLat !== null && driverLng !== null) {
        if (storeLat !== null && storeLng !== null) {
            let d = calcHaversine(driverLat, driverLng, storeLat, storeLng);
            orderDataToReturn.distanceKm = d;
            if (d <= 2) orderDataToReturn.distanceClassification = 'قريب جداً';
            else if (d <= 5) orderDataToReturn.distanceClassification = 'متوسط المسافة';
            else orderDataToReturn.distanceClassification = 'بعيد';
        }
        if (customerLat !== null && customerLng !== null) {
            orderDataToReturn.customerDistanceKm = calcHaversine(driverLat, driverLng, customerLat, customerLng);
        }
    }

    res.json(orderDataToReturn);

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

    let driverReviews: any[] = [];
    try {
      const advStorage = new AdvancedDatabaseStorage(storage.db);
      driverReviews = await advStorage.getDriverReviews(driverId);
    } catch (_) {}

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

    try {
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
    } catch (_) {}

    res.json({ success: true, status });
  } catch (error) {
    console.error("خطأ في تحديث حالة السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ملاحظة: مسار /location معرَّف أعلاه (السطر 553) - تمت إزالة النسخة المكررة هنا

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

    // خصم المبلغ من الرصيد المتاح وتحويله لمعلق
    await storage.updateDriverBalance(driverId, {
      amount: amount,
      type: 'withdrawal',
      description: `طلب سحب: ${method || 'كاش'}`,
      orderId: withdrawal.id
    });

    // إرسال إشعار للإدارة بطلب السحب الجديد
    try {
      const driver = await storage.getDriver(driverId);
      const driverName = driver?.name || 'سائق';
      await storage.createNotification({
        type: 'withdrawal_request',
        title: 'طلب سحب رصيد جديد',
        message: `طلب السائق ${driverName} سحب مبلغ ${amount} ر.ي`,
        recipientType: 'admin',
        recipientId: 'all',
        isRead: false
      });
      
      const ws = req.app.get('ws');
      if (ws && typeof ws.sendToAdmin === 'function') {
        ws.sendToAdmin('withdrawal_request', {
          driverId,
          driverName,
          amount,
          timestamp: new Date()
        });
      }
    } catch (notifErr) {
      console.error('⚠️ خطأ في إرسال إشعار السحب للإدارة:', notifErr);
    }

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
    
    // إخفاء كلمة المرور
    const { password: _, ...driverWithoutPassword } = driver;
    res.json({ success: true, driver: driverWithoutPassword });
  } catch (error) {
    console.error("خطأ في جلب الملف الشخصي للسائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تغيير كلمة المرور للسائق
router.put("/change-password", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "يرجى توفير كلمة المرور الحالية وكلمة المرور الجديدة" });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }

    const driver = await storage.getDriver(driverId);
    if (!driver) {
      return res.status(404).json({ error: "السائق غير موجود" });
    }

    // التحقق من صحة كلمة المرور الحالية (يدعم النص الصريح أو المشفر)
    let isPasswordValid = false;
    if (driver.password) {
      if (driver.password.startsWith('$2')) {
        isPasswordValid = await bcrypt.compare(currentPassword, driver.password);
      } else {
        isPasswordValid = (driver.password === currentPassword);
      }
    }

    if (!isPasswordValid) {
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedDriver = await storage.updateDriver(driverId, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    if (!updatedDriver) {
      return res.status(500).json({ error: "فشل تحديث كلمة المرور" });
    }

    res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("خطأ في تغيير كلمة المرور للسائق:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
});

// تحديث الملف الشخصي للسائق
router.put("/profile", requireDriverAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const driverId = req.driverId!;
    const driver = await storage.getDriver(driverId);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });

    // التحقق من صلاحية تعديل الملف الشخصي الممنوحة من الإدارة
    if (driver.allowProfileEdit === false) {
      return res.status(403).json({
        error: "تعديل الملف الشخصي موقوف حالياً من قبل الإدارة. يرجى التواصل مع الإدارة لإجراء التعديلات."
      });
    }

    const {
      name,
      email,
      phone,
      vehicleType,
      vehicleNumber,
      isAvailable,
      currentLocation,
      password,
      currentPassword,
      newPassword
    } = req.body;

    const updates: any = {};

    // التحقق من تكرار الهاتف إذا تم تغييره
    if (phone !== undefined && typeof phone === 'string' && phone.trim()) {
      const cleanPhone = phone.trim();
      if (cleanPhone !== driver.phone) {
        const allDrivers = await storage.getDrivers();
        const conflict = allDrivers.find(d => d.id !== driverId && d.phone === cleanPhone);
        if (conflict) {
          return res.status(400).json({ error: "رقم الهاتف مسجل بالفعل لسائق آخر" });
        }
      }
      updates.phone = cleanPhone;
    }

    // التحقق من تكرار البريد إذا تم تغييره
    if (email !== undefined && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== (driver.email || '').toLowerCase()) {
        const allDrivers = await storage.getDrivers();
        const conflict = allDrivers.find(d => d.id !== driverId && d.email && d.email.toLowerCase() === cleanEmail);
        if (conflict) {
          return res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل لسائق آخر" });
        }
      }
      updates.email = cleanEmail;
    }

    if (name !== undefined && typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (vehicleType !== undefined) {
      updates.vehicleType = String(vehicleType || '');
    }

    if (vehicleNumber !== undefined) {
      updates.vehicleNumber = String(vehicleNumber || '');
    }

    if (isAvailable !== undefined) {
      updates.isAvailable = Boolean(isAvailable);
    }

    if (currentLocation !== undefined) {
      updates.currentLocation = String(currentLocation || '');
    }

    // معالجة تغيير كلمة المرور الاختياري ضمن تحديث الملف
    if (newPassword && typeof newPassword === 'string' && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
      }
      if (currentPassword) {
        let isMatch = false;
        if (driver.password) {
          if (driver.password.startsWith('$2')) {
            isMatch = await bcrypt.compare(currentPassword, driver.password);
          } else {
            isMatch = (driver.password === currentPassword);
          }
        }
        if (!isMatch) {
          return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
        }
      }
      updates.password = await bcrypt.hash(newPassword.trim(), 10);
    } else if (password && typeof password === 'string' && password.trim() && !password.startsWith('$2')) {
      updates.password = await bcrypt.hash(password.trim(), 10);
    }

    updates.updatedAt = new Date();

    const updatedDriver = await storage.updateDriver(driverId, updates);
    if (!updatedDriver) {
      return res.status(500).json({ error: "فشل حفظ تعديلات الملف الشخصي" });
    }

    // بث التحديث للوحة التحكم والـ WebSocket
    try {
      broadcastEvent('driver_updated', {
        driverId,
        driver: updatedDriver,
        timestamp: new Date()
      });
      if (updates.isAvailable !== undefined) {
        broadcastEvent('driver_status_update', {
          driverId,
          isAvailable: updatedDriver.isAvailable,
          name: updatedDriver.name,
          timestamp: new Date()
        });
      }
    } catch (_) {}

    const ws = req.app.get('ws');
    if (ws) {
      try {
        if (typeof ws.broadcast === 'function') {
          ws.broadcast('driver_status_update', {
            driverId,
            isAvailable: updatedDriver.isAvailable,
            name: updatedDriver.name,
            timestamp: new Date()
          });
        }
        if (typeof ws.sendToAdmin === 'function') {
          ws.sendToAdmin('driver_status_update', {
            driverId,
            isAvailable: updatedDriver.isAvailable,
            name: updatedDriver.name
          });
        }
      } catch (_) {}
    }

    const { password: _, ...safeDriver } = updatedDriver;
    res.json({ success: true, driver: safeDriver, message: "تم تحديث الملف الشخصي بنجاح" });
  } catch (error: any) {
    console.error("خطأ في تحديث الملف الشخصي للسائق:", error);
    res.status(400).json({ error: error?.message || "بيانات غير صحيحة" });
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

    const driver = await storage.getDriver(driverId);
    const driverLat = driver?.latitude ? parseFloat(driver.latitude) : null;
    const driverLng = driver?.longitude ? parseFloat(driver.longitude) : null;

    let allRequests: any[] = [];
    try {
      allRequests = await storage.getWasalniRequests();
    } catch (e) {
      console.error("خطأ في جلب طلبات وصل لي:", e);
      allRequests = [];
    }

    if (status === 'available') {
      // جميع طلبات وصل لي غير المعينة بانتظار الاستلام
      allRequests = allRequests.filter((r: any) =>
        !['delivered', 'cancelled', 'completed', 'assigned'].includes(r.status) &&
        !r.driverId
      );
    } else if (status === 'active') {
      allRequests = allRequests.filter((r: any) =>
        r.driverId === driverId && ['pending', 'confirmed', 'assigned', 'accepted', 'preparing', 'ready', 'picked_up', 'on_way'].includes(r.status)
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
      let customerDistanceKm: number | null = null;
      let distanceClassification: string | null = null;

      const fromLat = r.fromLat ? parseFloat(r.fromLat) : null;
      const fromLng = r.fromLng ? parseFloat(r.fromLng) : null;
      const toLat = r.toLat ? parseFloat(r.toLat) : null;
      const toLng = r.toLng ? parseFloat(r.toLng) : null;

      const calcHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
      };

      if (driverLat !== null && driverLng !== null) {
        if (fromLat !== null && fromLng !== null) {
          distanceKm = calcHaversine(driverLat, driverLng, fromLat, fromLng);
          if (distanceKm <= 2) distanceClassification = 'قريب جداً';
          else if (distanceKm <= 5) distanceClassification = 'متوسط المسافة';
          else distanceClassification = 'بعيد';
        }
        if (toLat !== null && toLng !== null) {
          customerDistanceKm = calcHaversine(driverLat, driverLng, toLat, toLng);
        }
      }

      return {
        ...r,
        distanceKm,
        customerDistanceKm,
        distanceClassification,
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

    const driver = await storage.getDriver(driverId);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });

    let request = await storage.getWasalniRequest(id);
    if (!request) {
      const all = await storage.getWasalniRequests();
      request = all.find((r: any) => r.id === id);
    }
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // الفحص ضد التزامن: هل تم استلام الطلب من سائق آخر؟
    if (request.driverId && request.driverId !== driverId) {
      let otherDriverName = "سائق آخر";
      try {
        const otherDriver = await storage.getDriver(request.driverId);
        if (otherDriver) otherDriverName = otherDriver.name;
      } catch (_) {}
      return res.status(400).json({
        error: `عذراً، تم استلام هذا الطلب بالفعل من قِبل السائق: ${otherDriverName}`,
        driverName: otherDriverName,
        alreadyClaimed: true
      });
    }

    if (['delivered', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ error: "طلب وصل لي هذا ملغي أو مسبوق تسليمه" });
    }

    let updated: any = null;
    try {
      updated = await storage.updateWasalniRequest(id, { driverId, status: 'on_way' });
    } catch (updErr) {
      console.error("⚠️ خطأ عند تحديث طلب وصل لي في التخزين:", updErr);
      request.driverId = driverId;
      request.status = 'on_way';
      updated = request;
    }

    if (!updated) {
      request.driverId = driverId;
      request.status = 'on_way';
      updated = request;
    }

    try {
      broadcastEvent('order_claimed', {
        orderId: id,
        orderNumber: request.requestNumber,
        driverId,
        driverName: driver.name,
        isWaselLi: true
      });
      broadcastEvent('order_update', {
        orderId: id,
        orderNumber: request.requestNumber,
        status: 'on_way',
        driverId,
        driverName: driver.name,
        type: 'wasalni'
      });
    } catch (_) {}

    const ws = req.app.get('ws');
    if (ws) {
      try {
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
      } catch (wsErr) {
        console.error("⚠️ خطأ بث WebSocket لاستلام وصل لي:", wsErr);
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

    let request = await storage.getWasalniRequest(id);
    if (!request) {
      const all = await storage.getWasalniRequests();
      request = all.find((r: any) => r.id === id);
    }
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // إن لم يكن محدد السائق بعد، يُسمح بالاستلام
    if (!request.driverId) {
      request.driverId = driverId;
    } else if (request.driverId !== driverId) {
      return res.status(403).json({ error: "غير مصرح لك بتحديث هذا الطلب" });
    }

    const allowedStatuses = ['on_way', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "حالة غير صحيحة" });

    let updated: any = null;
    try {
      updated = await storage.updateWasalniRequest(id, { driverId, status });
    } catch (updErr) {
      console.error("⚠️ خطأ عند تحديث حالة طلب وصل لي:", updErr);
      request.driverId = driverId;
      request.status = status;
      updated = request;
    }

    if (!updated) {
      request.driverId = driverId;
      request.status = status;
      updated = request;
    }

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
    const existing = await storage.getDriver(id);
    if (!existing) {
      return res.status(404).json({ message: "السائق غير موجود" });
    }

    const coercedData = coerceRequestData(req.body);
    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...cleanData } = coercedData;

    // تشفير كلمة المرور إذا تم تعديلها
    if (cleanData.password && typeof cleanData.password === 'string' && cleanData.password.trim() && !cleanData.password.startsWith('$2')) {
      cleanData.password = await bcrypt.hash(cleanData.password.trim(), 10);
    }

    cleanData.updatedAt = new Date();

    const driver = await storage.updateDriver(id, cleanData);
    if (!driver) {
      return res.status(404).json({ message: "فشل تحديث بيانات السائق" });
    }

    try {
      broadcastEvent('driver_updated', { driverId: id, driver, timestamp: new Date() });
    } catch (_) {}

    const ws = req.app.get('ws');
    if (ws) {
      try {
        if (typeof ws.broadcast === 'function') {
          ws.broadcast('driver_status_update', {
            driverId: id,
            isAvailable: driver.isAvailable,
            name: driver.name,
            timestamp: new Date()
          });
        }
      } catch (_) {}
    }

    res.json(driver);
  } catch (error: any) {
    console.error("خطأ في تحديث بيانات السائق من الإدارة:", error);
    res.status(400).json({ message: error?.message || "بيانات السائق غير صحيحة" });
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
