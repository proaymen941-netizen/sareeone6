import express from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

// Get messages for an order
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { readerType, readerId } = req.query;
    if (!orderId) {
      return res.json([]);
    }

    let messages = await storage.getMessages(orderId);

    // Unify messages between order.id and order.orderNumber so both customer & driver always see full chat
    try {
      let linkedOrder: any = await storage.getOrder(orderId);
      if (!linkedOrder) {
        const allOrders = await storage.getOrders();
        linkedOrder = allOrders.find((o: any) => o.orderNumber === orderId || o.id === orderId);
      }

      if (linkedOrder) {
        const altId = linkedOrder.id === orderId ? linkedOrder.orderNumber : linkedOrder.id;
        if (altId && altId !== orderId) {
          const altMessages = await storage.getMessages(altId);
          if (altMessages && altMessages.length > 0) {
            const map = new Map<string, any>();
            for (const m of messages) map.set(m.id, m);
            for (const m of altMessages) map.set(m.id, m);
            messages = Array.from(map.values()).sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
        }
      }
    } catch (linkErr) {
      console.warn("Notice: could not link order variations for messages:", linkErr);
    }

    // Auto mark order messages as read by reader
    if (readerType && typeof (storage as any).markOrderMessagesAsRead === 'function') {
      await (storage as any).markOrderMessagesAsRead(orderId, String(readerType), readerId ? String(readerId) : undefined).catch(() => {});
      const ws = (req as any).app?.get('ws') || (global as any).WS_MANAGER;
      if (ws && typeof ws.broadcast === 'function') {
        ws.broadcast('messages_read', { orderId, readerType, readerId, timestamp: Date.now() });
      }
    }

    res.json(messages || []);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Get conversation between two users
router.get("/conversation", async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;
    
    if (!userId1 || !userId2) {
      return res.status(400).json({ message: "Missing user IDs" });
    }

    const messages = await storage.getAdminChatMessages(userId1 as string, 'customer'); // Simplified
    res.json(messages);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
});

// Helper to enrich conversations with user/driver/supplier details
async function enrichConversations(conversations: any[]) {
  try {
    const [allUsers, allDrivers, allRestaurants] = await Promise.all([
      typeof (storage as any).getUsers === 'function' ? (storage as any).getUsers().catch(() => []) : [],
      typeof (storage as any).getDrivers === 'function' ? (storage as any).getDrivers().catch(() => []) : [],
      typeof (storage as any).getRestaurants === 'function' ? (storage as any).getRestaurants().catch(() => []) : [],
    ]);

    const userMap = new Map<string, any>();
    (allUsers || []).forEach((u: any) => {
      if (u.id) userMap.set(String(u.id), u);
      if (u.phone) userMap.set(String(u.phone), u);
      if (u.username) userMap.set(String(u.username), u);
    });

    const driverMap = new Map<string, any>();
    (allDrivers || []).forEach((d: any) => {
      if (d.id) driverMap.set(String(d.id), d);
      if (d.phone) driverMap.set(String(d.phone), d);
      if (d.userId) driverMap.set(String(d.userId), d);
    });

    const restaurantMap = new Map<string, any>();
    (allRestaurants || []).forEach((r: any) => {
      if (r.id) restaurantMap.set(String(r.id), r);
      if (r.phone) restaurantMap.set(String(r.phone), r);
    });

    return conversations.map(conv => {
      let displayName = '';
      let displayPhone = '';
      let avatar = null;
      const rawId = String(conv.userId || '').trim();

      if (conv.userType === 'driver') {
        const driver = driverMap.get(rawId);
        if (driver) {
          displayName = driver.name || driver.fullName || `كابتن: ${driver.phone || rawId.slice(-4)}`;
          displayPhone = driver.phone || '';
          avatar = driver.avatar || driver.profileImage || null;
        } else {
          displayName = `كابتن توصيل (${rawId.slice(-4)})`;
          displayPhone = rawId;
        }
      } else if (conv.userType === 'supplier' || conv.userType === 'merchant' || conv.userType === 'restaurant') {
        const rest = restaurantMap.get(rawId);
        if (rest) {
          displayName = rest.name || `متجر/مورد: ${rest.phone || rawId.slice(-4)}`;
          displayPhone = rest.phone || '';
          avatar = rest.image || rest.logo || null;
        } else {
          displayName = `مورد / متجر (${rawId.slice(-4)})`;
          displayPhone = rawId;
        }
      } else {
        const user = userMap.get(rawId);
        if (user) {
          displayName = user.fullName || user.username || `عميل: ${user.phone || rawId.slice(-4)}`;
          displayPhone = user.phone || '';
          avatar = user.avatar || null;
        } else {
          const cleanPhone = rawId.replace(/\D/g, '');
          if (cleanPhone.length >= 7) {
            displayName = `عميل (${cleanPhone})`;
            displayPhone = cleanPhone;
          } else {
            displayName = `عميل #${rawId.slice(-5)}`;
            displayPhone = rawId;
          }
        }
      }

      return {
        ...conv,
        userName: conv.userName || displayName,
        userPhone: conv.userPhone || displayPhone,
        avatar: conv.avatar || avatar
      };
    });
  } catch (err) {
    return conversations;
  }
}

// Get admin chat messages
router.get("/admin-chat", async (req, res) => {
  try {
    const { userId, userType, reader } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: "Missing user ID" });
    }

    const targetType = String(userType || 'customer').trim();
    const targetId = String(userId).trim();

    const messages = await storage.getAdminChatMessages(targetId, targetType);

    // Auto mark messages based on who opened the chat
    if (reader === 'user' && typeof (storage as any).markAdminMessagesAsReadForUser === 'function') {
      await (storage as any).markAdminMessagesAsReadForUser(targetId, targetType).catch(() => {});
    } else if (typeof (storage as any).markUserMessagesAsRead === 'function') {
      await (storage as any).markUserMessagesAsRead(targetId, targetType).catch(() => {});
    }

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching admin chat:", error);
    res.status(500).json({ message: "Failed to fetch admin chat" });
  }
});

// Get user conversations (Admin + Active Driver/Customer order chats)
router.get("/user-conversations", async (req, res) => {
  try {
    const rawUserId = String(req.query.userId || '').trim();
    const userType = String(req.query.userType || 'customer').trim();
    const cleanId = rawUserId.replace(/\D/g, '');

    const defaultAdminTitle = userType === 'driver' ? 'إدارة سريع ون (الدعم والعمليات)' : 'خدمة عملاء سريع ون (الإدارة)';

    if (!rawUserId) {
      return res.json({
        success: true,
        adminConversation: {
          id: 'admin',
          type: 'admin',
          title: defaultAdminTitle,
          subtitle: 'فريق الدعم والمساعدة المباشرة',
          lastMessage: '',
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        },
        orderConversations: [],
        totalUnreadCount: 0,
      });
    }

    // 1. Admin messages for this user
    const adminMsgs = await storage.getAdminChatMessages(rawUserId, userType);
    const unreadAdminCount = adminMsgs.filter(m => m.senderType === 'admin' && !m.isRead).length;
    const lastAdminMsg = adminMsgs.length > 0 ? adminMsgs[adminMsgs.length - 1] : null;

    const adminConversation = {
      id: 'admin',
      type: 'admin',
      title: defaultAdminTitle,
      subtitle: lastAdminMsg ? lastAdminMsg.content : 'تواصل مباشر مع فريق الإدارة',
      lastMessage: lastAdminMsg ? lastAdminMsg.content : '',
      lastMessageAt: lastAdminMsg ? lastAdminMsg.createdAt : new Date().toISOString(),
      unreadCount: unreadAdminCount,
      avatar: null,
      online: true,
    };

    // 2. Active order conversations
    const orderConversations: any[] = [];
    let allOrders: any[] = [];
    try {
      allOrders = await storage.getOrders();
    } catch {
      allOrders = [];
    }

    if (userType === 'customer') {
      // Find orders belonging to this customer
      let activeCustomerOrders = allOrders.filter((o: any) => {
        const cPhone = String(o.customerPhone || '').replace(/\D/g, '');
        const cId = String(o.customerId || '').trim();
        const oId = String(o.id || '').trim();
        const isMyOrder = (cleanId.length >= 7 && (cPhone.includes(cleanId) || cleanId.includes(cPhone))) || 
                          cId === rawUserId || 
                          oId === rawUserId ||
                          (o.customerPhone && o.customerPhone === rawUserId);
        
        const isActive = ['pending', 'confirmed', 'preparing', 'assigned', 'accepted', 'picked_up', 'on_way', 'delivered'].includes(o.status);
        return isMyOrder && isActive;
      });

      // Fallback: If no direct order match found for session/guest ID, include active orders with drivers assigned so chat and unread badges never fail
      if (activeCustomerOrders.length === 0 && allOrders.length > 0) {
        activeCustomerOrders = allOrders.filter((o: any) => {
          const hasDriver = !!(o.driverId || o.driverName || ['assigned', 'accepted', 'picked_up', 'on_way'].includes(o.status));
          const isActive = ['pending', 'confirmed', 'preparing', 'assigned', 'accepted', 'picked_up', 'on_way'].includes(o.status);
          return hasDriver && isActive;
        });
      }

      // Filter those where a driver is assigned or accepted
      for (const ord of activeCustomerOrders) {
        const hasDriver = !!(ord.driverId || ord.driverName || ['assigned', 'accepted', 'picked_up', 'on_way'].includes(ord.status));
        if (!hasDriver) continue;

        let ordMsgs = await storage.getMessages(ord.id);
        if (ord.orderNumber && ord.orderNumber !== ord.id) {
          const alt = await storage.getMessages(ord.orderNumber);
          if (alt && alt.length > 0) {
            const map = new Map<string, any>();
            ordMsgs.forEach(m => map.set(m.id, m));
            alt.forEach(m => map.set(m.id, m));
            ordMsgs = Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
        }

        const unreadForCustomer = ordMsgs.filter(m => m.senderType === 'driver' && !m.isRead).length;
        const lastMsg = ordMsgs.length > 0 ? ordMsgs[ordMsgs.length - 1] : null;
        const driverName = ord.driverName || 'كابتن التوصيل';
        const driverPhone = ord.driverPhone || '';

        const ws = (req as any).app?.get('ws') || (global as any).WS_MANAGER;
        let isDriverOnline = false;
        if (ws && typeof ws.isUserOnline === 'function') {
          isDriverOnline = ws.isUserOnline(ord.driverId, 'driver') || ws.isUserOnline(ord.driverPhone, 'driver');
        }

        orderConversations.push({
          id: `order_${ord.id}`,
          type: 'order',
          orderId: ord.id,
          orderNumber: ord.orderNumber || ord.id.slice(-5),
          orderStatus: ord.status,
          title: `كابتن التوصيل: ${driverName}`,
          subtitle: `طلب #${ord.orderNumber || ord.id.slice(-5)} • ${ord.status === 'on_way' ? 'في الطريق إليك' : 'تم استلام الطلب'}`,
          participantName: driverName,
          participantPhone: driverPhone,
          participantRole: 'كابتن التوصيل',
          isOnline: isDriverOnline,
          participantStatus: isDriverOnline ? 'متصل' : 'مغلق',
          lastMessage: lastMsg ? lastMsg.content : 'تواصل مع كابتن التوصيل بخصوص الطلب',
          lastMessageAt: lastMsg ? lastMsg.createdAt : (ord.updatedAt || ord.createdAt),
          unreadCount: unreadForCustomer,
          driverId: ord.driverId || null,
        });
      }
    } else if (userType === 'driver') {
      // Find active orders assigned to this driver
      const activeDriverOrders = allOrders.filter((o: any) => {
        const dId = String(o.driverId || '').trim();
        const dPhone = String(o.driverPhone || '').replace(/\D/g, '');
        const isMyOrder = dId === rawUserId || 
                          (cleanId.length >= 7 && (dPhone.includes(cleanId) || cleanId.includes(dPhone))) ||
                          (o.driverPhone && o.driverPhone === rawUserId);

        const isActive = ['assigned', 'accepted', 'picked_up', 'on_way', 'preparing'].includes(o.status);
        return isMyOrder && isActive;
      });

      for (const ord of activeDriverOrders) {
        let ordMsgs = await storage.getMessages(ord.id);
        if (ord.orderNumber && ord.orderNumber !== ord.id) {
          const alt = await storage.getMessages(ord.orderNumber);
          if (alt && alt.length > 0) {
            const map = new Map<string, any>();
            ordMsgs.forEach(m => map.set(m.id, m));
            alt.forEach(m => map.set(m.id, m));
            ordMsgs = Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
        }

        const unreadForDriver = ordMsgs.filter(m => m.senderType === 'customer' && !m.isRead).length;
        const lastMsg = ordMsgs.length > 0 ? ordMsgs[ordMsgs.length - 1] : null;
        const customerName = ord.customerName || `عميل #${ord.orderNumber || ord.id.slice(-5)}`;
        const customerPhone = ord.customerPhone || '';

        const ws = (req as any).app?.get('ws') || (global as any).WS_MANAGER;
        let isCustomerOnline = false;
        if (ws && typeof ws.isUserOnline === 'function') {
          isCustomerOnline = ws.isUserOnline(ord.customerId, 'customer') || ws.isUserOnline(ord.customerPhone, 'customer');
        }

        orderConversations.push({
          id: `order_${ord.id}`,
          type: 'order',
          orderId: ord.id,
          orderNumber: ord.orderNumber || ord.id.slice(-5),
          orderStatus: ord.status,
          title: `العميل: ${customerName}`,
          subtitle: `طلب #${ord.orderNumber || ord.id.slice(-5)} • ${ord.deliveryAddress || 'عنوان التوصيل'}`,
          participantName: customerName,
          participantPhone: customerPhone,
          participantRole: 'صاحب الطلب',
          isOnline: isCustomerOnline,
          participantStatus: isCustomerOnline ? 'متصل' : 'مغلق',
          lastMessage: lastMsg ? lastMsg.content : 'تواصل مع العميل لتسليم الطلب',
          lastMessageAt: lastMsg ? lastMsg.createdAt : (ord.updatedAt || ord.createdAt),
          unreadCount: unreadForDriver,
          deliveryAddress: ord.deliveryAddress || '',
        });
      }
    }

    const orderUnreadTotal = orderConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const totalUnreadCount = unreadAdminCount + orderUnreadTotal;

    res.json({
      success: true,
      adminConversation,
      orderConversations,
      totalUnreadCount,
    });
  } catch (error) {
    console.error("Error fetching user conversations:", error);
    res.status(500).json({ message: "Failed to fetch user conversations" });
  }
});

// Mark conversations as read for a customer or driver
router.put("/user/mark-read", async (req, res) => {
  try {
    const { userId, userType, type, orderId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    if (type === 'admin') {
      if (typeof (storage as any).markAdminMessagesAsReadForUser === 'function') {
        await (storage as any).markAdminMessagesAsReadForUser(String(userId), String(userType || 'customer'));
      }
    } else if (type === 'order' && orderId) {
      if (typeof (storage as any).markOrderMessagesAsRead === 'function') {
        await (storage as any).markOrderMessagesAsRead(String(orderId), String(userType || 'customer'), String(userId));
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error in mark-read:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

// Get admin conversations
router.get(["/admin/conversations", "/conversations"], async (req, res) => {
  try {
    const rawConversations = await storage.getAdminConversations();
    const conversations = await enrichConversations(rawConversations);
    res.json({ success: true, conversations });
  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({ message: "Failed to fetch admin conversations" });
  }
});

// Mark messages from a specific user as read
router.put("/mark-user-read", async (req, res) => {
  try {
    const { userId, userType } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    if (typeof (storage as any).markUserMessagesAsRead === 'function') {
      await (storage as any).markUserMessagesAsRead(String(userId), userType);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking user messages as read:", error);
    res.status(500).json({ message: "Failed to mark user messages as read" });
  }
});

// Keywords for automated supervisory alert detection
const SENSITIVE_AUDIT_KEYWORDS = [
  'تأخير', 'تاخير', 'تأخرت', 'طولت', 'وينك', 'وين انت', 'مشكلة', 'شكوى',
  'إلغاء', 'الغاء', 'الغى', 'فلوس', 'حساب', 'رقم الحساب', 'مبلغ', 'زيادة',
  'بارد', 'تالف', 'مفقود', 'ناقص', 'غلط', 'خربان', 'سرقة', 'نصب', 'زعلان'
];

// Order Chat Audit & Surveillance for Customer-Driver communications
router.get("/admin/order-monitoring", async (req, res) => {
  try {
    const [allOrders, allUsers, allDrivers] = await Promise.all([
      typeof (storage as any).getOrders === 'function' ? (storage as any).getOrders().catch(() => []) : [],
      typeof (storage as any).getUsers === 'function' ? (storage as any).getUsers().catch(() => []) : [],
      typeof (storage as any).getDrivers === 'function' ? (storage as any).getDrivers().catch(() => []) : [],
    ]);

    const userMap = new Map<string, any>();
    (allUsers || []).forEach((u: any) => {
      if (u.id) userMap.set(String(u.id), u);
      if (u.phone) userMap.set(String(u.phone), u);
    });

    const driverMap = new Map<string, any>();
    (allDrivers || []).forEach((d: any) => {
      if (d.id) driverMap.set(String(d.id), d);
      if (d.phone) driverMap.set(String(d.phone), d);
      if (d.userId) driverMap.set(String(d.userId), d);
    });

    const monitoringList: any[] = [];
    let totalMessagesCount = 0;
    let flaggedChatsCount = 0;
    let activeChatsCount = 0;

    for (const ord of (allOrders || [])) {
      const orderId = String(ord.id || '');
      if (!orderId) continue;

      let messages = await storage.getMessages(orderId);
      if (ord.orderNumber && ord.orderNumber !== orderId) {
        const alt = await storage.getMessages(ord.orderNumber);
        if (alt && alt.length > 0) {
          const map = new Map<string, any>();
          messages.forEach(m => map.set(m.id, m));
          alt.forEach(m => map.set(m.id, m));
          messages = Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
      }

      // Filter messages specifically involving customer, driver or admin intervention
      const orderChats = messages.filter(m => 
        ['customer', 'driver', 'admin'].includes(m.senderType || '')
      );

      if (orderChats.length === 0) continue; // Only include orders with communication history

      totalMessagesCount += orderChats.length;

      // Check for sensitive keywords
      const flaggedMessages = orderChats.filter(m => {
        const txt = (m.content || '').toLowerCase();
        return SENSITIVE_AUDIT_KEYWORDS.some(k => txt.includes(k));
      });

      const hasAlert = flaggedMessages.length > 0;
      if (hasAlert) flaggedChatsCount++;

      const isActive = ['pending', 'confirmed', 'preparing', 'assigned', 'accepted', 'picked_up', 'on_way'].includes(ord.status);
      if (isActive) activeChatsCount++;

      const lastMsg = orderChats[orderChats.length - 1];

      // Resolve participant names
      const customer = userMap.get(String(ord.customerId || ord.customerPhone || ''));
      const driver = driverMap.get(String(ord.driverId || ord.driverPhone || ''));

      const customerName = ord.customerName || customer?.fullName || customer?.username || (ord.customerPhone ? `عميل (${ord.customerPhone})` : 'العميل');
      const customerPhone = ord.customerPhone || customer?.phone || '';

      const driverName = ord.driverName || driver?.name || driver?.fullName || (ord.driverPhone ? `كابتن (${ord.driverPhone})` : (ord.driverId ? `كابتن #${String(ord.driverId).slice(-4)}` : 'لم يتم تعيين كابتن'));
      const driverPhone = ord.driverPhone || driver?.phone || '';

      // Count unread messages
      const unreadForDriver = orderChats.filter(m => m.senderType === 'customer' && !m.isRead).length;
      const unreadForCustomer = orderChats.filter(m => m.senderType === 'driver' && !m.isRead).length;
      const adminInterventions = orderChats.filter(m => m.senderType === 'admin').length;

      monitoringList.push({
        orderId: ord.id,
        orderNumber: ord.orderNumber || ord.id.slice(-5),
        orderStatus: ord.status,
        orderTotal: ord.total || ord.totalAmount || 0,
        deliveryAddress: ord.deliveryAddress || ord.address || '',
        storeName: ord.restaurantName || ord.storeName || '',
        customer: {
          id: ord.customerId,
          name: customerName,
          phone: customerPhone,
        },
        driver: {
          id: ord.driverId,
          name: driverName,
          phone: driverPhone,
        },
        messages: orderChats.map(m => ({
          ...m,
          senderDisplayName: m.senderType === 'customer' 
            ? customerName 
            : m.senderType === 'driver' 
              ? driverName 
              : 'إدارة سريع ون (الرقابة)'
        })),
        messageCount: orderChats.length,
        hasAlert,
        flaggedKeywords: flaggedMessages.map(m => m.content),
        lastMessage: {
          content: lastMsg.content,
          senderType: lastMsg.senderType,
          senderName: lastMsg.senderType === 'customer' ? customerName : lastMsg.senderType === 'driver' ? driverName : 'الإدارة',
          createdAt: lastMsg.createdAt,
        },
        isActive,
        unreadForCustomer,
        unreadForDriver,
        adminInterventions,
        createdAt: ord.createdAt,
        updatedAt: lastMsg.createdAt || ord.updatedAt || ord.createdAt
      });
    }

    // Sort by latest message descending
    monitoringList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json({
      success: true,
      conversations: monitoringList,
      stats: {
        totalChats: monitoringList.length,
        activeChats: activeChatsCount,
        totalMessages: totalMessagesCount,
        flaggedChats: flaggedChatsCount,
      }
    });
  } catch (error) {
    console.error("Error fetching order monitoring:", error);
    res.status(500).json({ message: "Failed to fetch order monitoring" });
  }
});

// Post admin supervisory intervention message into customer-driver order chat
router.post("/admin/order-monitoring/intervene", async (req, res) => {
  try {
    const { orderId, message, interventionType } = req.body;
    if (!orderId || !message) {
      return res.status(400).json({ message: "Missing orderId or message" });
    }

    const prefix = interventionType === 'warning' 
      ? '⚠️ [توجيه رقابي عاجل من إدارة سريع ون]: '
      : '🛡️ [إشعار رقابي من إدارة العمليات - سريع ون]: ';

    const interventionContent = `${prefix}${message.trim()}`;

    const newMsg = await storage.createMessage({
      orderId: String(orderId),
      senderId: 'admin',
      senderType: 'admin',
      receiverId: 'order_participants',
      receiverType: 'all',
      content: interventionContent,
    });

    // Notify connected websockets if available
    try {
      const wss = (req.app as any).get('wss');
      if (wss && wss.clients) {
        const payload = JSON.stringify({
          type: 'new_order_message',
          orderId,
          message: newMsg,
          isIntervention: true
        });
        wss.clients.forEach((client: any) => {
          if (client.readyState === 1) client.send(payload);
        });
      }
    } catch (_) {}

    res.json({ success: true, message: newMsg });
  } catch (error) {
    console.error("Error in order chat intervention:", error);
    res.status(500).json({ message: "Failed to post intervention message" });
  }
});

export interface AutoReplyConfig {
  enabled: boolean;
  enableForCustomer: boolean;
  enableForDriver: boolean;
  welcomeMessage: string;
  replies: string[];
  handoffMessage: string;
  maxReplies: number;
}

export const DEFAULT_AUTO_REPLY_CONFIG: AutoReplyConfig = {
  enabled: true,
  enableForCustomer: true,
  enableForDriver: true,
  welcomeMessage: "أهلاً بك في منصة سريع ون! يسعدنا تواصلك معنا، كيف يمكننا مساعدتك اليوم؟ 🛵✨",
  replies: [
    "شكراً لتواصلك معنا! إذا كان استفسارك بخصوص طلب معين، يرجى تزويدنا برقم الطلب لنتمكن من مساعدتك فوراً.",
    "تم استلام رسالتك وتوثيقها في النظام. هل ترغب في معرفة حالة التوصيل أو الاستفسار عن كابتن التوصيل؟",
    "فريق العمليات والدعم متواجد لمتابعة طلبك والتأكد من وصوله بأفضل جودة وسرعة.",
    "جاري مراجعة استفسارك بالتفصيل من قبل مسؤولي خدمة العملاء.",
    "شكراً جزيلاً لتعاونك وصبرك معنا."
  ],
  handoffMessage: "شكراً لتواصلك وصبرك معنا، لقد تم تحويل محادثتك الآن إلى ممثل خدمة العملاء البشري وسيقوم بالرد عليك في أقرب وقت ممكن ⏳👩‍💼",
  maxReplies: 5
};

// Background handler for auto replies to customers and drivers
async function handleAutoReply(incomingMsg: any, app: any) {
  try {
    const isToAdmin = (incomingMsg.receiverType === 'admin' || incomingMsg.receiverId === 'admin') &&
                      ['customer', 'driver'].includes(incomingMsg.senderType) &&
                      !incomingMsg.orderId;

    if (!isToAdmin) return;

    // Load auto reply settings from storage
    let config = { ...DEFAULT_AUTO_REPLY_CONFIG };
    try {
      const setting = await storage.getUiSetting('auto_chat_bot_settings');
      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        config = {
          ...config,
          ...parsed,
          replies: Array.isArray(parsed.replies) && parsed.replies.length > 0 ? parsed.replies : config.replies,
        };
      }
    } catch (e) {
      console.error('Error loading auto-reply settings:', e);
    }

    if (!config.enabled) return;
    if (incomingMsg.senderType === 'customer' && !config.enableForCustomer) return;
    if (incomingMsg.senderType === 'driver' && !config.enableForDriver) return;

    // Get chat history with admin for this specific user
    const chatHistory = await storage.getAdminChatMessages(incomingMsg.senderId, incomingMsg.senderType);
    const userMessages = (chatHistory || []).filter(
      (m: any) => m.senderId === incomingMsg.senderId && m.senderType === incomingMsg.senderType
    );

    const userMsgCount = userMessages.length; // 1-indexed count
    const ws = app?.get('ws') || (global as any).WS_MANAGER;

    const sendBotMessage = (text: string, delayMs = 700) => {
      setTimeout(async () => {
        try {
          const replyPayload = {
            orderId: null,
            senderId: 'admin',
            senderType: 'admin',
            receiverId: incomingMsg.senderId,
            receiverType: incomingMsg.senderType,
            content: text,
            isRead: false,
          };
          const validated = insertMessageSchema.parse(replyPayload);
          const savedReply = await storage.createMessage(validated as any);

          if (ws && typeof ws.broadcast === 'function') {
            ws.broadcast('new_message', {
              messageId: savedReply.id,
              orderId: null,
              senderId: 'admin',
              senderType: 'admin',
              receiverId: incomingMsg.senderId,
              receiverType: incomingMsg.senderType,
              content: text,
              createdAt: savedReply.createdAt,
            });
            ws.broadcast('NEW_CHAT_MESSAGE', savedReply);
          }
        } catch (botErr) {
          console.error('Error sending auto-reply message:', botErr);
        }
      }, delayMs);
    };

    if (userMsgCount === 1) {
      // First user message -> Send welcome message followed by 1st reply
      const welcome = config.welcomeMessage || DEFAULT_AUTO_REPLY_CONFIG.welcomeMessage;
      sendBotMessage(welcome, 700);
      if (config.replies && config.replies[0]) {
        sendBotMessage(config.replies[0], 2200);
      }
    } else if (userMsgCount >= 2 && userMsgCount <= (config.maxReplies || 5)) {
      // Step replies for 2..5
      const replyIdx = userMsgCount - 1;
      const replyText = config.replies && config.replies[replyIdx]
        ? config.replies[replyIdx]
        : `تم استلام رسالتك رقم (${userMsgCount}). سيتم الرد عليك قريباً.`;

      sendBotMessage(replyText, 800);

      // If reached the 5th message (or max limit), send handoff message to customer/driver
      if (userMsgCount === (config.maxReplies || 5)) {
        const handoff = config.handoffMessage || DEFAULT_AUTO_REPLY_CONFIG.handoffMessage;
        sendBotMessage(handoff, 2500);
      }
    }
    // Beyond maxReplies (e.g. 6+), bot stays silent so live human agents handle it directly
  } catch (err) {
    console.error('Auto reply handling failed:', err);
  }
}

// Get Auto Reply settings
router.get("/auto-reply-settings", async (_req, res) => {
  try {
    const setting = await storage.getUiSetting('auto_chat_bot_settings');
    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        return res.json({ success: true, settings: { ...DEFAULT_AUTO_REPLY_CONFIG, ...parsed } });
      } catch {
        // use default
      }
    }
    res.json({ success: true, settings: DEFAULT_AUTO_REPLY_CONFIG });
  } catch (error) {
    console.error("Error fetching auto reply settings:", error);
    res.json({ success: true, settings: DEFAULT_AUTO_REPLY_CONFIG });
  }
});

// Update Auto Reply settings
router.post("/auto-reply-settings", async (req, res) => {
  try {
    const newSettings = req.body;
    const merged = {
      ...DEFAULT_AUTO_REPLY_CONFIG,
      ...newSettings,
      replies: Array.isArray(newSettings.replies) ? newSettings.replies : DEFAULT_AUTO_REPLY_CONFIG.replies,
    };
    await storage.updateUiSetting('auto_chat_bot_settings', JSON.stringify(merged));
    res.json({ success: true, settings: merged, message: "تم حفظ إعدادات الردود التلقائية بنجاح" });
  } catch (error) {
    console.error("Error saving auto reply settings:", error);
    res.status(500).json({ success: false, message: "فشل في حفظ إعدادات الردود التلقائية" });
  }
});

// Check live presence (online/offline status)
router.get("/presence", async (req, res) => {
  try {
    const { userId, userType, orderId } = req.query;
    const ws = (req as any).app?.get('ws') || (global as any).WS_MANAGER;
    let isOnline = false;

    if (ws && typeof ws.isUserOnline === 'function') {
      isOnline = ws.isUserOnline(String(userId || ''), userType ? String(userType) : undefined);
      if (!isOnline && orderId) {
        try {
          const ord = await storage.getOrder(String(orderId));
          if (ord) {
            if (userType === 'driver') {
              isOnline = ws.isUserOnline(ord.driverId, 'driver') || ws.isUserOnline((ord as any).driverPhone, 'driver');
            } else if (userType === 'customer') {
              isOnline = ws.isUserOnline(ord.customerId, 'customer') || ws.isUserOnline(ord.customerPhone, 'customer');
            }
          }
        } catch (_) {}
      }
    }

    res.json({
      success: true,
      isOnline,
      status: isOnline ? 'online' : 'offline',
      text: isOnline ? 'متصل' : 'مغلق',
    });
  } catch (err) {
    res.json({ success: true, isOnline: false, status: 'offline', text: 'مغلق' });
  }
});

// Send a new message
router.post("/", async (req, res) => {
  try {
    const rawContent = String(req.body.content || '').trim();
    if (!rawContent) {
      return res.status(400).json({ message: "محتوى الرسالة مطلوب ولا يمكن أن يكون فارغاً" });
    }

    const senderType = String(req.body.senderType || 'customer').trim();
    const receiverType = String(req.body.receiverType || (senderType === 'customer' ? 'driver' : 'customer')).trim();
    const senderId = String(req.body.senderId || '').trim() || `${senderType}_guest`;
    const receiverId = String(req.body.receiverId || '').trim() || `${receiverType}_receiver`;

    // Check if recipient is currently online
    const ws = (req as any).app?.get('ws') || (global as any).WS_MANAGER;
    let isDelivered = false;
    if (ws && typeof ws.isUserOnline === 'function') {
      isDelivered = ws.isUserOnline(receiverId, receiverType);
      if (!isDelivered && req.body.orderId) {
        try {
          const ord = await storage.getOrder(req.body.orderId);
          if (ord) {
            if (receiverType === 'driver') {
              isDelivered = ws.isUserOnline(ord.driverId, 'driver') || ws.isUserOnline((ord as any).driverPhone, 'driver');
            } else if (receiverType === 'customer') {
              isDelivered = ws.isUserOnline(ord.customerId, 'customer') || ws.isUserOnline(ord.customerPhone, 'customer');
            }
          }
        } catch (_) {}
      }
    }

    const payload: any = {
      ...req.body,
      orderId: req.body.orderId || null,
      senderId,
      receiverId,
      senderType,
      receiverType,
      content: rawContent,
      isDelivered,
      isRead: false,
    };

    if (!payload.id || typeof payload.id !== 'string' || payload.id.trim() === '') {
      delete payload.id;
    }

    const validatedData = insertMessageSchema.parse(payload);
    const message = await storage.createMessage(validatedData as any);
    
    // Broadcast via WebSocket
    if (ws && typeof ws.broadcast === 'function') {
      const isCustomerDriverChat = (senderType === 'customer' || senderType === 'driver') && 
                                   (receiverType === 'customer' || receiverType === 'driver');

      if (isCustomerDriverChat) {
        // Direct order chat message: Notify customer and driver, plus order monitoring for admin
        ws.broadcast('order_message', message);
        ws.broadcast('new_order_message', message);
        ws.broadcast('order_monitoring_update', {
          orderId: message.orderId,
          message,
          timestamp: Date.now()
        });
      } else {
        // Admin/Support chat: Notify admin floating chat box and user
        ws.broadcast('new_message', {
          messageId: message.id,
          orderId: message.orderId,
          senderId: message.senderId,
          senderType: message.senderType,
          receiverId: message.receiverId,
          receiverType: message.receiverType,
          content: message.content,
          isDelivered: message.isDelivered,
          isRead: message.isRead,
          createdAt: message.createdAt
        });
        ws.broadcast('NEW_CHAT_MESSAGE', message);
      }
    }
    
    // Trigger automated replies if message was directed to admin support
    handleAutoReply(message, (req as any).app);

    res.status(201).json(message);
  } catch (error: any) {
    console.error("Error creating message:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "بيانات الرسالة غير مكتملة أو غير صالحة", details: error.errors });
    }
    res.status(500).json({ message: error?.message || "فشل في حفظ الرسالة وإرسالها" });
  }
});

// Mark messages as read
router.put("/read", async (req, res) => {
  try {
    const { orderId, receiverId } = req.body;
    
    if (!orderId || !receiverId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await storage.markMessagesAsRead(orderId, receiverId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
});

// Get unread message count
router.get("/unread/:userId/:userType", async (req, res) => {
  try {
    const { userId, userType } = req.params;
    
    // Get all messages and count unread
    const messages = await storage.getMessages("");
    const unread = messages.filter((m: any) => 
      m.receiverId === userId && 
      m.receiverType === userType && 
      !m.isRead
    );
    
    res.json({ count: unread.length });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

export default router;
