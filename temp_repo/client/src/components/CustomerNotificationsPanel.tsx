import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Bell, X, CheckCheck, Package, Clock, Info, 
  Send, MessageCircle, ChevronDown, ChevronUp, User 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NotificationReply {
  id: string;
  message: string;
  createdAt: string;
  senderName?: string;
  senderPhone?: string;
}

interface CustomerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  recipientType: string;
  recipientId: string | null;
  orderId: string | null;
  isRead: boolean;
  createdAt: string;
  allowReplies?: boolean;
  replies?: NotificationReply[];
}

export function CustomerNotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const phone = user?.phone || localStorage.getItem('customer_phone') || '';
  const customerId = user?.id || '';
  const userName = user?.name || localStorage.getItem('customer_name') || 'عميل';

  const queryParams = new URLSearchParams();
  if (customerId) queryParams.set('customerId', customerId);
  if (phone) queryParams.set('phone', phone);

  const { data: notifications = [], refetch } = useQuery<CustomerNotification[]>({
    queryKey: ['/api/notifications/customer', phone, customerId],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/customer?${queryParams.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 20000,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/customer/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, customerId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/customer'] });
      refetch();
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/customer'] });
    },
  });

  // Mutation for sending reply to a notification
  const sendReplyMutation = useMutation({
    mutationFn: async ({ notifId, message }: { notifId: string; message: string }) => {
      const res = await fetch(`/api/notifications/${notifId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          senderName: userName,
          senderPhone: phone,
          senderId: customerId || phone || 'guest',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل في إرسال الرد');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: 'تم إرسال ردك بنجاح ✅', description: 'تم استلام ردك وسيقوم الفريق بمتابعته' });
      setReplyTextMap(prev => ({ ...prev, [variables.notifId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/customer'] });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: 'خطأ', description: err.message || 'تعذر إرسال الرد', variant: 'destructive' });
    }
  });

  const handleSendReply = (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = replyTextMap[notifId]?.trim();
    if (!text) {
      toast({ title: 'تنبيه', description: 'يرجى كتابة نص الرد أولاً', variant: 'destructive' });
      return;
    }
    sendReplyMutation.mutate({ notifId, message: text });
  };

  // unreadCount calculations and other logic remains
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // WebSocket listener for real-time notification refresh
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (customerId) {
          ws?.send(JSON.stringify({
            type: 'auth',
            payload: { userId: customerId, userType: 'customer' }
          }));
        }
        if (phone && phone !== customerId) {
          ws?.send(JSON.stringify({
            type: 'auth',
            payload: { userId: phone, userType: 'customer' }
          }));
        }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'NEW_NOTIFICATION' ||
            data.type === 'notifications_updated' ||
            data.type === 'order_update' ||
            data.type === 'order_status_changed'
          ) {
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/customer', phone, customerId] });
            refetch();
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [phone, customerId, refetch, queryClient]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (type: string) => {
    if (type?.includes('order') || type?.includes('scheduled')) return <Package className="h-4 w-4 text-primary" />;
    if (type?.includes('cancel')) return <X className="h-4 w-4 text-red-500" />;
    if (type?.includes('status')) return <Clock className="h-4 w-4 text-blue-500" />;
    return <Info className="h-4 w-4 text-gray-500" />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'الآن';
    if (m < 60) return `منذ ${m} دقيقة`;
    if (h < 24) return `منذ ${h} ساعة`;
    return `منذ ${d} يوم`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) refetch();
        }}
        className="h-10 w-10 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors relative"
        aria-label="الإشعارات"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-yellow-400 text-gray-900 text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-black border border-white/20 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* خلفية شفافة لإغلاق اللوحة عند الضغط خارجها */}
          <div className="fixed inset-0 z-[190]" onClick={() => setIsOpen(false)} />
          
          {/* لوحة الإشعارات - متجاوبة ومرتبة */}
          <div
            className="fixed z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{
              top: '64px',
              right: '8px',
              left: '8px',
              maxWidth: '400px',
              marginLeft: 'auto',
              maxHeight: '80vh',
            }}
            dir="rtl"
          >
            {/* رأس اللوحة */}
            <div className="flex items-center justify-between px-4 py-3.5 bg-primary text-white sticky top-0 shadow-sm">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="font-black text-sm">صندوق الإشعارات</span>
                {unreadCount > 0 && (
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-white/80 hover:text-white transition-colors p-1"
                    title="تعليم الكل كمقروء"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* قائمة الإشعارات */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 56px)' }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Bell className="h-10 w-10 mb-2 opacity-30 text-primary" />
                  <p className="text-sm font-bold text-gray-600">لا توجد إشعارات حالياً</p>
                  <p className="text-xs text-gray-400 mt-1">ستصلك هنا العروض وحالة الطلبات أولاً بأول</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  return (
                    <div
                      key={notif.id}
                      className={`border-b border-gray-100 transition-colors ${
                        !notif.isRead ? 'bg-blue-50/50' : 'bg-white'
                      }`}
                    >
                      {/* رأس بطاقة الإشعار ومحتواها */}
                      <div
                        onClick={() => {
                          if (!notif.isRead) markOneReadMutation.mutate(notif.id);
                          
                          // فحص ما إذا كان الإشعار يخص وصول الطلبات أو حالة الطلبات النشطة
                          const isOrderArrivalOrUpdate = 
                            notif.type?.includes('arrival') || 
                            notif.type?.includes('arrived') ||
                            notif.type?.includes('delivered') ||
                            notif.type?.includes('on_the_way') ||
                            notif.type?.includes('on_way') ||
                            notif.type?.includes('wasalni') || 
                            notif.type?.includes('order') ||
                            notif.title?.includes('وصول') ||
                            notif.title?.includes('وصل') ||
                            notif.title?.includes('طلب') ||
                            notif.message?.includes('وصول') ||
                            notif.message?.includes('وصل') ||
                            notif.message?.includes('طلبك') ||
                            Boolean(notif.orderId);

                          if (isOrderArrivalOrUpdate) {
                            setLocation('/track-orders');
                            setIsOpen(false);
                          }
                        }}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80"
                      >
                        <div className="mt-0.5 shrink-0 w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className={`text-sm font-bold leading-tight ${!notif.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">{notif.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-gray-400">{timeAgo(notif.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CustomerNotificationsPanel;
