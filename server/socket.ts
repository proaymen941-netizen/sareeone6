import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./viteServer";
import { storage } from "./storage";

export interface SocketMessage {
  type: string;
  payload: any;
}

interface UserConnection {
  ws: WebSocket;
  userId: string;
  userType?: string;
  connectionKey: string;
  orderId?: string;
  isAlive: boolean;
}

export function checkIsUserOnline(
  userIdOrPhone: string | undefined | null,
  userType: string | undefined | null,
  clients: Map<string, UserConnection>,
  userConnections: Map<string, WebSocket[]>
): boolean {
  if (!userIdOrPhone) return false;
  const rawTarget = String(userIdOrPhone).trim();
  if (!rawTarget) return false;
  const targetDigits = rawTarget.replace(/\D/g, '');

  // 1. Direct check in userConnections map
  const keysToCheck = [
    rawTarget,
    `driver_${rawTarget}`,
    ...(targetDigits ? [targetDigits, `driver_${targetDigits}`] : [])
  ];

  for (const k of keysToCheck) {
    const list = userConnections.get(k);
    if (list && list.some(w => w.readyState === WebSocket.OPEN)) {
      return true;
    }
  }

  // 2. Iterate clients
  for (const conn of clients.values()) {
    if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) continue;
    if (userType && conn.userType && conn.userType !== userType) continue;

    const connUserId = String(conn.userId || '').trim();
    const connDigits = connUserId.replace(/\D/g, '');

    if (connUserId === rawTarget) return true;
    if (conn.connectionKey === rawTarget || conn.connectionKey === `driver_${rawTarget}`) return true;

    if (targetDigits.length >= 7 && connDigits.length >= 7) {
      if (targetDigits === connDigits || targetDigits.endsWith(connDigits.slice(-7)) || connDigits.endsWith(targetDigits.slice(-7))) {
        return true;
      }
    }
  }

  return false;
}

export function setupWebSockets(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const clients = new Map<string, UserConnection>();
  const userConnections = new Map<string, WebSocket[]>();
  const orderTrackers = new Map<string, WebSocket[]>();

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("connection", (ws: any, req) => {
    log(`New WS connection from ${req.socket.remoteAddress}`);
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on("message", (data: any) => {
      try {
        const message: SocketMessage = JSON.parse(data.toString());
        handleMessage(ws, message, clients, userConnections, orderTrackers, wss);
      } catch (err) {
        log(`Failed to parse WS message: ${err}`);
      }
    });

    ws.on("close", () => {
      // جمع كل إدخالات هذا الاتصال (قد يكون مسجَّلاً بأكثر من مفتاح: customerId + phone)
      const toDelete: string[] = [];
      const keysToClean = new Set<string>();
      let closedOrderId: string | undefined;

      for (const [id, connection] of clients.entries()) {
        if (connection.ws === ws) {
          toDelete.push(id);
          keysToClean.add(connection.connectionKey);
          if (connection.orderId) closedOrderId = connection.orderId;
        }
      }

      // حذف من خريطة clients
      for (const id of toDelete) {
        clients.delete(id);
      }

      // تنظيف userConnections لكل مفتاح مرتبط بهذا الاتصال
      for (const key of keysToClean) {
        const connections = userConnections.get(key) || [];
        const filtered = connections.filter(c => c !== ws);
        if (filtered.length === 0) {
          userConnections.delete(key);
        } else {
          userConnections.set(key, filtered);
        }
      }

      // إعلام الأطراف المعنية بانقطاع اتصال المستخدم (حالة مغلق)
      toDelete.forEach(id => {
        const parts = id.split('_');
        const uid = parts[0];
        if (uid) {
          const isStillOnline = checkIsUserOnline(uid, undefined, clients, userConnections);
          if (!isStillOnline) {
            const offlineMsg = JSON.stringify({
              type: "presence_change",
              payload: { userId: uid, isOnline: false }
            });
            wss.clients.forEach(c => {
              if (c.readyState === WebSocket.OPEN) c.send(offlineMsg);
            });
          }
        }
      });

      // تنظيف orderTrackers إن وجد
      if (closedOrderId) {
        const trackers = orderTrackers.get(closedOrderId) || [];
        const filtered = trackers.filter(c => c !== ws);
        if (filtered.length === 0) {
          orderTrackers.delete(closedOrderId);
        } else {
          orderTrackers.set(closedOrderId, filtered);
        }
      }
    });
  });

  return {
    isUserOnline: (userIdOrPhone: string, userType?: string): boolean => {
      return checkIsUserOnline(userIdOrPhone, userType, clients, userConnections);
    },
    broadcast: (type: string, payload: any) => {
      const message = JSON.stringify({ type, payload });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

      // Also specifically check order trackers if it's an order update
      if (type === 'order_update' && payload.orderId) {
        const trackers = orderTrackers.get(payload.orderId) || [];
        trackers.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
    },
    sendToUser: (userId: string, type: string, payload: any) => {
      const connections = userConnections.get(userId) || [];
      const message = JSON.stringify({ type, payload });
      
      connections.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    },
    sendToDriver: (driverId: string, type: string, payload: any) => {
      const connections = userConnections.get(`driver_${driverId}`) || [];
      const message = JSON.stringify({ type, payload });
      
      connections.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    },
    sendToAdmin: (type: string, payload: any) => {
      const connections = userConnections.get('admin_dashboard') || [];
      const message = JSON.stringify({ type, payload });
      
      connections.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    },
    /**
     * Send an order update ONLY to relevant parties:
     * the order's customer (by id and/or phone), the assigned driver,
     * the admin dashboard, and any clients explicitly tracking the order.
     * This avoids the noisy global broadcast that was hitting all customers.
     */
    notifyOrder: (
      type: string,
      payload: any,
      recipients: { customerId?: string | null; customerPhone?: string | null; driverId?: string | null; orderId?: string | null; includeAdmin?: boolean } = {}
    ) => {
      const message = JSON.stringify({ type, payload });
      const sent = new Set<WebSocket>();

      const sendToKey = (key?: string | null) => {
        if (!key) return;
        const conns = userConnections.get(key) || [];
        conns.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && !sent.has(client)) {
            client.send(message);
            sent.add(client);
          }
        });
      };

      sendToKey(recipients.customerId);
      sendToKey(recipients.customerPhone);
      if (recipients.driverId) sendToKey(`driver_${recipients.driverId}`);
      if (recipients.includeAdmin !== false) sendToKey('admin_dashboard');

      const orderId = recipients.orderId || (payload && payload.orderId);
      if (orderId) {
        const trackers = orderTrackers.get(orderId) || [];
        trackers.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && !sent.has(client)) {
            client.send(message);
            sent.add(client);
          }
        });
      }
    }
  };
}

async function handleMessage(
  ws: WebSocket, 
  message: SocketMessage, 
  clients: Map<string, UserConnection>,
  userConnections: Map<string, WebSocket[]>,
  orderTrackers: Map<string, WebSocket[]>,
  wss: WebSocketServer
) {
  switch (message.type) {
    case "auth":
      if (message.payload.userId) {
        const userId = String(message.payload.userId).trim();
        const userType = message.payload.userType || 'customer';
        
        // Use consistent prefixing
        const connectionKey = userType === 'driver' ? `driver_${userId}` : userId;
        
        clients.set(`${userId}_${Date.now()}`, {
          ws,
          userId,
          userType,
          connectionKey,
          isAlive: true
        });
        
        const connections = userConnections.get(connectionKey) || [];
        connections.push(ws);
        userConnections.set(connectionKey, connections);
        
        log(`User ${userId} (${userType}) authenticated via WS with key ${connectionKey}`);

        // 1. تحديث الرسائل المعلقة لتصبح "مستلمة" طالما أن المستخدم دخل التطبيق
        try {
          if (typeof (storage as any).markMessagesAsDelivered === 'function') {
            (storage as any).markMessagesAsDelivered(userId, userType).catch(() => {});
          }
        } catch (_) {}

        // 2. إشعار جميع الأطراف المعنية بأن هذا المستخدم أصبح "متصل"
        const presMsg = JSON.stringify({
          type: "presence_change",
          payload: { userId, userType, isOnline: true }
        });
        wss.clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN) c.send(presMsg);
        });

        // 3. إشعار بتم تسليم الرسائل المعلقة (لتحديث الصحين الغامقين لدى المرسل)
        const delivMsg = JSON.stringify({
          type: "messages_delivered",
          payload: { recipientId: userId, recipientType: userType }
        });
        wss.clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN) c.send(delivMsg);
        });
      }
      break;

    case "open_chat":
      if (message.payload?.orderId) {
        const { orderId, userId, userType } = message.payload;
        try {
          if (typeof (storage as any).markOrderMessagesAsRead === 'function') {
            (storage as any).markOrderMessagesAsRead(String(orderId), String(userType || 'customer'), String(userId || '')).catch(() => {});
          }
        } catch (_) {}

        const readMsg = JSON.stringify({
          type: "messages_read",
          payload: { orderId: String(orderId), readerId: userId, readerType: userType, timestamp: Date.now() }
        });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(readMsg);
          }
        });
      }
      break;

    case "check_presence":
      if (message.payload?.targetId) {
        const { targetId, targetType, requestId } = message.payload;
        const isOnline = checkIsUserOnline(targetId, targetType, clients, userConnections);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "presence_result",
            payload: { targetId, targetType, isOnline, requestId }
          }));
        }
      }
      break;

    case "track_order":
      if (message.payload.orderId) {
        const orderId = message.payload.orderId;
        
        // Find existing client entry for this WS
        for (const [id, connection] of clients.entries()) {
          if (connection.ws === ws) {
            connection.orderId = orderId;
            break;
          }
        }

        const trackers = orderTrackers.get(orderId) || [];
        if (!trackers.includes(ws)) {
          trackers.push(ws);
        }
        orderTrackers.set(orderId, trackers);
        log(`Client tracking order ${orderId} via WS`);
      }
      break;
      
    case "location_update":
      const { driverId, latitude, longitude, currentLocation } = message.payload;
      if (driverId && latitude && longitude) {
        // تحديث قاعدة البيانات لضمان بقاء الموقع حتى لو انقطع الاتصال
        try {
          storage.updateDriver(driverId, {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            currentLocation: currentLocation || undefined
          }).catch(err => console.error('Error updating driver location in DB:', err));
        } catch (e) {
          console.error('Failed to update driver location:', e);
        }

        const broadcastMsg = JSON.stringify({
          type: "driver_location",
          payload: { driverId, latitude, longitude, currentLocation, timestamp: Date.now() }
        });
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastMsg);
          }
        });
      }
      break;

    case "settings_update":
      // بث تغيير الإعدادات لجميع المتصلين (عملاء وسائقين)
      const settingsPayload = message.payload;
      const settingsMsg = JSON.stringify({
        type: "settings_changed",
        payload: settingsPayload
      });
      
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(settingsMsg);
        }
      });
      break;
      
    case "driver_assigned":
        const payload = message.payload;
        const orderId = payload.orderId;
        const assignedDriverId = payload.driverId;
        const driverName = payload.driverName;
      if (orderId && assignedDriverId) {
        const notificationMsg = JSON.stringify({
          type: "new_order_assigned",
          payload: { 
            orderId, 
            driverId: assignedDriverId,
            driverName,
            timestamp: Date.now()
          }
        });
        
        const driverConnections = userConnections.get(`driver_${assignedDriverId}`) || [];
        driverConnections.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(notificationMsg);
          }
        });
      }
      break;
      
    case "order_update":
      const updatePayload = message.payload;
      const updateOrderId = updatePayload.orderId;
      const status = updatePayload.status;
      const updateMessage = updatePayload.message;
      if (updateOrderId && status) {
        const updateMsg = JSON.stringify({
          type: "order_status_changed",
          payload: { 
            orderId: updateOrderId, 
            status,
            message: updateMessage,
            timestamp: Date.now()
          }
        });
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(updateMsg);
          }
        });
      }
      break;
  }
}
