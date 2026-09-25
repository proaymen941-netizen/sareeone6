import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  User, 
  Truck, 
  Phone, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send, 
  MessageSquare, 
  Eye, 
  Radio, 
  Flame, 
  Store, 
  MapPin, 
  PackageCheck, 
  AlertCircle,
  Sparkles,
  Filter,
  CheckCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface MonitoredOrderChat {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderTotal: number;
  deliveryAddress?: string;
  storeName?: string;
  customer: {
    id?: string;
    name: string;
    phone?: string;
  };
  driver: {
    id?: string;
    name: string;
    phone?: string;
  };
  messages: Array<{
    id: string;
    content: string;
    senderId: string;
    senderType: 'customer' | 'driver' | 'admin';
    senderDisplayName?: string;
    createdAt: string;
    isRead?: boolean;
  }>;
  messageCount: number;
  hasAlert: boolean;
  flaggedKeywords: string[];
  lastMessage?: {
    content: string;
    senderType: string;
    senderName: string;
    createdAt: string;
  };
  isActive: boolean;
  unreadForCustomer: number;
  unreadForDriver: number;
  adminInterventions: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'قيد الانتظار', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300' },
  confirmed: { label: 'تم التأكيد', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
  preparing: { label: 'قيد التجهيز', color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-300' },
  assigned: { label: 'تم تعيين كابتن', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-300' },
  accepted: { label: 'الكابتن قبل الطلب', color: 'text-cyan-700', bg: 'bg-cyan-100 border-cyan-300' },
  picked_up: { label: 'تم استلام الطلب', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  on_way: { label: 'في الطريق للعميل', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  delivered: { label: 'تم التسليم بنجاح', color: 'text-green-700', bg: 'bg-green-100 border-green-300' },
  cancelled: { label: 'طلب ملغي', color: 'text-red-700', bg: 'bg-red-100 border-red-300' },
};

export default function OrderChatMonitoring({ className = '' }: { className?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedOrder, setSelectedOrder] = useState<MonitoredOrderChat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'flagged' | 'completed'>('all');
  const [interventionText, setInterventionText] = useState('');
  const [interventionType, setInterventionType] = useState<'warning' | 'notice'>('notice');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all order chats for surveillance
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/messages/admin/order-monitoring'],
    queryFn: async () => {
      const res = await fetch('/api/messages/admin/order-monitoring');
      const text = await res.text();
      if (!res.ok) return { conversations: [], stats: {} };
      try {
        return text ? JSON.parse(text) : { conversations: [], stats: {} };
      } catch {
        return { conversations: [], stats: {} };
      }
    },
    refetchInterval: 3500,
  });

  const conversations: MonitoredOrderChat[] = useMemo(() => data?.conversations || [], [data]);
  const stats = data?.stats || { totalChats: 0, activeChats: 0, totalMessages: 0, flaggedChats: 0 };

  // Keep selected order synced with latest data
  useEffect(() => {
    if (conversations.length > 0) {
      if (!selectedOrder) {
        setSelectedOrder(conversations[0]);
      } else {
        const updated = conversations.find(c => c.orderId === selectedOrder.orderId);
        if (updated) setSelectedOrder(updated);
      }
    }
  }, [conversations, selectedOrder]);

  // Scroll messages to bottom on change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedOrder?.messages]);

  // Filtered list
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = 
        !term ||
        c.orderNumber.toLowerCase().includes(term) ||
        c.customer.name.toLowerCase().includes(term) ||
        (c.customer.phone && c.customer.phone.includes(term)) ||
        c.driver.name.toLowerCase().includes(term) ||
        (c.driver.phone && c.driver.phone.includes(term)) ||
        (c.storeName && c.storeName.toLowerCase().includes(term)) ||
        c.messages.some(m => m.content.toLowerCase().includes(term));

      if (!matchSearch) return false;

      if (filterType === 'active') return c.isActive;
      if (filterType === 'flagged') return c.hasAlert;
      if (filterType === 'completed') return !c.isActive;
      return true;
    });
  }, [conversations, searchTerm, filterType]);

  // Admin Supervisory Intervention Mutation
  const interveneMutation = useMutation({
    mutationFn: async ({ orderId, message, type }: { orderId: string; message: string; type: string }) => {
      const res = await fetch('/api/messages/admin/order-monitoring/intervene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          message,
          interventionType: type,
        }),
      });
      const resText = await res.text();
      if (!res.ok) {
        let err = 'فشل إرسال التوجيه الرقابي';
        try {
          const j = JSON.parse(resText);
          err = j.message || err;
        } catch (_) {}
        throw new Error(err);
      }
      try {
        return JSON.parse(resText);
      } catch {
        return {};
      }
    },
    onSuccess: () => {
      setInterventionText('');
      toast({
        title: 'تم إرسال التوجيه الرقابي',
        description: 'تم بث الإشعار الإداري في محادثة الطلب بنجاح وظهر للعميل والكابتن',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/admin/order-monitoring'] });
    },
    onError: (err: any) => {
      toast({
        title: 'خطأ',
        description: err?.message || 'تعذر إرسال التوجيه الرقابي',
        variant: 'destructive',
      });
    },
  });

  const handleSendIntervention = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOrder || !interventionText.trim() || interveneMutation.isPending) return;
    interveneMutation.mutate({
      orderId: selectedOrder.orderId,
      message: interventionText.trim(),
      type: interventionType,
    });
  };

  const copyText = (txt?: string, label = 'النص') => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt);
    toast({ title: 'تم النسخ', description: `تم نسخ ${label} إلى الحافظة` });
  };

  const cleanPhone = (p?: string) => {
    if (!p) return '';
    let d = p.replace(/\D/g, '');
    if (d.startsWith('0')) d = '967' + d.slice(1);
    if (!d.startsWith('967') && d.length === 9) d = '967' + d;
    return d;
  };

  // Quick intervention presets
  const quickInterventions = [
    { label: '⚠️ تنبيه سرعة التوصيل', text: 'نرجو من الكابتن سرعة التوجه للعميل وتسليم الطلب دون تأخير لضمان أعلى مستويات الخدمة.' },
    { label: '🛡️ تأكيد المتابعة الإدارية', text: 'إدارة سريع ون تتابع هذا الطلب مباشرة وتؤكد التزامها بحقوق العميل والكابتن.' },
    { label: '📞 تواصل هاتفي فوري', text: 'فريق العمليات يتواصل هاتفياً مع أطراف الطلب لتسهيل تسليم الشحنة بأسرع وقت.' },
    { label: '✅ تسوية واستفسار مالي', text: 'تم مراجعة الحساب وتأكيد المبلغ المطلوب، يرجى الالتزام بالقيمة المسجلة في التطبيق.' }
  ];

  return (
    <div className={`space-y-4 font-sans ${className}`} dir="rtl">
      
      {/* ── شريط بطاقات الإحصاءات الرقابية ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold">محادثات تحت الرقابة</p>
            <p className="text-2xl font-black text-blue-600 mt-0.5">{isLoading ? '...' : stats.totalChats}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Eye className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold">طلبات نشطة وميدانية</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{isLoading ? '...' : stats.activeChats}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold">إجمالي الرسائل المتبادلة</p>
            <p className="text-2xl font-black text-purple-600 mt-0.5">{isLoading ? '...' : stats.totalMessages}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <MessageSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold">محادثات بها بلاغات وتنبيهات</p>
            <p className="text-2xl font-black text-red-600 mt-0.5">{isLoading ? '...' : stats.flaggedChats}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
        </div>
      </div>

      {/* ── لوحة الرقابة والمراقبة الرئيسية (عمودين متكاملين) ── */}
      <div className="flex flex-col lg:flex-row h-[720px] w-full rounded-2xl border border-gray-300 bg-white shadow-xl overflow-hidden">
        
        {/* ── الجانب الأيمن: قائمة محادثات الطلبات المراقبة ── */}
        <div className="w-full lg:w-[390px] border-l border-gray-200 flex flex-col bg-[#fdfaf7] shrink-0">
          
          {/* ترويسة القائمة - نظام سريع ون البرتقالي المحمر */}
          <div className="p-3.5 bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-200" />
              <div>
                <h3 className="font-bold text-sm">محادثات العميل والكابتن</h3>
                <p className="text-[11px] text-orange-100">مراقبة مستمرة للمراسلات الميدانية</p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="p-1.5 hover:bg-white/15 rounded-lg text-white transition-colors"
              title="تحديث القائمة"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* البحث وتصفية الفئات */}
          <div className="p-2.5 bg-white border-b border-orange-100 space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="بحث برقم الطلب، العميل، الكابتن..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 pl-3 h-9 bg-orange-50/30 text-xs rounded-xl border-orange-200 focus:bg-white focus-visible:ring-1 focus-visible:ring-orange-500"
              />
            </div>

            {/* أزرار التصفية السريعة */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                  filterType === 'all' 
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                }`}
              >
                الكل ({conversations.length})
              </button>
              <button
                onClick={() => setFilterType('active')}
                className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                  filterType === 'active' 
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-sm' 
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                }`}
              >
                نشطة ({conversations.filter(c => c.isActive).length})
              </button>
              <button
                onClick={() => setFilterType('flagged')}
                className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterType === 'flagged' 
                    ? 'bg-red-600 text-white shadow-sm' 
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                تنبيهات ({conversations.filter(c => c.hasAlert).length})
              </button>
              <button
                onClick={() => setFilterType('completed')}
                className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                  filterType === 'completed' 
                    ? 'bg-gray-800 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                منتهية
              </button>
            </div>
          </div>

          {/* قائمة الطلبات الخاضعة للرقابة */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 bg-white">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <ShieldCheck className="h-12 w-12 text-gray-300 mb-2" />
                <p className="font-bold text-sm text-gray-600">لا توجد محادثات مطابقة</p>
                <p className="text-xs text-gray-400 mt-1">تظهر هنا محادثات الطلبات بين العميل والكابتن تلقائياً</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedOrder?.orderId === conv.orderId;
                const statusMeta = STATUS_LABELS[conv.orderStatus] || { label: conv.orderStatus, color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300' };

                return (
                  <button
                    key={conv.orderId}
                    onClick={() => setSelectedOrder(conv)}
                    className={`w-full p-3 text-right transition-all hover:bg-orange-50/40 relative ${
                      isSelected ? 'bg-orange-50/80 border-r-4 border-orange-600 shadow-sm' : 'bg-white'
                    }`}
                  >
                    {/* شريط رقم الطلب والحالة */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md font-mono">
                          #{conv.orderNumber}
                        </span>
                        {conv.hasAlert && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-pulse">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            تنبيه رقابي
                          </span>
                        )}
                        {conv.adminInterventions > 0 && (
                          <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                            تدخل إداري
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {/* أطراف المحادثة: العميل والكابتن */}
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-700 mb-2">
                      <div className="flex items-center gap-1 truncate">
                        <User className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                        <span className="truncate font-semibold">{conv.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-1 truncate">
                        <Truck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="truncate font-semibold">{conv.driver.name}</span>
                      </div>
                    </div>

                    {/* نص آخر رسالة والوقت */}
                    <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-1 min-w-0">
                        <MessageSquare className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="truncate text-[11px]">
                          <strong className="text-gray-700">{conv.lastMessage?.senderName}: </strong>
                          {conv.lastMessage?.content || 'بدء المحادثة'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 mr-1 font-mono">
                        {conv.lastMessage?.createdAt ? new Date(conv.lastMessage.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── الجانب الأيسر: شاشة تدقيق المحادثة المباشرة والتدخل الرقابي ── */}
        <div className="flex-1 flex flex-col bg-[#fffaf8] relative min-w-0">
          
          {selectedOrder ? (
            <>
              {/* شريط معلومات الطلب وأطرافه العلوي */}
              <div className="bg-white border-b border-orange-200 p-3.5 shadow-sm z-10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white flex items-center justify-center font-bold">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-gray-900">
                          مراقبة الطلب #{selectedOrder.orderNumber}
                        </h3>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          STATUS_LABELS[selectedOrder.orderStatus]?.bg || 'bg-gray-100'
                        } ${STATUS_LABELS[selectedOrder.orderStatus]?.color || 'text-gray-700'}`}>
                          {STATUS_LABELS[selectedOrder.orderStatus]?.label || selectedOrder.orderStatus}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>المتجر: {selectedOrder.storeName || 'سريع ون'}</span>
                        <span>•</span>
                        <span>الإجمالي: {selectedOrder.orderTotal} ر.ي</span>
                        {selectedOrder.deliveryAddress && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] flex items-center gap-0.5">
                              <MapPin className="h-3 w-3 text-red-500 inline" />
                              {selectedOrder.deliveryAddress}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* إجراءات سريعة للتواصل المباشر مع أطراف الطلب */}
                  <div className="flex items-center gap-1.5">
                    {selectedOrder.customer.phone && (
                      <a
                        href={`https://wa.me/${cleanPhone(selectedOrder.customer.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-lg font-bold flex items-center gap-1 shadow-sm"
                        title="واتساب العميل"
                      >
                        <User className="h-3 w-3" />
                        <span>واتساب العميل</span>
                      </a>
                    )}
                    {selectedOrder.driver.phone && (
                      <a
                        href={`https://wa.me/${cleanPhone(selectedOrder.driver.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg font-bold flex items-center gap-1 shadow-sm"
                        title="واتساب الكابتن"
                      >
                        <Truck className="h-3 w-3" />
                        <span>واتساب الكابتن</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* شريط بطاقات العميل والكابتن مع أرقام الهواتف */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                  <div className="bg-orange-50/70 p-2 rounded-xl border border-orange-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-orange-950">العميل: {selectedOrder.customer.name}</p>
                        <p className="text-[11px] text-orange-700 font-mono">{selectedOrder.customer.phone || 'لا يوجد رقم'}</p>
                      </div>
                    </div>
                    {selectedOrder.customer.phone && (
                      <div className="flex items-center gap-1">
                        <a href={`tel:${selectedOrder.customer.phone}`} className="p-1.5 hover:bg-orange-200 text-orange-800 rounded-lg">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={() => copyText(selectedOrder.customer.phone, 'رقم العميل')} className="p-1.5 hover:bg-orange-200 text-orange-800 rounded-lg">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-950">الكابتن: {selectedOrder.driver.name}</p>
                        <p className="text-[11px] text-amber-700 font-mono">{selectedOrder.driver.phone || 'لا يوجد رقم'}</p>
                      </div>
                    </div>
                    {selectedOrder.driver.phone && (
                      <div className="flex items-center gap-1">
                        <a href={`tel:${selectedOrder.driver.phone}`} className="p-1.5 hover:bg-amber-200 text-amber-800 rounded-lg">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={() => copyText(selectedOrder.driver.phone, 'رقم الكابتن')} className="p-1.5 hover:bg-amber-200 text-amber-800 rounded-lg">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* تنبيه بالكلمات الحساسة إن وجدت */}
                {selectedOrder.hasAlert && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="font-bold">تنبيه الرقابة الآلية:</span>
                    <span>تم رصد كلمات تستوجب التدخل (تأخير، شكوى، حساب) في هذه المحادثة. يُرجى مراجعة السياق والتوجيه عند اللزوم.</span>
                  </div>
                )}
              </div>

              {/* مجرى الرسائل المتبادلة بين العميل والكابتن وتدخلات الإدارة */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-3.5"
                style={{
                  backgroundImage: 'radial-gradient(#fed7aa 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                  backgroundColor: '#fffaf8'
                }}
              >
                <div className="flex justify-center">
                  <span className="bg-white/95 shadow-xs border border-orange-200 text-orange-800 text-[11px] font-bold px-3 py-1 rounded-full">
                    سجل المراسلات المباشرة تحت إشراف الإدارة (طلب #{selectedOrder.orderNumber})
                  </span>
                </div>

                {selectedOrder.messages.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p className="font-bold text-sm">لا توجد رسائل متبادلة حتى الآن في هذا الطلب</p>
                  </div>
                ) : (
                  selectedOrder.messages.map((msg, index) => {
                    const isCustomer = msg.senderType === 'customer';
                    const isDriver = msg.senderType === 'driver';
                    const isAdmin = msg.senderType === 'admin';

                    const timeFormatted = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : '';

                    if (isAdmin) {
                      return (
                        <div key={msg.id || index} className="flex justify-center my-2">
                          <div className="max-w-[90%] bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 text-white p-3 rounded-2xl shadow-md border border-orange-300">
                            <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                              <ShieldAlert className="h-4 w-4 text-amber-200" />
                              <span>تدخل رقابي رسمي من إدارة سريع ون</span>
                            </div>
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <span className="text-[10px] text-orange-100 block text-left mt-1 font-mono">{timeFormatted}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={msg.id || index} 
                        className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
                      >
                        <div 
                          className={`max-w-[78%] p-3 rounded-2xl shadow-xs relative text-xs leading-relaxed ${
                            isCustomer 
                              ? 'bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-tr-none border border-orange-500' 
                              : 'bg-white text-gray-900 rounded-tl-none border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className={`font-bold flex items-center gap-1 ${isCustomer ? 'text-orange-100' : 'text-amber-700'}`}>
                              {isCustomer ? <User className="h-3 w-3 inline" /> : <Truck className="h-3 w-3 inline" />}
                              {isCustomer ? `العميل: ${selectedOrder.customer.name}` : `الكابتن: ${selectedOrder.driver.name}`}
                            </span>
                            <span className={`text-[10px] font-mono ${isCustomer ? 'text-orange-200' : 'text-gray-400'}`}>
                              {timeFormatted}
                            </span>
                          </div>

                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── لوحة التدخل الرقابي المباشر للإدارة ── */}
              <div className="bg-white p-3 border-t border-gray-200 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-bold text-gray-800">إرسال توجيه رقابي عاجل للطلب #{selectedOrder.orderNumber}:</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="interventionType"
                        value="notice"
                        checked={interventionType === 'notice'}
                        onChange={() => setInterventionType('notice')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>إشعار عادي</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-red-600 font-bold">
                      <input
                        type="radio"
                        name="interventionType"
                        value="warning"
                        checked={interventionType === 'warning'}
                        onChange={() => setInterventionType('warning')}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span>تحذير رقابي مشدد</span>
                    </label>
                  </div>
                </div>

                {/* قوالب التوجيه السريعة */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {quickInterventions.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInterventionText(preset.text)}
                      className="text-[11px] bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-900 px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendIntervention} className="flex items-center gap-2">
                  <Input
                    value={interventionText}
                    onChange={(e) => setInterventionText(e.target.value)}
                    placeholder="اكتب التوجيه الرقابي الذي سيظهر للعميل والكابتن في محادثة الطلب فوراً..."
                    className="flex-1 bg-slate-50 h-10 rounded-xl border-gray-300 text-xs focus:bg-white focus:border-orange-500"
                    disabled={interveneMutation.isPending}
                  />

                  <Button
                    type="submit"
                    disabled={!interventionText.trim() || interveneMutation.isPending}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/20 text-xs"
                  >
                    <Send className="h-4 w-4 rotate-180" />
                    <span>بث التوجيه</span>
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <ShieldCheck className="h-16 w-16 text-slate-300 mb-3" />
              <h3 className="font-bold text-gray-700 text-base">مركز التدقيق والرقابة المباشرة</h3>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                اختر أي طلب من القائمة اليمنى لعرض محادثة العميل والكابتن كاملة والتدخل رقابياً عند اللزوم
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
