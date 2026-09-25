import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle, 
  Send, 
  X, 
  User, 
  Truck, 
  Bot, 
  Shield, 
  Loader2,
  Check,
  CheckCheck,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface OrderChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber?: string;
  recipientName: string;
  recipientPhone: string;
  currentUserType: 'customer' | 'driver';
  currentUserId: string;
}

type ChatTarget = 'party' | 'admin';

export function OrderChatModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  recipientName,
  recipientPhone,
  currentUserType,
  currentUserId,
}: OrderChatModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTarget, setActiveTarget] = useState<ChatTarget>('party');
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveUserId = currentUserId || (currentUserType === 'customer' ? 'customer_guest' : 'driver_guest');

  // 1. Fetch Order Messages (between customer and driver)
  const { 
    data: orderMessages = [], 
    isLoading: isOrderLoading, 
    refetch: refetchOrderMessages 
  } = useQuery({
    queryKey: ['/api/messages/order', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const res = await fetch(`/api/messages/order/${orderId}?readerType=${currentUserType}&readerId=${encodeURIComponent(effectiveUserId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isOpen && !!orderId && activeTarget === 'party',
    refetchInterval: 3000,
  });

  // 2. Fetch Admin Messages (between this user and admin)
  const { 
    data: adminMessagesData, 
    isLoading: isAdminLoading, 
    refetch: refetchAdminMessages 
  } = useQuery({
    queryKey: ['/api/messages/admin-chat', effectiveUserId, currentUserType],
    queryFn: async () => {
      if (!effectiveUserId) return { messages: [] };
      const res = await fetch(`/api/messages/admin-chat?userId=${encodeURIComponent(effectiveUserId)}&userType=${currentUserType}&reader=user`);
      if (!res.ok) return { messages: [] };
      return res.json();
    },
    enabled: isOpen && !!effectiveUserId && activeTarget === 'admin',
    refetchInterval: 3000,
  });

  const adminMessages = adminMessagesData?.messages || [];

  // 3. User unread conversations count to show badges on the tabs
  const { data: userConversationsData } = useQuery({
    queryKey: ['/api/messages/user-conversations', effectiveUserId, currentUserType],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const res = await fetch(`/api/messages/user-conversations?userId=${encodeURIComponent(effectiveUserId)}&userType=${currentUserType}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isOpen && !!effectiveUserId,
    refetchInterval: 4000,
  });

  const adminUnreadCount = userConversationsData?.adminConversation?.unreadCount || 0;
  const currentOrderConv = userConversationsData?.orderConversations?.find(
    (c: any) => c.orderId === orderId || c.orderNumber === orderNumber
  );
  const partyUnreadCount = currentOrderConv?.unreadCount || 0;

  // Real-time presence query for the other party
  const targetId = recipientPhone || recipientName;
  const targetType = currentUserType === 'customer' ? 'driver' : 'customer';

  const { data: presenceData } = useQuery({
    queryKey: ['/api/messages/presence', targetId, targetType, orderId],
    queryFn: async () => {
      if (activeTarget === 'admin') return { isOnline: true, status: 'online', text: 'متصل' };
      const res = await fetch(`/api/messages/presence?userId=${encodeURIComponent(targetId)}&userType=${targetType}&orderId=${encodeURIComponent(orderId || '')}`);
      if (!res.ok) return { isOnline: false, status: 'offline', text: 'مغلق' };
      return res.json();
    },
    enabled: isOpen && !!orderId && activeTarget === 'party',
    refetchInterval: 2500,
  });

  const isPartyOnline = activeTarget === 'admin' ? true : (presenceData?.isOnline ?? false);

  // WebSocket Live Sync for Order Chat
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
          payload: { userId: effectiveUserId, userType: currentUserType }
        }));

        if (orderId && activeTarget === 'party') {
          ws?.send(JSON.stringify({
            type: 'open_chat',
            payload: { orderId, userId: effectiveUserId, userType: currentUserType }
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
            refetchOrderMessages();
            refetchAdminMessages();
            queryClient.invalidateQueries({ queryKey: ['/api/messages/presence'] });
            queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (keepAlive) clearInterval(keepAlive);
      ws?.close();
    };
  }, [isOpen, effectiveUserId, currentUserType, orderId, activeTarget, queryClient, refetchOrderMessages, refetchAdminMessages]);

  // Auto mark read when switching targets
  useEffect(() => {
    if (!isOpen || !effectiveUserId) return;

    if (activeTarget === 'party' && orderId) {
      fetch('/api/messages/user/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          userType: currentUserType,
          type: 'order',
          orderId,
        }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
      }).catch(() => {});
    } else if (activeTarget === 'admin') {
      fetch('/api/messages/user/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          userType: currentUserType,
          type: 'admin',
        }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
      }).catch(() => {});
    }
  }, [isOpen, activeTarget, orderId, effectiveUserId, currentUserType, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      let payload: any;
      if (activeTarget === 'party') {
        const receiverType = currentUserType === 'customer' ? 'driver' : 'customer';
        payload = {
          orderId,
          content,
          senderId: effectiveUserId,
          senderType: currentUserType,
          receiverId: recipientPhone || recipientName || 'party',
          receiverType,
        };
      } else {
        payload = {
          orderId: null,
          content,
          senderId: effectiveUserId,
          senderType: currentUserType,
          receiverId: 'admin',
          receiverType: 'admin',
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
      if (activeTarget === 'party') {
        queryClient.invalidateQueries({ queryKey: ['/api/messages/order', orderId] });
        refetchOrderMessages();
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/messages/admin-chat'] });
        refetchAdminMessages();
      }
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user-conversations'] });
    },
    onError: (err: any) => {
      toast({
        title: 'فشل الإرسال',
        description: err?.message || 'تعذر إرسال الرسالة عبر النظام',
        variant: 'destructive',
      });
    },
  });

  const currentMessages = activeTarget === 'party' ? orderMessages : adminMessages;
  const isLoading = activeTarget === 'party' ? isOrderLoading : isAdminLoading;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, activeTarget]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  const quickMessages = activeTarget === 'admin' ? [
    'أين طلبي الآن؟ 🛵',
    'استفسار عن التوصيل 📦',
    'مساعدة في الطلب 💬'
  ] : (currentUserType === 'customer' ? [
    'أين وصلت بالطلب يا كابتن؟ 🛵',
    'أنا بانتظارك في العنوان المحدد 📍',
    'كم تحتاج من الوقت للوصول؟ ⏱️',
    'شكراً لك تم استلام الطلب 👍',
  ] : [
    'أنا في طريق إليك الآن 🛵',
    'لقد وصلت إلى الموقع، أنا بانتظارك بالخارج 📍',
    'يرجى الرد على الهاتف لتسليم الطلب 📞',
    'شكراً لتعاونك معنا 🙏',
  ]);

  const partyTitle = currentUserType === 'customer' 
    ? `الكابتن (${recipientName || 'السائق'})` 
    : `العميل (${recipientName || 'المشتري'})`;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] h-[580px] rounded-3xl p-0 flex flex-col overflow-hidden bg-white shadow-2xl border-none" dir="rtl">
        
        {/* Header - System Orange-Red Gradient */}
        <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 p-3.5 text-white flex items-center justify-between shrink-0 shadow-md select-none">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white shadow-inner">
                {activeTarget === 'party' ? (
                  currentUserType === 'customer' ? <Truck className="h-5 w-5" /> : <User className="h-5 w-5" />
                ) : (
                  <Bot className="h-5 w-5" />
                )}
              </div>
              <span className={`absolute bottom-0 left-0 w-3 h-3 border-2 border-orange-600 rounded-full shadow-xs ${
                isPartyOnline ? 'bg-emerald-400' : 'bg-gray-400'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm leading-tight">
                  {activeTarget === 'party' ? partyTitle : 'خدمة عملاء سريع ون (الإدارة)'}
                </p>
                <span className="bg-white/20 text-white border border-white/30 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  سريع ون
                </span>
              </div>
              <p className="text-[11px] text-white/90 mt-0.5 flex items-center gap-1">
                {activeTarget === 'admin' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block animate-ping shrink-0" />
                    <span>متصل الآن • الرد فوري</span>
                  </>
                ) : isPartyOnline ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block animate-ping shrink-0" />
                    <span>طلب #{orderNumber || orderId} • متصل الآن</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block shrink-0" />
                    <span>طلب #{orderNumber || orderId} • مغلق</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white/90">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── تبديل وجهة المحادثة (السائق/العميل vs الإدارة) مع عداد الرسائل غير المقروءة ── */}
        <div className="bg-[#fdfaf7] p-2 border-b border-orange-100 flex items-center gap-2 shrink-0">
          {/* زر مراسلة الطرف الآخر في الطلب */}
          <button
            onClick={() => setActiveTarget('party')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 relative ${
              activeTarget === 'party'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-orange-50 border border-gray-200'
            }`}
          >
            {currentUserType === 'customer' ? <Truck className="h-4 w-4" /> : <User className="h-4 w-4" />}
            <span>{currentUserType === 'customer' ? 'مراسلة السائق' : 'مراسلة العميل'}</span>
            {partyUnreadCount > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs ${
                activeTarget === 'party' ? 'bg-white text-orange-600' : 'bg-red-500 text-white animate-pulse'
              }`}>
                {partyUnreadCount}
              </span>
            )}
          </button>

          {/* زر مراسلة الإدارة */}
          <button
            onClick={() => setActiveTarget('admin')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 relative ${
              activeTarget === 'admin'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-orange-50 border border-gray-200'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>مراسلة الإدارة</span>
            {adminUnreadCount > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs ${
                activeTarget === 'admin' ? 'bg-white text-orange-600' : 'bg-red-500 text-white animate-pulse'
              }`}>
                {adminUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Messages Bar */}
        <div className="bg-[#fffdfb] px-3 py-2 border-b border-orange-100 flex gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          {quickMessages.map((qm, idx) => (
            <button
              key={idx}
              onClick={() => sendMessageMutation.mutate(qm)}
              className="bg-white border border-orange-200 text-gray-700 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-colors shadow-xs"
            >
              {qm}
            </button>
          ))}
        </div>

        {/* Messages List - System Wallpaper */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto p-3.5 space-y-2.5"
          style={{
            backgroundImage: 'radial-gradient(#fed7aa 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            backgroundColor: '#fffaf8'
          }}
        >
          {isLoading && currentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
            </div>
          ) : currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-white/90 backdrop-blur rounded-2xl border border-orange-100 shadow-sm max-w-[300px] mx-auto">
              <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                <MessageCircle className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-gray-800">
                {activeTarget === 'party' 
                  ? (currentUserType === 'customer' ? 'محادثة مباشرة مع كابتن التوصيل' : 'محادثة مباشرة مع العميل')
                  : 'محادثة مباشرة مع فريق الإدارة والدعم'}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                اكتب رسالتك وسيتلقى الطرف الآخر إشعاراً فورياً للرد عليك.
              </p>
            </div>
          ) : (
            currentMessages.map((msg: any) => {
              const isMe = activeTarget === 'party'
                ? msg.senderType === currentUserType
                : (msg.senderId === effectiveUserId || (msg.senderType === currentUserType && msg.senderId !== 'admin'));

              return (
                <div key={msg.id || Math.random()} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-2.5 rounded-2xl shadow-xs text-xs leading-relaxed relative ${
                    isMe
                      ? 'bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-tr-none border border-orange-500'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                  }`}>
                    {!isMe && (
                      <p className="text-[10px] font-bold text-orange-700 mb-0.5">
                        {activeTarget === 'party' ? (recipientName || 'الطرف الآخر') : 'فريق دعم سريع ون (الإدارة)'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 text-[9px] justify-end select-none ${isMe ? 'text-orange-100' : 'text-gray-400'}`}>
                      <span>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : ''}
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

        {/* Input Form - System Orange Bar */}
        <form onSubmit={handleSend} className="p-2.5 bg-[#fff8f5] border-t border-orange-100 flex items-center gap-2 shrink-0">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`اكتب رسالة إلى ${activeTarget === 'party' ? (currentUserType === 'customer' ? 'السائق' : 'العميل') : 'الإدارة'}...`}
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
      </DialogContent>
    </Dialog>
  );
}
export default OrderChatModal;
