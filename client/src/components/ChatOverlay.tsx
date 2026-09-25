import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle, 
  Send, 
  X, 
  User, 
  Bot,
  Truck,
  Phone,
  ArrowRight,
  Loader2,
  Check,
  CheckCheck,
  Shield,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

export interface ChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'customer' | 'driver';
  userId?: string;
  initialOrderId?: string;
}

type ConversationType = 'admin' | 'order';

interface ActiveConversation {
  id: string;
  type: ConversationType;
  title: string;
  subtitle?: string;
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  participantName: string;
  participantPhone?: string;
  participantRole?: string;
  isOnline?: boolean;
  participantStatus?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export default function ChatOverlay({ 
  isOpen, 
  onClose, 
  userType, 
  userId,
  initialOrderId 
}: ChatOverlayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedConv, setSelectedConv] = useState<ActiveConversation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute robust effective user ID across sessions and logins
  const getEffectiveUserId = () => {
    if (userId) return String(userId).trim();
    if (userType === 'driver') {
      const driverPhone = localStorage.getItem('driver_phone');
      if (driverPhone) return driverPhone.trim();
      const driverUser = localStorage.getItem('driver_user');
      if (driverUser) {
        try {
          const parsed = JSON.parse(driverUser);
          if (parsed.id) return String(parsed.id).trim();
          if (parsed.phone) return String(parsed.phone).trim();
        } catch {}
      }
      let driverGuest = localStorage.getItem('driver_guest_id');
      if (!driverGuest) {
        driverGuest = 'driver_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('driver_guest_id', driverGuest);
      }
      return driverGuest;
    } else {
      if (user?.id) return String(user.id).trim();
      if (user?.phone) return String(user.phone).trim();
      const custPhone = localStorage.getItem('customer_phone');
      if (custPhone) return custPhone.trim();
      const custUser = localStorage.getItem('customer_user');
      if (custUser) {
        try {
          const parsed = JSON.parse(custUser);
          if (parsed.id) return String(parsed.id).trim();
          if (parsed.phone) return String(parsed.phone).trim();
        } catch {}
      }
      let custGuest = localStorage.getItem('customer_guest_id');
      if (!custGuest) {
        custGuest = 'customer_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('customer_guest_id', custGuest);
      }
      return custGuest;
    }
  };

  const effectiveUserId = getEffectiveUserId();

  // 1. Fetch conversations list for this user (Admin + Active Order Driver/Customer chats)
  const { 
    data: conversationsData, 
    isLoading: isConversationsLoading, 
    refetch: refetchConversations 
  } = useQuery({
    queryKey: ['/api/messages/user-conversations', effectiveUserId, userType],
    queryFn: async () => {
      if (!effectiveUserId) {
        return {
          adminConversation: {
            id: 'admin',
            type: 'admin',
            title: userType === 'driver' ? 'إدارة سريع ون (الدعم والعمليات)' : 'خدمة عملاء سريع ون (الإدارة)',
            subtitle: 'تواصل مباشر مع فريق الإدارة',
            unreadCount: 0,
            participantName: 'فريق الإدارة',
          },
          orderConversations: [],
          totalUnreadCount: 0,
        };
      }
      const res = await fetch(`/api/messages/user-conversations?userId=${encodeURIComponent(effectiveUserId)}&userType=${userType}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isOpen && !!effectiveUserId,
    refetchInterval: 4000,
  });

  const adminConversation: ActiveConversation = useMemo(() => {
    const raw = conversationsData?.adminConversation;
    return {
      id: 'admin',
      type: 'admin',
      title: raw?.title || (userType === 'driver' ? 'إدارة سريع ون (الدعم والعمليات)' : 'خدمة عملاء سريع ون (الإدارة)'),
      subtitle: raw?.subtitle || 'تواصل مباشر مع فريق الإدارة',
      participantName: 'فريق الدعم والإدارة',
      unreadCount: raw?.unreadCount || 0,
      lastMessage: raw?.lastMessage || '',
      lastMessageAt: raw?.lastMessageAt || '',
    };
  }, [conversationsData, userType]);

  const orderConversations: ActiveConversation[] = useMemo(() => {
    const list = conversationsData?.orderConversations || [];
    return list.map((c: any) => ({
      id: c.id || `order_${c.orderId}`,
      type: 'order' as ConversationType,
      orderId: c.orderId,
      orderNumber: c.orderNumber,
      orderStatus: c.orderStatus,
      title: c.title,
      subtitle: c.subtitle,
      participantName: c.participantName || (userType === 'customer' ? 'كابتن التوصيل' : 'العميل'),
      participantPhone: c.participantPhone || '',
      participantRole: c.participantRole || (userType === 'customer' ? 'كابتن سريع ون' : 'صاحب الطلب'),
      isOnline: !!c.isOnline,
      participantStatus: c.participantStatus || (c.isOnline ? 'متصل' : 'مغلق'),
      unreadCount: c.unreadCount || 0,
      lastMessage: c.lastMessage || '',
      lastMessageAt: c.lastMessageAt || '',
    }));
  }, [conversationsData, userType]);

  const totalUnread = (conversationsData?.totalUnreadCount) || 0;

  // Real-time presence query for currently selected conversation
  const { data: presenceData } = useQuery({
    queryKey: ['/api/messages/presence', selectedConv?.id, selectedConv?.participantPhone, selectedConv?.orderId],
    queryFn: async () => {
      if (!selectedConv || selectedConv.type === 'admin') {
        return { isOnline: true, status: 'online', text: 'متصل' };
      }
      const targetId = selectedConv.participantPhone || selectedConv.participantName;
      const targetType = userType === 'customer' ? 'driver' : 'customer';
      const res = await fetch(`/api/messages/presence?userId=${encodeURIComponent(targetId)}&userType=${targetType}&orderId=${encodeURIComponent(selectedConv.orderId || '')}`);
      if (!res.ok) return { isOnline: false, status: 'offline', text: 'مغلق' };
      return res.json();
    },
    enabled: isOpen && !!selectedConv && selectedConv.type === 'order',
    refetchInterval: 2500,
  });

  const isCurrentTargetOnline = selectedConv?.type === 'admin' 
    ? true 
    : (presenceData?.isOnline !== undefined ? presenceData.isOnline : (selectedConv?.isOnline ?? false));

  // WebSocket Live Sync for ticks & presence
  useEffect(() => {
    if (!isOpen || !effectiveUserId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let keepAlive: any = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(JSON.stringify({
          type: 'auth',
          payload: { userId: effectiveUserId, userType }
        }));

        if (selectedConv?.orderId) {
          ws?.send(JSON.stringify({
            type: 'open_chat',
            payload: { orderId: selectedConv.orderId, userId: effectiveUserId, userType }
          }));
        }

        keepAlive = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (['order_message', 'new_order_message', 'new_message', 'NEW_CHAT_MESSAGE', 'messages_delivered', 'messages_read', 'presence_change'].includes(data.type)) {
            queryClient.invalidateQueries({ queryKey: ['/api/chat/active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['/api/messages/presence'] });
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (keepAlive) clearInterval(keepAlive);
      ws?.close();
    };
  }, [isOpen, effectiveUserId, userType, selectedConv?.orderId]);

  // If opened with an initialOrderId, auto-select that order conversation
  useEffect(() => {
    if (isOpen && initialOrderId && orderConversations.length > 0 && !selectedConv) {
      const match = orderConversations.find(c => c.orderId === initialOrderId || c.orderNumber === initialOrderId);
      if (match) {
        setSelectedConv(match);
      }
    }
  }, [isOpen, initialOrderId, orderConversations, selectedConv]);

  // 2. Fetch messages for the currently selected conversation
  const { 
    data: activeMessages = [], 
    isLoading: isMessagesLoading, 
    refetch: refetchMessages 
  } = useQuery({
    queryKey: ['/api/chat/active', selectedConv?.id, selectedConv?.type, selectedConv?.orderId, effectiveUserId],
    queryFn: async () => {
      if (!selectedConv || !effectiveUserId) return [];
      
      if (selectedConv.type === 'admin') {
        const res = await fetch(`/api/messages/admin-chat?userId=${encodeURIComponent(effectiveUserId)}&userType=${userType}&reader=user`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.messages || [];
      } else if (selectedConv.type === 'order' && selectedConv.orderId) {
        const res = await fetch(`/api/messages/order/${selectedConv.orderId}?readerType=${userType}&readerId=${encodeURIComponent(effectiveUserId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    },
    enabled: isOpen && !!selectedConv && !!effectiveUserId,
    refetchInterval: 2500,
  });

  // Mark conversation as read whenever opened
  const markAsRead = async (conv: ActiveConversation) => {
    try {
      if (conv.orderId) {
        await fetch(`/api/messages/order/${conv.orderId}?readerType=${userType}&readerId=${encodeURIComponent(effectiveUserId)}`).catch(() => {});
      }
      await fetch('/api/messages/user/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          userType,
          type: conv.type,
          orderId: conv.orderId,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/active'] });
    } catch {}
  };

  const handleSelectConversation = (conv: ActiveConversation) => {
    setSelectedConv(conv);
    markAsRead(conv);
  };

  const handleBackToList = () => {
    setSelectedConv(null);
    setMessage('');
    refetchConversations();
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConv) return;
      
      let payload: any = {
        content,
        senderId: effectiveUserId,
        senderType: userType,
      };

      if (selectedConv.type === 'admin') {
        payload = {
          ...payload,
          receiverId: 'admin',
          receiverType: 'admin',
          orderId: null,
        };
      } else {
        payload = {
          ...payload,
          orderId: selectedConv.orderId,
          receiverId: selectedConv.participantPhone || selectedConv.participantName || 'recipient',
          receiverType: userType === 'customer' ? 'driver' : 'customer',
        };
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      if (!res.ok) {
        let errorMsg = 'فشل إرسال الرسالة';
        try {
          const json = JSON.parse(text);
          errorMsg = json.message || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return {};
      }
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/chat/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ 
        title: 'فشل الإرسال', 
        description: err?.message || 'تعذر إرسال الرسالة حالياً، يرجى المحاولة ثانية',
        variant: 'destructive' 
      });
    },
  });

  // Auto scroll messages to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, selectedConv]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  // Clean phone number for WhatsApp wa.me links
  const getCleanPhone = (phoneStr?: string) => {
    if (!phoneStr) return '';
    let digits = phoneStr.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '967' + digits.slice(1);
    if (!digits.startsWith('967') && digits.length === 9) digits = '967' + digits;
    return digits;
  };

  // Quick reply chips
  const quickChips = useMemo(() => {
    if (!selectedConv) return [];
    if (selectedConv.type === 'admin') {
      return [
        'أين طلبي الآن؟ 🛵', 
        'استفسار عن التوصيل 📦', 
        'مساعدة في الحساب والطلب 💬'
      ];
    }
    if (userType === 'customer') {
      return [
        'أين موقعك الآن يا كابتن؟ 🛵',
        'أنا بانتظارك في العنوان المحدد 📍',
        'شكراً لك تم استلام الطلب 👍'
      ];
    } else {
      return [
        'أنا في الطريق إليك الآن 🛵',
        'وصلت لموقعك، أنا بانتظارك بالخارج 📍',
        'يرجى الرد على الاتصال لتسليم الطلب 📞'
      ];
    }
  }, [selectedConv, userType]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[3000] flex flex-col overflow-hidden h-[540px]"
        dir="rtl"
      >
        {/* ── حالة العرض 1: قائمة المحادثات (اختيار مراسلة الإدارة أو السائق/العميل) ── */}
        {!selectedConv ? (
          <div className="flex flex-col h-full bg-[#fdfaf7]">
            
            {/* Header - System Orange-Red */}
            <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 p-4 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shadow-inner">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-bold text-sm leading-tight">الدردشات والمراسلات</h2>
                    <span className="bg-white/20 text-white border border-white/30 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      سريع ون
                    </span>
                  </div>
                  <p className="text-[11px] text-white/90 mt-0.5">
                    {userType === 'driver' 
                      ? 'اختر مراسلة العميل أو الإدارة' 
                      : 'اختر مراسلة السائق أو الإدارة'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {totalUnread > 0 && (
                  <span className="bg-white text-red-600 text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    {totalUnread} جديد
                  </span>
                )}
                <button 
                  onClick={onClose} 
                  className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white/90"
                  title="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-white">
              
              {/* قسم الدعم والإدارة */}
              <div className="p-2 bg-orange-50/50 border-b border-orange-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-orange-800">الدعم المباشر والرسمي</span>
                <span className="text-[10px] text-orange-700 bg-orange-100/70 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">
                  متاح 24/7
                </span>
              </div>

              {/* 1. خيار مراسلة الإدارة */}
              <button
                onClick={() => handleSelectConversation(adminConversation)}
                className="w-full p-3.5 flex items-center gap-3 hover:bg-orange-50/30 transition-colors text-right relative group"
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-600 to-red-600 text-white flex items-center justify-center shadow-md">
                    <Bot className="h-6 w-6" />
                  </div>
                  <span className="absolute bottom-0 left-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm text-gray-900 truncate">
                      {adminConversation.title}
                    </span>
                    {adminConversation.lastMessageAt && (
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {new Date(adminConversation.lastMessageAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-gray-500 truncate">
                      {adminConversation.lastMessage || 'تواصل مباشر مع فريق الدعم والعمليات'}
                    </p>

                    {adminConversation.unreadCount > 0 && (
                      <span className="bg-gradient-to-r from-orange-600 to-red-600 text-white text-[11px] font-black min-w-[22px] h-5 px-1.5 rounded-full flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                        {adminConversation.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-orange-800 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <Shield className="h-3 w-3 text-orange-600" />
                      إدارة التطبيق
                    </span>
                  </div>
                </div>

                <ChevronLeft className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
              </button>

              {/* قسم الطلبات النشطة (السائق أو العميل) */}
              <div className="p-2 bg-gray-50 border-y border-gray-100 flex items-center justify-between mt-1">
                <span className="text-[11px] font-bold text-gray-500">
                  {userType === 'customer' 
                    ? 'طلباتك النشطة (مراسلة الكابتن)' 
                    : 'طلباتك المستلمة (مراسلة العميل)'}
                </span>
                {orderConversations.length > 0 && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full font-semibold">
                    {orderConversations.length} نشط
                  </span>
                )}
              </div>

              {/* قائمة محادثات الطلبات */}
              {orderConversations.length > 0 ? (
                orderConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className="w-full p-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-right relative group"
                  >
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md ${
                        userType === 'customer' ? 'bg-[#ff7a00]' : 'bg-[#0070ba]'
                      }`}>
                        {userType === 'customer' ? (
                          <Truck className="h-6 w-6" />
                        ) : (
                          <User className="h-6 w-6" />
                        )}
                      </div>
                      <span className={`absolute bottom-0 left-0 w-3.5 h-3.5 border-2 border-white rounded-full shadow-sm ${
                        conv.isOnline ? 'bg-[#25d366]' : 'bg-gray-400'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {conv.title}
                        </span>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                            {new Date(conv.lastMessageAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-gray-500 truncate">
                          {conv.lastMessage || 'بدء المحادثة والتنسيق بخصوص الطلب'}
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="bg-gradient-to-r from-orange-600 to-red-600 text-white text-[11px] font-black min-w-[22px] h-5 px-1.5 rounded-full flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                        <span className="bg-orange-50 text-orange-700 font-bold px-1.5 py-0.2 rounded">
                          طلب #{conv.orderNumber}
                        </span>
                        {conv.isOnline ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            متصل الآن
                          </span>
                        ) : (
                          <span className="text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded-full font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            مغلق
                          </span>
                        )}
                        {conv.participantPhone && (
                          <span className="text-gray-400 font-mono mr-auto">
                            {conv.participantPhone}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronLeft className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-gray-400 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                    <Truck className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-700">
                    {userType === 'customer' 
                      ? 'لا توجد طلبات جارية مع كابتن حالياً' 
                      : 'لا توجد طلبات مستلمة حالياً'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-[280px] leading-relaxed">
                    {userType === 'customer'
                      ? 'عند تأكيد واستلام الكابتن لطلبك، سيظهر خيار مراسلة الكابتن هنا فوراً للتواصل معه مباشرة.'
                      : 'عند استلامك لأي طلب نشط، سيظهر خيار مراسلة العميل هنا فوراً.'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom info banner */}
            <div className="p-2.5 bg-gray-50 border-t border-gray-200 text-center text-[10px] text-gray-500">
              رسائل آمنة ومشفرة على مدار الساعة عبر منصة سريع ون
            </div>
          </div>
        ) : (
          /* ── حالة العرض 2: شاشة المحادثة المحددة (سواء الإدارة أو الكابتن أو العميل) ── */
          <div className="flex flex-col h-full">
            
            {/* Header with Back Button - System Orange-Red */}
            <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 p-3 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Back Button */}
                <button
                  onClick={handleBackToList}
                  className="p-1 hover:bg-white/15 rounded-full transition-colors text-white/90 shrink-0"
                  title="العودة لقائمة المحادثات"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-inner ${
                    selectedConv.type === 'admin' 
                      ? 'bg-white/20' 
                      : (userType === 'customer' ? 'bg-[#ff7a00]' : 'bg-[#c2410c]')
                  }`}>
                    {selectedConv.type === 'admin' ? (
                      <Bot className="h-5 w-5" />
                    ) : (
                      userType === 'customer' ? <Truck className="h-5 w-5" /> : <User className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-2 border-orange-600 rounded-full ${
                    isCurrentTargetOnline ? 'bg-emerald-400' : 'bg-gray-400'
                  }`} />
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs truncate leading-tight">
                      {selectedConv.title}
                    </p>
                    <span className="bg-white/20 text-white border border-white/30 text-[9px] font-bold px-1 rounded-full shrink-0">
                      سريع ون
                    </span>
                  </div>
                  <p className="text-[10px] text-white/90 flex items-center gap-1 mt-0.5 truncate">
                    {selectedConv.type === 'admin' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block animate-ping shrink-0" />
                        <span>متصل الآن • الرد فوري</span>
                      </>
                    ) : isCurrentTargetOnline ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block animate-ping shrink-0" />
                        <span>متصل الآن • داخل التطبيق</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block shrink-0" />
                        <span>حالة {userType === 'customer' ? 'الكابتن' : 'العميل'}: مغلق</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Quick Actions & Close */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedConv.participantPhone && (
                  <>
                    <a
                      href={`tel:${selectedConv.participantPhone}`}
                      className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white/90"
                      title="اتصال هاتفي"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://wa.me/${getCleanPhone(selectedConv.participantPhone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white/80"
                      title="فتح في تطبيق واتساب"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </>
                )}
                <button 
                  onClick={onClose} 
                  className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white/90"
                  title="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages container - SareeOne System Wallpaper */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3.5 space-y-2.5"
              style={{
                backgroundImage: 'radial-gradient(#fed7aa 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                backgroundColor: '#fffaf8'
              }}
            >
              {isMessagesLoading && activeMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-5 bg-white/90 backdrop-blur rounded-2xl border border-orange-100 shadow-sm max-w-[320px] mx-auto">
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">
                    بدء محادثة مع {selectedConv.participantName}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    أرسل رسالتك وسيتلقى الطرف الآخر إشعاراً فورياً للرد عليك.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1 justify-center">
                    {quickChips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setMessage(chip);
                          sendMessageMutation.mutate(chip);
                        }}
                        className="text-[10px] bg-white text-gray-700 border border-orange-200 hover:bg-orange-50 hover:text-orange-600 px-2 py-1 rounded-full transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeMessages.map((msg: any) => {
                  const isMe = msg.senderId === effectiveUserId || 
                               (msg.senderType === userType && msg.senderId !== 'admin');

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[85%] p-2.5 rounded-2xl shadow-sm text-xs leading-relaxed relative ${
                        isMe 
                          ? 'bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-tr-none border border-orange-500 shadow-xs' 
                          : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                      }`}>
                        {!isMe && (
                          <p className="text-[10px] font-bold text-orange-700 mb-0.5">
                            {selectedConv.type === 'admin' 
                              ? 'فريق دعم سريع ون (الإدارة)' 
                              : selectedConv.participantName}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 text-[9px] justify-end select-none ${isMe ? 'text-orange-100' : 'text-gray-400'}`}>
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMe && (
                            msg.isRead ? (
                              <span className="text-sky-200 font-black tracking-tighter text-[11px]" title="تمت القراءة (صحين أزرق)">
                                ✓✓
                              </span>
                            ) : msg.isDelivered ? (
                              <span className="text-white font-black tracking-tighter text-[11px]" title="تم الاستلام في التطبيق (صحين غامقين)">
                                ✓✓
                              </span>
                            ) : (
                              <span className="text-orange-200 font-bold text-[11px]" title="تم الإرسال - الطرف الآخر مغلق (صح واحدة)">
                                ✓
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input area - System Orange Bar */}
            <form onSubmit={handleSend} className="p-2.5 border-t border-orange-100 bg-[#fff8f5] flex items-center gap-2 shrink-0">
              <Input 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`اكتب رسالة لـ ${selectedConv.participantName}...`}
                className="rounded-full border border-orange-200 bg-white focus-visible:ring-1 focus-visible:ring-orange-500 text-xs h-10 px-4 shadow-inner"
                disabled={sendMessageMutation.isPending}
              />
              <Button 
                type="submit" 
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="rounded-full h-10 w-10 p-0 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shrink-0 shadow-md transition-all active:scale-95"
              >
                {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
