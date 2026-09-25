import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageSquare, 
  Send, 
  Check, 
  CheckCheck, 
  Search, 
  User, 
  Truck, 
  Phone, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  Bot, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowRight,
  Smile,
  ShieldCheck,
  Radio,
  Flame
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Native Web Audio chime for WhatsApp-like messaging sound
function playWhatsAppChime(type: 'sent' | 'received' = 'sent') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'sent') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.14); // E5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch (_) {}
}

interface WhatsAppChatBoxProps {
  initialUserId?: string;
  initialUserType?: string;
  className?: string;
}

export default function WhatsAppChatBox({ initialUserId, initialUserType, className = '' }: WhatsAppChatBoxProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'customer' | 'driver' | 'unread'>('all');
  const [messageInput, setMessageInput] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);

  // Fetch all conversations
  const { data: convData, isLoading: isLoadingConvs, refetch: refetchConvs } = useQuery({
    queryKey: ['/api/messages/admin/conversations'],
    queryFn: async () => {
      const res = await fetch('/api/messages/admin/conversations');
      const text = await res.text();
      if (!res.ok) return { conversations: [] };
      try {
        return text ? JSON.parse(text) : { conversations: [] };
      } catch {
        return { conversations: [] };
      }
    },
    refetchInterval: 3000,
  });

  const rawConversations: any[] = useMemo(() => convData?.conversations || [], [convData]);

  // Set initial selected user if provided
  useEffect(() => {
    if (initialUserId && !selectedUser && rawConversations.length > 0) {
      const target = rawConversations.find(c => c.userId === initialUserId);
      if (target) {
        setSelectedUser(target);
      } else {
        setSelectedUser({
          userId: initialUserId,
          userType: initialUserType || 'customer',
          userName: `مستخدم #${initialUserId.slice(-5)}`,
          userPhone: initialUserId,
          lastMessage: '',
          lastMessageAt: new Date().toISOString(),
          isRead: true,
          unreadCount: 0
        });
      }
    } else if (!selectedUser && rawConversations.length > 0) {
      setSelectedUser(rawConversations[0]);
    }
  }, [initialUserId, initialUserType, rawConversations, selectedUser]);

  // Fetch messages for selected conversation
  const { data: chatData, isLoading: isLoadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['/api/messages/admin-chat', selectedUser?.userId, selectedUser?.userType],
    queryFn: async () => {
      if (!selectedUser?.userId) return { messages: [] };
      const res = await fetch(`/api/messages/admin-chat?userId=${encodeURIComponent(selectedUser.userId)}&userType=${encodeURIComponent(selectedUser.userType || 'customer')}`);
      const text = await res.text();
      if (!res.ok) return { messages: [] };
      try {
        return text ? JSON.parse(text) : { messages: [] };
      } catch {
        return { messages: [] };
      }
    },
    enabled: !!selectedUser?.userId,
    refetchInterval: 2500,
  });

  const currentMessages: any[] = useMemo(() => chatData?.messages || [], [chatData]);

  // Scroll to bottom & play audio when new messages arrive
  useEffect(() => {
    if (currentMessages.length > prevMessagesCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Play chime if incoming message
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg && lastMsg.senderType !== 'admin') {
        playWhatsAppChime('received');
      }
    }
    prevMessagesCountRef.current = currentMessages.length;
  }, [currentMessages]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedUser?.userId) throw new Error('يرجى اختيار محادثة أولاً');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text.trim(),
          senderId: 'admin',
          senderType: 'admin',
          receiverId: selectedUser.userId,
          receiverType: selectedUser.userType || 'customer',
          orderId: selectedUser.orderId || null,
        }),
      });
      const data = await res.text();
      if (!res.ok) {
        let err = 'فشل إرسال الرسالة';
        try {
          const json = JSON.parse(data);
          err = json.message || err;
        } catch (_) {}
        throw new Error(err);
      }
      try {
        return data ? JSON.parse(data) : {};
      } catch {
        return {};
      }
    },
    onSuccess: () => {
      setMessageInput('');
      playWhatsAppChime('sent');
      queryClient.invalidateQueries({ queryKey: ['/api/messages/admin-chat', selectedUser?.userId, selectedUser?.userType] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/admin/conversations'] });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    },
    onError: (err: any) => {
      toast({
        title: 'خطأ في الإرسال',
        description: err?.message || 'تعذر إرسال الرسالة للمستخدم',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || sendMutation.isPending) return;
    sendMutation.mutate(messageInput.trim());
  };

  const handleQuickReply = (text: string) => {
    setMessageInput(text);
    setShowQuickReplies(false);
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return rawConversations.filter((c: any) => {
      const matchSearch = 
        !searchTerm.trim() ||
        (c.userName && c.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.userPhone && c.userPhone.includes(searchTerm)) ||
        (c.userId && c.userId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (activeFilter === 'customer') return c.userType === 'customer';
      if (activeFilter === 'driver') return c.userType === 'driver';
      if (activeFilter === 'unread') return (c.unreadCount || 0) > 0 || !c.isRead;
      return true;
    });
  }, [rawConversations, searchTerm, activeFilter]);

  const totalUnread = useMemo(() => {
    return rawConversations.reduce((acc, c) => acc + (c.unreadCount || (c.isRead ? 0 : 1)), 0);
  }, [rawConversations]);

  // Clean phone number for WhatsApp wa.me links
  const getCleanPhone = (phoneStr?: string) => {
    if (!phoneStr) return '';
    let digits = phoneStr.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '967' + digits.slice(1);
    if (!digits.startsWith('967') && digits.length === 9) digits = '967' + digits;
    return digits;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast({
      title: 'تم النسخ',
      description: `تم نسخ ${label} إلى الحافظة`,
    });
  };

  // Quick replies list
  const quickReplies = [
    'أهلاً وسهلاً بك في منصة سريع ون! كيف يمكننا خدمتك ومساعدتك اليوم؟ 😊',
    'طلبك قيد المتابعة مع الكابتن الآن وسنوافيك بالتحديثات فوراً 🛵',
    'تم تسجيل ملاحظتك وجاري العمل على معالجتها بأسرع وقت ممكن ✅',
    'يرجى تزويدنا برقم الطلب لتسهيل متابعة العملية معك 📦',
    'شكراً لتواصلك معنا وسعداء جداً بخدمتك دائماً 🙏'
  ];

  return (
    <div className={`flex h-[750px] w-full rounded-2xl border border-gray-300 bg-white shadow-xl overflow-hidden font-sans ${className}`} dir="rtl">
      
      {/* ── الجانب الأيمن: قائمة المحادثات (سريع ون) ── */}
      <div className="w-full md:w-[360px] lg:w-[400px] border-l border-gray-200 flex flex-col bg-[#fdfaf7] shrink-0">
        
        {/* شريط رأس المحادثات بنظام سريع ون البرتقالي المحمر */}
        <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 text-white p-4 flex items-center justify-between shadow-md select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight flex items-center gap-1.5">
                محادثات الدعم الفوري
                <span className="bg-white/20 text-white border border-white/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  سريع ون
                </span>
              </h2>
              <p className="text-xs text-white/90 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block animate-ping" />
                متصل وجاهز للرد
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => refetchConvs()} 
            className="p-2 hover:bg-white/15 rounded-full transition-colors text-white/90"
            title="تحديث المحادثات"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingConvs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* شريط البحث وتصفية الفئات */}
        <div className="p-2.5 bg-[#fdfaf7] border-b border-orange-100 space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="البحث باسم العميل أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9 pl-3 h-9 bg-white text-xs rounded-lg border-orange-200 focus:bg-white focus-visible:ring-1 focus-visible:ring-orange-500 shadow-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute left-2.5 top-2 text-xs text-gray-400 hover:text-gray-600">
                ✕
              </button>
            )}
          </div>

          {/* فلاتر سريعة بنظام سريع ون */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === 'all' 
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
              }`}
            >
              الكل ({rawConversations.length})
            </button>
            <button
              onClick={() => setActiveFilter('customer')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === 'customer' 
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
              }`}
            >
              العملاء
            </button>
            <button
              onClick={() => setActiveFilter('driver')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === 'driver' 
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
              }`}
            >
              السائقين
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                activeFilter === 'unread' 
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
              }`}
            >
              غير المقروءة
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* قائمة المحادثات المعروضة */}
        <div className="flex-1 overflow-y-auto bg-white divide-y divide-gray-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
              <MessageSquare className="h-12 w-12 text-gray-300 mb-2" />
              <p className="font-bold text-sm text-gray-500">لا توجد محادثات مطابقة</p>
              <p className="text-xs text-gray-400 mt-1">أي رسالة يرسلها عميل أو سائق ستظهر هنا فوراً وبشكل تلقائي</p>
            </div>
          ) : (
            filteredConversations.map((conv: any) => {
              const isSelected = selectedUser?.userId === conv.userId;
              const isDriver = conv.userType === 'driver';
              const unread = (conv.unreadCount || 0) > 0 || !conv.isRead;
              const initials = (conv.userName || 'ع').slice(0, 2);

              return (
                <button
                  key={`${conv.userType}:${conv.userId}`}
                  onClick={() => setSelectedUser(conv)}
                  className={`w-full p-3.5 flex items-center gap-3 text-right transition-colors hover:bg-orange-50/40 ${
                    isSelected ? 'bg-orange-50/70 border-r-4 border-orange-600' : 'bg-white'
                  }`}
                >
                  {/* الأفاتار الشخصي */}
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm ${
                      isDriver ? 'bg-gradient-to-tr from-amber-600 to-orange-500' : 'bg-gradient-to-tr from-orange-600 to-red-600'
                    }`}>
                      {isDriver ? <Truck className="h-6 w-6 text-white" /> : initials}
                    </div>
                    <span className="absolute bottom-0 left-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>

                  {/* تفاصيل المحادثة والرسالة الأخيرة */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-sm text-gray-900 truncate">
                        {conv.userName || (isDriver ? 'كابتن توصيل' : 'عميل')}
                      </span>
                      <span className="text-[11px] text-gray-400 shrink-0 font-medium">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        {conv.isRead ? (
                          <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] shrink-0" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        )}
                        <span className="truncate">{conv.lastMessage || 'لا توجد رسائل'}</span>
                      </p>

                      {unread && (
                        <span className="bg-gradient-to-r from-orange-600 to-red-600 text-white text-[11px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shrink-0">
                          {conv.unreadCount || 1}
                        </span>
                      )}
                    </div>

                    {/* تصنيف المستخدم وهاتفه */}
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                      <span className={`px-1.5 py-0.2 rounded font-semibold ${
                        isDriver ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {isDriver ? 'سائق' : 'عميل'}
                      </span>
                      {conv.userPhone && (
                        <span className="font-mono text-gray-500">{conv.userPhone}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── الجانب الأيسر: صندوق شات سريع ون النشط ── */}
      <div className="flex-1 flex flex-col bg-[#fffaf8] relative min-w-0">
        
        {selectedUser ? (
          <>
            {/* شريط رأس المحادثة العلوية - بنظام سريع ون */}
            <div className="bg-gradient-to-r from-orange-50 via-white to-red-50 border-b border-orange-200 px-4 py-2.5 flex items-center justify-between shadow-xs shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm ${
                    selectedUser.userType === 'driver' ? 'bg-gradient-to-tr from-amber-600 to-orange-500' : 'bg-gradient-to-tr from-orange-600 to-red-600'
                  }`}>
                    {selectedUser.userType === 'driver' ? <Truck className="h-5 w-5" /> : (selectedUser.userName || 'ع').slice(0, 2)}
                  </div>
                  <span className="absolute bottom-0 left-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 truncate flex items-center gap-1.5">
                    {selectedUser.userName || 'المستخدم'}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      selectedUser.userType === 'driver' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedUser.userType === 'driver' ? 'كابتن توصيل' : 'عميل سريع ون'}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      متصل الآن
                    </span>
                    {selectedUser.userPhone && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="font-mono text-gray-600">{selectedUser.userPhone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* أزرار الإجراءات المباشرة: اتصال + فتح واتساب + نسخ */}
              <div className="flex items-center gap-1">
                {selectedUser.userPhone && (
                  <>
                    <a
                      href={`https://wa.me/${getCleanPhone(selectedUser.userPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      title="فتح محادثة واتساب الرسمية"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">واتساب خارجي</span>
                    </a>

                    <a
                      href={`tel:${selectedUser.userPhone}`}
                      className="p-2 hover:bg-orange-100 text-orange-700 rounded-full transition-colors"
                      title="اتصال هاتفي مباشر"
                    >
                      <Phone className="h-4 w-4 text-orange-600" />
                    </a>

                    <button
                      onClick={() => copyToClipboard(selectedUser.userPhone, 'رقم الهاتف')}
                      className="p-2 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                      title="نسخ رقم الهاتف"
                    >
                      <Copy className="h-4 w-4 text-gray-600" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => refetchMessages()}
                  className="p-2 hover:bg-orange-100 text-orange-700 rounded-full transition-colors"
                  title="تحديث الرسائل"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* مساحة رسائل سريع ون مع خلفية دافئة */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{
                backgroundImage: 'radial-gradient(#fed7aa 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                backgroundColor: '#fffaf8'
              }}
            >
              {/* شارة تاريخ اليوم */}
              <div className="flex justify-center my-2">
                <span className="bg-white/95 shadow-xs border border-orange-200 text-orange-800 text-[11px] font-bold px-3 py-1 rounded-full select-none">
                  محادثة خدمة العملاء المباشرة (سريع ون)
                </span>
              </div>

              {isLoadingMessages && currentMessages.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <RefreshCw className="h-6 w-6 text-orange-600 animate-spin" />
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white/80 backdrop-blur rounded-2xl border border-orange-100 max-w-sm mx-auto my-8 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">بدء محادثة جديدة مع {selectedUser.userName || 'العميل'}</h4>
                  <p className="text-xs text-gray-500 mt-1">اكتب رسالتك بالأسفل أو اختر رداً جاهزاً للتواصل الفوري</p>
                </div>
              ) : (
                currentMessages.map((msg: any) => {
                  const isMe = msg.senderType === 'admin';
                  const timeFormatted = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : '';

                  return (
                    <div 
                      key={msg.id || Math.random()} 
                      className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                    >
                      <div 
                        className={`max-w-[80%] md:max-w-[70%] p-3 rounded-2xl shadow-xs relative group text-sm leading-relaxed ${
                          isMe 
                            ? 'bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-tr-none border border-orange-500' 
                            : 'bg-white text-gray-900 rounded-tl-none border border-gray-200'
                        }`}
                      >
                        {/* مرسل الرسالة للمجموعات أو التوضيح */}
                        {!isMe && (
                          <p className="text-[11px] font-bold text-orange-700 mb-1">
                            {selectedUser.userName || (selectedUser.userType === 'driver' ? 'الكابتن' : 'العميل')}
                          </p>
                        )}

                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                        {/* شريط الوقت وعلامات الصح الأزرق */}
                        <div className={`flex items-center gap-1 mt-1 text-[10px] select-none ${isMe ? 'justify-end text-orange-100' : 'justify-end text-gray-400'}`}>
                          <span>{timeFormatted}</span>
                          {isMe && (
                            <CheckCheck className="h-3.5 w-3.5 text-sky-200" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* خيارات الردود السريعة الذكية */}
            {showQuickReplies && (
              <div className="p-3 bg-white border-t border-orange-200 flex flex-wrap gap-1.5 shadow-md">
                <div className="w-full flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                    الردود السريعة الجاهزة:
                  </span>
                  <button onClick={() => setShowQuickReplies(false)} className="text-xs text-gray-400 hover:text-gray-600">
                    إغلاق ✕
                  </button>
                </div>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickReply(qr)}
                    className="text-xs bg-gray-100 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 transition-colors text-right"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            {/* شريط الإدخال السفلي بنظام سريع ون */}
            <form onSubmit={handleSendMessage} className="bg-[#fff8f5] p-2.5 border-t border-orange-200 flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className="h-10 w-10 p-0 rounded-full text-gray-600 hover:bg-orange-100 hover:text-orange-600 shrink-0"
                title="قوالب الردود الجاهزة"
              >
                <Sparkles className="h-5 w-5" />
              </Button>

              <Input 
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="اكتب ردك للعميل أو السائق هنا..."
                className="bg-white rounded-full border border-orange-200 h-11 px-4 text-sm focus-visible:ring-1 focus-visible:ring-orange-500 shadow-inner"
                disabled={sendMutation.isPending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <Button
                type="submit"
                disabled={!messageInput.trim() || sendMutation.isPending}
                className="h-11 w-11 p-0 rounded-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shrink-0 shadow-md transition-all active:scale-95"
                title="إرسال (Enter)"
              >
                {sendMutation.isPending ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 text-orange-600 border border-orange-100">
              <MessageSquare className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-700">صندوق محادثات سريع ون المباشر</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-sm">
              حدد أي محادثة من القائمة الجانبية لبدء المحادثة الفورية، أو تواصل مع عملائك وسائقيك بنقرة زر واحدة.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
