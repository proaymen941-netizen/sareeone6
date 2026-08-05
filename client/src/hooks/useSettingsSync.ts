import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

export function useSettingsSync() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let authSent = false;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      (window as any).WS_MANAGER = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        // عند إعادة الاتصال بالخادم، نقوم بتحديث كاش البيانات لضمان عدم وجود بيانات قديمة
        queryClient.invalidateQueries();

        // Send auth message if user is logged in
        if (isAuthenticated && user?.id) {
          ws?.send(JSON.stringify({
            type: "auth",
            payload: {
              userId: user.id,
              userType: user.userType || "customer"
            }
          }));
          authSent = true;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const msgType = msg.type;
          
          if (msgType === "settings_changed") {
            const key = msg.payload?.key || msg.payload?.changedKey;
            
            // Invalidate ui-settings for any settings change
            queryClient.invalidateQueries({ queryKey: ["/api/ui-settings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-settings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/delivery-fees/settings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/delivery-fees"] });

            if (key === "restaurants" || key === "delivery_fee_settings" || key === "app_closed" || !key) {
              queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
              queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
            }
          } else if (
            msgType === "order_status_changed" || 
            msgType === "order_update" || 
            msgType === "new_order" || 
            msgType === "order_created" || 
            msgType === "order_cancelled" ||
            msgType === "order_unassigned_alert"
          ) {
            // Invalidate orders queries across Customer, Admin & Driver
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/active-orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/stats"] });
            
            if (msg.payload?.orderId) {
              queryClient.invalidateQueries({ queryKey: [`/api/orders/${msg.payload.orderId}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/orders/${msg.payload.orderId}/track`] });
              queryClient.invalidateQueries({ queryKey: [`/api/admin/orders/${msg.payload.orderId}`] });
            }
          } else if (msgType === "new_order_assigned" || msgType === "driver_assigned") {
            queryClient.invalidateQueries({ queryKey: ["/api/driver/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/active-orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          } else if (
            msgType === "wasalni_update" || 
            msgType === "wasalni_created" || 
            msgType === "wasalni_assigned" || 
            msgType === "wasalni_status_changed" ||
            msgType === "new_wasalni_request"
          ) {
            queryClient.invalidateQueries({ queryKey: ["/api/wasalni"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/wasalni-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/wasalni"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/available-orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/active-orders"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
          } else if (
            msgType === "menu_update" || 
            msgType === "restaurant_update" || 
            msgType === "section_update" || 
            msgType === "category_update"
          ) {
            queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
            queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/menu-items"] });
            queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
            queryClient.invalidateQueries({ queryKey: ["/api/special-offers"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/special-offers"] });
          } else if (msgType === "driver_location" || msgType === "driver_status_update" || msgType === "driver_updated") {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-locations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/profile"] });
            queryClient.invalidateQueries({ queryKey: ["/api/driver/dashboard"] });
          } else if (msgType === "NEW_NOTIFICATION" || msgType === "new_notification" || msgType === "notification_received") {
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/customer'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/driver/notifications'] });
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        reconnectTimeout = setTimeout(connect, 5000);
        authSent = false;
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [queryClient, user?.id, isAuthenticated]);
}
