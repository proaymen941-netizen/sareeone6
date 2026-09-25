import { storage } from "../storage";
import { broadcastEvent } from "../broadcast.js";

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Tries to automatically select and assign an available driver to an order.
 */
export async function autoAssignDriverToOrder(
  orderId: string,
  locationLat?: number | string | null,
  locationLng?: number | string | null
) {
  try {
    const availableDrivers = await storage.getAvailableDrivers();
    if (!availableDrivers || availableDrivers.length === 0) {
      console.log(`[AutoAssign] No available drivers currently online for order ${orderId}`);
      return null;
    }

    let selectedDriver = availableDrivers[0];

    const targetLat = locationLat ? parseFloat(String(locationLat)) : null;
    const targetLng = locationLng ? parseFloat(String(locationLng)) : null;

    if (targetLat !== null && !isNaN(targetLat) && targetLng !== null && !isNaN(targetLng)) {
      let minDistance = Infinity;
      for (const d of availableDrivers) {
        if (d.latitude && d.longitude) {
          const dLat = parseFloat(d.latitude);
          const dLng = parseFloat(d.longitude);
          if (!isNaN(dLat) && !isNaN(dLng)) {
            const dist = calculateDistanceKm(targetLat, targetLng, dLat, dLng);
            if (dist < minDistance) {
              minDistance = dist;
              selectedDriver = d;
            }
          }
        }
      }
    }

    if (selectedDriver) {
      // تحديث الطلب بتعيين السائق وتغيير الحالة إلى "assigned"
      await storage.updateOrder(orderId, {
        driverId: selectedDriver.id,
        status: "assigned"
      });

      // تمييز السائق كغير متاح مؤقتاً لمنع التعيين المزدوج
      try {
        await storage.updateDriver(selectedDriver.id, { isAvailable: false });
      } catch (_) {}

      // إرسال إشعار مباشر للسائق المُعيّن
      try {
        await storage.createNotification({
          type: 'new_order_assigned',
          title: 'طلب جديد مسند إليك تلقائياً',
          message: `تم إسناد الطلب رقم ${orderId.slice(-6)} إليك تلقائياً. يرجى المتابعة.`,
          recipientType: 'driver',
          recipientId: selectedDriver.id,
          orderId: orderId,
          isRead: false
        });
      } catch (_) {}

      // بث حدث WebSocket عام للجميع (يخبر بأن الطلب تمّ توزيعه)
      try {
        broadcastEvent('order_assigned', {
          orderId,
          driverId: selectedDriver.id,
          driverName: selectedDriver.name,
          autoAssigned: true
        });
      } catch (_) {}

      // بث حدث مخصص للسائق المُعيّن عبر WebSocket (مفتاح driver_<id>)
      try {
        broadcastEvent('driver_assigned', {
          type: 'new_order_assigned',
          orderId,
          driverId: selectedDriver.id,
          driverName: selectedDriver.name,
          autoAssigned: true,
          targetDriver: `driver_${selectedDriver.id}`
        });
      } catch (_) {}

      // بث إشعار لتحديث الطلبات النشطة للسائق المُعيّن
      try {
        broadcastEvent('refresh_driver_orders', {
          driverId: selectedDriver.id,
          orderId,
          autoAssigned: true
        });
      } catch (_) {}

      console.log(`[AutoAssign] ✅ Successfully assigned driver ${selectedDriver.name} (${selectedDriver.id}) to order ${orderId}`);
      return selectedDriver;
    }
  } catch (error) {
    console.error("[AutoAssign] Error auto assigning driver to order:", error);
  }
  return null;
}

/**
 * Tries to automatically select and assign an available driver to a Wasalni request.
 */
export async function autoAssignDriverToWasalni(
  requestId: string,
  locationLat?: number | string | null,
  locationLng?: number | string | null
) {
  try {
    const availableDrivers = await storage.getAvailableDrivers();
    if (!availableDrivers || availableDrivers.length === 0) {
      console.log(`[AutoAssign] No available drivers currently online for Wasalni ${requestId}`);
      return null;
    }

    let selectedDriver = availableDrivers[0];

    const targetLat = locationLat ? parseFloat(String(locationLat)) : null;
    const targetLng = locationLng ? parseFloat(String(locationLng)) : null;

    if (targetLat !== null && !isNaN(targetLat) && targetLng !== null && !isNaN(targetLng)) {
      let minDistance = Infinity;
      for (const d of availableDrivers) {
        if (d.latitude && d.longitude) {
          const dLat = parseFloat(d.latitude);
          const dLng = parseFloat(d.longitude);
          if (!isNaN(dLat) && !isNaN(dLng)) {
            const dist = calculateDistanceKm(targetLat, targetLng, dLat, dLng);
            if (dist < minDistance) {
              minDistance = dist;
              selectedDriver = d;
            }
          }
        }
      }
    }

    if (selectedDriver) {
      const db = (storage as any).db;
      if (db) {
        const { wasalniRequests } = await import("../../shared/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(wasalniRequests)
          .set({ driverId: selectedDriver.id, status: "assigned", updatedAt: new Date() })
          .where(eq(wasalniRequests.id, requestId));

        // تمييز السائق كغير متاح مؤقتاً
        try {
          await storage.updateDriver(selectedDriver.id, { isAvailable: false });
        } catch (_) {}

        try {
          await storage.createNotification({
            type: 'wasalni_driver_assigned',
            title: 'طلب وصل لي مسند إليك تلقائياً',
            message: `تم إسناد طلب وصل لي رقم ${requestId.slice(-6)} إليك تلقائياً.`,
            recipientType: 'driver',
            recipientId: selectedDriver.id,
            orderId: requestId,
            isRead: false
          });
        } catch (_) {}

        try {
          broadcastEvent('wasalni_assigned', {
            requestId,
            driverId: selectedDriver.id,
            driverName: selectedDriver.name,
            autoAssigned: true
          });
        } catch (_) {}

        // بث إشعار للسائق المُعيّن
        try {
          broadcastEvent('refresh_driver_orders', {
            driverId: selectedDriver.id,
            requestId,
            autoAssigned: true,
            isWasalni: true
          });
        } catch (_) {}
      }
      console.log(`[AutoAssign] ✅ Successfully assigned driver ${selectedDriver.name} to Wasalni ${requestId}`);
      return selectedDriver;
    }
  } catch (error) {
    console.error("[AutoAssign] Error auto assigning driver to Wasalni:", error);
  }
  return null;
}
