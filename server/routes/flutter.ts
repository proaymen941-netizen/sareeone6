import express from "express";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { deviceTokens, notifications, notificationReplies } from "../../shared/schema.js";
import { eq, and, gt, desc, or } from "drizzle-orm";

const router = express.Router();

function getDb() {
  return db;
}

// GET /api/flutter/app-config
// يُعيد إعدادات التطبيق للـ Flutter app
router.get("/app-config", async (req, res) => {
  try {
    const settings = await storage.getUiSettings();

    const getValue = (key: string, fallback: any = "") => {
      if (!Array.isArray(settings)) return fallback;
      const setting = settings.find((s: any) => s.key === key);
      return setting ? setting.value : fallback;
    };

    const serverUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:${process.env.PORT || 5000}`;

    const config = {
      splashEnabled: getValue("splashEnabled", "true") !== "false",
      splashImageUrl: getValue("splashImageUrl", ""),
      splashImageUrl2: getValue("splashImageUrl2", ""),
      splashTitle: getValue("splashTitle", "السريع ون"),
      splashSubtitle: getValue("splashSubtitle", "متجر الخضار والفواكه"),
      splashBackgroundColor: getValue("splashBackgroundColor", "#FFFFFF"),
      splashDuration: parseInt(getValue("splashDuration", "3000"), 10),
      appName: getValue("appName", "السريع ون"),
      appVersion: getValue("appVersion", "1.1.0"),
      primaryColor: getValue("primaryColor", "#E53935"),
      secondaryColor: getValue("secondaryColor", "#4CAF50"),
      accentColor: getValue("accentColor", "#FF9800"),
      logoUrl: getValue("logoUrl", ""),
      webAppUrl: getValue("webAppUrl", serverUrl),
      storeStatus: getValue("storeStatus", "open"),
      privacyPolicyText: getValue("privacyPolicyText", ""),
      showSearchBar: getValue("showSearchBar", "true") !== "false",
      showCategories: getValue("showCategories", "true") !== "false",
      showSpecialOffers: getValue("showSpecialOffers", "true") !== "false",
      showSupportButton: getValue("showSupportButton", "true") !== "false",
      supportWhatsapp: getValue("supportWhatsapp", "966500000000"),
      openingTime: getValue("openingTime", "08:00"),
      closingTime: getValue("closingTime", "23:00"),
      serverUrl,
    };

    res.json({ success: true, config });
  } catch (error) {
    console.error("خطأ في جلب إعدادات Flutter:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// POST /api/flutter/register-token
// يسجّل رمز FCM لجهاز المستخدم
router.post("/register-token", async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token مطلوب" });
    }

    const db = getDb();

    await db
      .insert(deviceTokens)
      .values({
        token,
        platform: platform || "android",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          platform: platform || "android",
          isActive: true,
          updatedAt: new Date(),
        },
      });

    res.json({ success: true, message: "تم تسجيل الجهاز بنجاح" });
  } catch (error) {
    console.error("خطأ في تسجيل رمز FCM:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// POST /api/flutter/deregister-token
// يلغي تسجيل رمز FCM عند تسجيل الخروج
router.post("/deregister-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token مطلوب" });
    }

    const db = getDb();

    await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(deviceTokens.token, token));

    res.json({ success: true, message: "تم إلغاء تسجيل الجهاز" });
  } catch (error) {
    console.error("خطأ في إلغاء رمز FCM:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// GET /api/flutter/notifications/poll?since=<ISO_TIMESTAMP>
// تطبيق Flutter يستدعي هذا endpoint دورياً لجلب الإشعارات الجديدة
// يُعيد إشعارات من نوع "all" أو "customer" أُنشئت بعد الـ timestamp المحدد
router.get("/notifications/poll", async (req, res) => {
  try {
    const db = getDb();
    const since = req.query.since as string | undefined;

    let sinceDate: Date;
    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
    } else {
      sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const newNotifications = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        recipientType: notifications.recipientType,
        orderId: notifications.orderId,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          or(
            eq(notifications.recipientType, "all"),
            eq(notifications.recipientType, "customer"),
            eq(notifications.recipientType, "flutter")
          ),
          gt(notifications.createdAt, sinceDate)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    res.json({
      success: true,
      notifications: newNotifications,
      count: newNotifications.length,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("خطأ في جلب إشعارات Flutter:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// POST /api/flutter/notifications/send
// لوحة التحكم ترسل إشعار مباشرة لكل أجهزة Flutter
router.post("/notifications/send", async (req, res) => {
  try {
    const { title, message, type = "info", recipientType = "flutter" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "العنوان والمحتوى مطلوبان" });
    }

    const db = getDb();

    const newNotification = await storage.createNotification({
        type,
        title,
        message,
        recipientType,
        recipientId: null,
        isRead: false,
      });

    res.json({
      success: true,
      message: "تم إرسال الإشعار بنجاح لجميع أجهزة التطبيق",
      notification: newNotification,
    });
  } catch (error) {
    console.error("خطأ في إرسال إشعار Flutter:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// POST /api/flutter/notifications/send-targeted
// إرسال إشعار موجّه لفئة محددة أو مستخدم معين
router.post("/notifications/send-targeted", async (req, res) => {
  try {
    const { 
      title, 
      message, 
      type = "info", 
      recipientType = "all", 
      recipientId = null,
      recipientName = null,
      allowReplies = true 
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "العنوان والمحتوى مطلوبان" });
    }

    const newNotification = await storage.createNotification({
      type,
      title,
      message,
      recipientType,
      recipientId: recipientId || null,
      recipientName: recipientName || null,
      allowReplies: allowReplies !== false,
      isRead: false,
    });

    const recipientLabel =
      recipientType === 'all' ? 'جميع المستخدمين (العملاء والسائقون وزوار التطبيق)' :
      recipientType === 'customer' ? (recipientName ? `العميل (${recipientName})` : 'جميع العملاء') :
      recipientType === 'driver' ? (recipientName ? `السائق (${recipientName})` : 'جميع السائقين') :
      recipientType === 'flutter' ? 'مستخدمي التطبيق' :
      'المستلم المحدد';

    res.json({
      success: true,
      message: `تم إرسال الإشعار بنجاح إلى ${recipientLabel}`,
      notification: newNotification,
    });
  } catch (error) {
    console.error("خطأ في إرسال الإشعار الموجّه:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// GET /api/flutter/notifications/history
// سجل جميع الإشعارات المرسلة مع عدد الردود
router.get("/notifications/history", async (req, res) => {
  try {
    const db = getDb();
    const { recipientType, type: notifType, limit: limitStr, offset: offsetStr } = req.query;

    const limitNum = parseInt(limitStr as string) || 50;
    const offsetNum = parseInt(offsetStr as string) || 0;

    const allNotifications = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));

    let filtered = allNotifications;
    if (recipientType && recipientType !== 'all') {
      filtered = filtered.filter(n => n.recipientType === recipientType);
    }
    if (notifType) {
      filtered = filtered.filter(n => n.type === notifType);
    }

    // Get all replies for count aggregation
    const allReplies = await storage.getAllNotificationReplies().catch(() => []);
    const replyCountMap: Record<string, number> = {};
    allReplies.forEach(r => {
      replyCountMap[r.notificationId] = (replyCountMap[r.notificationId] || 0) + 1;
    });

    const paginated = filtered.slice(offsetNum, offsetNum + limitNum).map(n => ({
      ...n,
      replyCount: replyCountMap[n.id] || 0,
    }));
    const unreadCount = filtered.filter(n => !n.isRead).length;

    res.json({
      success: true,
      notifications: paginated,
      total: filtered.length,
      unreadCount,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("خطأ في جلب سجل الإشعارات:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// PUT /api/flutter/notifications/:id/allow-replies
// تفعيل أو تعطيل ميزة الرد على إشعار محدد
router.put("/notifications/:id/allow-replies", async (req, res) => {
  try {
    const { id } = req.params;
    const { allowReplies } = req.body;

    const updated = await storage.updateNotificationAllowReplies(id, !!allowReplies);
    if (!updated) {
      return res.status(404).json({ success: false, message: "الإشعار غير موجود" });
    }

    res.json({
      success: true,
      message: allowReplies ? "تم تفعيل الردود على هذا الإشعار" : "تم إلغاء ميزة الردود على هذا الإشعار",
      notification: updated,
    });
  } catch (error) {
    console.error("خطأ في تحديث حالة الردود:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// GET /api/flutter/notifications/replies
// جلب جميع ردود العملاء على الإشعارات
router.get("/notifications/replies", async (req, res) => {
  try {
    const { notificationId } = req.query;
    let replies: any[] = [];

    if (notificationId) {
      replies = await storage.getNotificationReplies(notificationId as string);
    } else {
      replies = await storage.getAllNotificationReplies();
    }

    // إرفاق معلومات الإشعار المرتبط بكل رد
    const db = getDb();
    const allNotifs = await db.select().from(notifications);
    const notifMap = new Map(allNotifs.map(n => [n.id, n]));

    const enriched = replies.map(r => ({
      ...r,
      notificationTitle: notifMap.get(r.notificationId)?.title || "إشعار عام",
      notificationMessage: notifMap.get(r.notificationId)?.message || "",
      notificationType: notifMap.get(r.notificationId)?.type || "info",
    }));

    res.json({
      success: true,
      replies: enriched,
      count: enriched.length,
      unreadCount: enriched.filter(r => !r.isRead).length,
    });
  } catch (error) {
    console.error("خطأ في جلب ردود الإشعارات:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// POST /api/flutter/notifications/:id/reply
// إرسال رد على إشعار من قِبل العميل أو المشرف
router.post("/notifications/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { message, senderType = 'customer', senderId, senderName, senderPhone } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "نص الرد مطلوب" });
    }

    const db = getDb();
    const [notif] = await db.select().from(notifications).where(eq(notifications.id, id));

    if (!notif) {
      return res.status(404).json({ success: false, message: "الإشعار غير موجود" });
    }

    if (notif.allowReplies === false) {
      return res.status(403).json({ success: false, message: "ميزة الرد غير مفعلة لهذا الإشعار" });
    }

    const newReply = await storage.createNotificationReply({
      notificationId: id,
      senderType,
      senderId: senderId || null,
      senderName: senderName || 'عميل',
      senderPhone: senderPhone || null,
      message: message.trim(),
      isRead: false,
    });

    res.json({
      success: true,
      message: "تم إرسال ردك بنجاح",
      reply: newReply,
    });
  } catch (error) {
    console.error("خطأ في إرسال الرد:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// GET /api/flutter/notifications/:id/replies
// جلب الردود الخاصة بإشعار محدد
router.get("/notifications/:id/replies", async (req, res) => {
  try {
    const { id } = req.params;
    const replies = await storage.getNotificationReplies(id);
    res.json({
      success: true,
      replies,
      count: replies.length,
    });
  } catch (error) {
    console.error("خطأ في جلب ردود الإشعار:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// PUT /api/flutter/notifications/replies/:replyId/read
// تعليم رد كمقروء
router.put("/notifications/replies/:replyId/read", async (req, res) => {
  try {
    const { replyId } = req.params;
    await storage.markNotificationReplyAsRead(replyId);
    res.json({ success: true, message: "تم تحديث حالة الرد" });
  } catch (error) {
    console.error("خطأ في تعليم الرد كمقروء:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// DELETE /api/flutter/notifications/replies/:replyId
// حذف رد على إشعار
router.delete("/notifications/replies/:replyId", async (req, res) => {
  try {
    const { replyId } = req.params;
    await storage.deleteNotificationReply(replyId);
    res.json({ success: true, message: "تم حذف الرد بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف الرد:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// DELETE /api/flutter/notifications/:id
// حذف إشعار
router.delete("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // حذف الردود المرتبطة أولاً
    await db.delete(notificationReplies).where(eq(notificationReplies.notificationId, id)).catch(() => {});
    await db.delete(notifications).where(eq(notifications.id, id));

    res.json({ success: true, message: "تم حذف الإشعار بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف الإشعار:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// GET /api/flutter/notifications/stats
// إحصائيات الإشعارات
router.get("/notifications/stats", async (req, res) => {
  try {
    const db = getDb();
    const allNotifications = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
    const deviceCount = await db.select().from(deviceTokens).where(eq(deviceTokens.isActive, true));

    const total = allNotifications.length;
    const unread = allNotifications.filter(n => !n.isRead).length;
    const byType: Record<string, number> = {};
    const byRecipient: Record<string, number> = {};

    allNotifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
      byRecipient[n.recipientType] = (byRecipient[n.recipientType] || 0) + 1;
    });

    res.json({
      success: true,
      total,
      unread,
      readRate: total > 0 ? ((total - unread) / total * 100).toFixed(1) : '0',
      deviceCount: deviceCount.length,
      byType,
      byRecipient,
    });
  } catch (error) {
    console.error("خطأ في جلب إحصائيات الإشعارات:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// POST /api/flutter/device-token
// يُستخدم لتسجيل توكن الجهاز (FCM) للإشعارات
router.post("/device-token", async (req, res) => {
  try {
    const { token, platform, userId, driverId } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const db = getDb();
    
    // Check if token already exists
    const [existing] = await db.select().from(deviceTokens).where(eq(deviceTokens.token, token));
    
    if (existing) {
      await db.update(deviceTokens)
        .set({ 
          userId: userId || existing.userId,
          driverId: driverId || existing.driverId,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(deviceTokens.id, existing.id));
    } else {
      await db.insert(deviceTokens).values({
        token,
        platform: platform || 'android',
        userId: userId || null,
        driverId: driverId || null,
        isActive: true
      });
    }

    res.json({ success: true, message: "Token registered successfully" });
  } catch (error) {
    console.error("Error registering device token:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// GET /api/flutter/device-tokens
// يُعيد قائمة الأجهزة المسجّلة (للمشرف)
router.get("/device-tokens", async (req, res) => {
  try {
    const db = getDb();
    const tokens = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.isActive, true));

    res.json({ success: true, tokens, count: tokens.length });
  } catch (error) {
    console.error("خطأ في جلب device tokens:", error);
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

export default router;
