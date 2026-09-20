import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Send, Smartphone, Users, CheckCircle, Trash2,
  History, Filter, RefreshCw, Globe, Truck, User, Info,
  Tag, AlertTriangle, ShoppingBag, CreditCard, BarChart2,
  Clock, Target, Gift, MessageSquare, Phone, Search,
  MessageCircle, Reply, ToggleLeft, ToggleRight, CheckCheck, Eye,
  Bot, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

const RECIPIENT_TYPES = [
  { 
    value: 'all', 
    label: 'جميع المستخدمين', 
    description: 'يصل للعملاء والسائقين وزوار التطبيق غير المسجلين', 
    icon: Globe, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50',
    border: 'border-blue-300'
  },
  { 
    value: 'customer', 
    label: 'العملاء', 
    description: 'إرسال لجميع العملاء أو عميل محدد بالاسم/الرقم', 
    icon: User, 
    color: 'text-green-600', 
    bg: 'bg-green-50',
    border: 'border-green-300'
  },
  { 
    value: 'driver', 
    label: 'السائقون', 
    description: 'إرسال لجميع السائقين أو سائق محدد بالاسم/الرقم', 
    icon: Truck, 
    color: 'text-orange-600', 
    bg: 'bg-orange-50',
    border: 'border-orange-300'
  },
  { 
    value: 'flutter', 
    label: 'أجهزة التطبيق', 
    description: 'بث مباشر لكافة الأجهزة النشطة والمثبتة', 
    icon: Smartphone, 
    color: 'text-purple-600', 
    bg: 'bg-purple-50',
    border: 'border-purple-300'
  },
];

const NOTIFICATION_TYPES = [
  { value: 'info', label: 'معلومات', icon: Info, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'offer', label: 'عرض خاص', icon: Tag, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'order', label: 'طلب', icon: ShoppingBag, color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'alert', label: 'تنبيه', icon: AlertTriangle, color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'system', label: 'نظام', icon: Bell, color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { value: 'payment', label: 'دفع', icon: CreditCard, color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

function getTypeLabel(type: string) {
  return NOTIFICATION_TYPES.find(t => t.value === type)?.label || type;
}
function getTypeColor(type: string) {
  return NOTIFICATION_TYPES.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-800';
}
function getRecipientLabel(rt: string) {
  return RECIPIENT_TYPES.find(r => r.value === rt)?.label || rt;
}

export default function AdminNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('send');

  // Form State
  const [form, setForm] = useState({
    title: 'إدارة السريع ون',
    message: '',
    type: 'info',
    recipientType: 'all', // 'all' | 'customer' | 'driver' | 'flutter'
    targetMode: 'all', // 'all' | 'specific'
    selectedUser: null as { id: string; name: string; phone?: string } | null,
    allowReplies: true, // ميزة الرد على الإشعار
  });

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [marketingForm, setMarketingForm] = useState({ title: '', message: '', type: 'offer', days: '7' });

  // Dialog for viewing notification replies
  const [selectedNotifForReplies, setSelectedNotifForReplies] = useState<any | null>(null);

  // Queries for all customers and drivers
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['/api/admin/marketing/customers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/marketing/customers');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allDrivers = [] } = useQuery({
    queryKey: ['/api/admin/marketing/drivers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/marketing/drivers');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['/api/admin/marketing/employees'],
    queryFn: async () => {
      const res = await fetch('/api/admin/marketing/employees');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === 'marketing',
  });

  // Inactive users query for marketing
  const { data: inactiveUsers = [], isLoading: inactiveLoading } = useQuery({
    queryKey: ['/api/admin/marketing/inactive-users', marketingForm.days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/marketing/inactive-users?days=${marketingForm.days}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === 'marketing',
  });

  // Customer replies query
  const { data: repliesData, isLoading: repliesLoading, refetch: refetchReplies } = useQuery({
    queryKey: ['/api/flutter/notifications/replies'],
    queryFn: async () => {
      const res = await fetch('/api/flutter/notifications/replies');
      if (!res.ok) return { replies: [], count: 0, unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const allReplies = repliesData?.replies ?? [];
  const unreadRepliesCount = repliesData?.unreadCount ?? 0;

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    if (!userSearchQuery.trim()) return allCustomers.slice(0, 8);
    const q = userSearchQuery.toLowerCase().trim();
    return allCustomers.filter((c: any) => 
      (c.name && c.name.toLowerCase().includes(q)) || 
      (c.phone && c.phone.includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [allCustomers, userSearchQuery]);

  // Filtered driver list for search
  const filteredDrivers = useMemo(() => {
    if (!userSearchQuery.trim()) return allDrivers.slice(0, 8);
    const q = userSearchQuery.toLowerCase().trim();
    return allDrivers.filter((d: any) => 
      (d.name && d.name.toLowerCase().includes(q)) || 
      (d.phone && d.phone.includes(q)) ||
      (d.id && d.id.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [allDrivers, userSearchQuery]);

  const [whatsappForm, setWhatsappForm] = useState({
    message: 'مرحباً {name}! لدينا رسالة إدارية أو عروض مميزة بانتظارك اليوم 🛍️',
    group: 'customers',
    scope: 'all',
  });

  const [historyFilter, setHistoryFilter] = useState({ recipientType: 'all', type: '' });

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/flutter/notifications/stats'],
    queryFn: async () => {
      const res = await fetch('/api/flutter/notifications/stats');
      if (!res.ok) throw new Error('فشل');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Device tokens
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['/api/flutter/device-tokens'],
    queryFn: async () => {
      const res = await fetch('/api/flutter/device-tokens');
      if (!res.ok) throw new Error('فشل');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // History
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['/api/flutter/notifications/history', historyFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (historyFilter.recipientType !== 'all') params.set('recipientType', historyFilter.recipientType);
      if (historyFilter.type) params.set('type', historyFilter.type);
      params.set('limit', '100');
      const res = await fetch(`/api/flutter/notifications/history?${params}`);
      if (!res.ok) throw new Error('فشل');
      return res.json();
    },
  });

  // Send Targeted Notification Mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/flutter/notifications/send-targeted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('فشل في الإرسال');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'تم إرسال الإشعار بنجاح ✅', description: data.message });
      setForm({
        title: '',
        message: '',
        type: 'info',
        recipientType: 'all',
        targetMode: 'all',
        selectedUser: null,
        allowReplies: true,
      });
      setUserSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/stats'] });
      setActiveTab('history');
    },
    onError: () => {
      toast({ title: 'خطأ في الإرسال', description: 'يرجى التحقق من المدخلات', variant: 'destructive' });
    },
  });

  // Toggle allowReplies mutation
  const toggleAllowRepliesMutation = useMutation({
    mutationFn: async ({ id, allowReplies }: { id: string; allowReplies: boolean }) => {
      const res = await fetch(`/api/flutter/notifications/${id}/allow-replies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowReplies }),
      });
      if (!res.ok) throw new Error('فشل في التعديل');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'تم تحديث ميزة الردود ✅', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/history'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'تعذر تعديل حالة الردود', variant: 'destructive' });
    }
  });

  // Delete notification
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/flutter/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم حذف الإشعار بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/replies'] });
    },
    onError: () => {
      toast({ title: 'خطأ في الحذف', variant: 'destructive' });
    },
  });

  // Delete reply mutation
  const deleteReplyMutation = useMutation({
    mutationFn: async (replyId: string) => {
      const res = await fetch(`/api/flutter/notifications/replies/${replyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم حذف الرد' });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/replies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/history'] });
    },
  });

  // Mark reply as read mutation
  // Reply to Customer Reply State
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');

  // Direct Chat State
  const [selectedChatUser, setSelectedChatUser] = useState<any>(null);
  const [adminChatMessage, setAdminChatMessage] = useState('');

  const { data: conversationsData, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/messages/admin/conversations'],
    queryFn: async () => {
      const res = await fetch('/api/messages/admin/conversations');
      if (!res.ok) return { conversations: [] };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: chatMessages = [], refetch: refetchChatMessages } = useQuery({
    queryKey: ['/api/messages/admin-chat', selectedChatUser?.userId],
    queryFn: async () => {
      if (!selectedChatUser) return [];
      const res = await fetch(`/api/messages/admin-chat?userId=${selectedChatUser.userId}&userType=${selectedChatUser.userType}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    },
    enabled: !!selectedChatUser,
    refetchInterval: 5000,
  });

  const sendAdminMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          senderId: 'admin',
          senderType: 'admin',
          receiverId: selectedChatUser.userId,
          receiverType: selectedChatUser.userType,
          orderId: null,
        }),
      });
      if (!res.ok) throw new Error('فشل الإرسال');
      return res.json();
    },
    onSuccess: () => {
      setAdminChatMessage('');
      refetchChatMessages();
    },
  });

  const sendReplyToCustomerMutation = useMutation({
    mutationFn: async (data: { notificationId: string; message: string }) => {
      const response = await fetch(`/api/flutter/notifications/${data.notificationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data.message,
          senderType: 'admin',
          senderName: 'إدارة السريع ون',
        }),
      });
      if (!response.ok) throw new Error('فشل إرسال الرد');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إرسال الرد بنجاح', className: 'bg-green-600 text-white' });
      setReplyingTo(null);
      setReplyMessage('');
      refetchReplies();
    },
    onError: () => {
      toast({ title: 'فشل إرسال الرد', variant: 'destructive' });
    },
  });

  const handleSendAdminReply = () => {
    if (!replyMessage.trim() || !replyingTo) return;
    sendReplyToCustomerMutation.mutate({
      notificationId: replyingTo.notificationId,
      message: replyMessage,
    });
  };

  const markReplyReadMutation = useMutation({
    mutationFn: async (replyId: string) => {
      const res = await fetch(`/api/flutter/notifications/replies/${replyId}/read`, { method: 'PUT' });
      if (!res.ok) throw new Error('فشل');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/replies'] });
    },
  });

  // Send marketing mass notification
  const sendMassMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/marketing/send-mass-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'تم الإرسال بنجاح ✅', description: data.message });
      setMarketingForm(f => ({ ...f, title: '', message: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/flutter/notifications/history'] });
    },
  });

  const handleSendMarketing = () => {
    if (!marketingForm.title || !marketingForm.message || inactiveUsers.length === 0) {
      toast({ title: 'خطأ', description: 'يرجى إكمال البيانات والتأكد من وجود مستهدفين', variant: 'destructive' });
      return;
    }
    sendMassMutation.mutate({
      userIds: inactiveUsers.map((u: any) => u.id),
      title: marketingForm.title,
      message: marketingForm.message,
      type: marketingForm.type
    });
  };

  const handleSend = () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: 'بيانات ناقصة', description: 'يرجى إدخال عنوان الإشعار والمحتوى', variant: 'destructive' });
      return;
    }

    if (form.targetMode === 'specific' && !form.selectedUser) {
      toast({ 
        title: 'حدد المستلم', 
        description: `يرجى اختيار ${form.recipientType === 'customer' ? 'العميل' : 'السائق'} المستهدف من القائمة`, 
        variant: 'destructive' 
      });
      return;
    }

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      type: form.type,
      recipientType: form.recipientType,
      recipientId: form.targetMode === 'specific' ? (form.selectedUser?.phone || form.selectedUser?.id) : null,
      recipientName: form.targetMode === 'specific' ? form.selectedUser?.name : null,
      allowReplies: form.allowReplies,
    };

    sendMutation.mutate(payload);
  };

  const devices = devicesData?.tokens ?? [];
  const notifs = historyData?.notifications ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-100 rounded-2xl shadow-sm">
            <Bell className="h-7 w-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">نظام وإدارة الإشعارات الذكية</h1>
            <p className="text-gray-500 text-sm">أرسل وتتبع وتفاعل مع إشعارات التطبيق والعملاء والسائقين بشكل شامل</p>
          </div>
        </div>

        {unreadRepliesCount > 0 && (
          <Button 
            variant="outline" 
            onClick={() => setActiveTab('replies')}
            className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100 gap-2 font-bold self-start"
          >
            <MessageCircle className="h-4 w-4 text-green-600 animate-pulse" />
            <span>{unreadRepliesCount} رد جديد من العملاء</span>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-green-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">إجمالي الإشعارات</p>
                <p className="text-2xl font-black text-green-600 mt-1">{statsLoading ? '...' : stats?.total ?? 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
                <Bell className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">الأجهزة المتصلة</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{statsLoading ? '...' : stats?.deviceCount ?? 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <Smartphone className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">ردود وتفاعلات العملاء</p>
                <p className="text-2xl font-black text-purple-600 mt-1">{allReplies.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">غير مقروءة</p>
                <p className="text-2xl font-black text-orange-600 mt-1">{statsLoading ? '...' : stats?.unread ?? 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 p-1 bg-gray-100 rounded-xl">
          <TabsTrigger value="send" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Send className="h-4 w-4 text-green-600" />
            إرسال إشعار
          </TabsTrigger>
          <TabsTrigger value="replies" className="gap-2 font-bold relative data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MessageCircle className="h-4 w-4 text-purple-600" />
            ردود العملاء
            {unreadRepliesCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {unreadRepliesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="direct" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Bot className="h-4 w-4 text-blue-600" />
            المراسلات المباشرة
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <History className="h-4 w-4 text-blue-600" />
            سجل الإشعارات
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Target className="h-4 w-4 text-orange-600" />
            تسويق ذكي
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Smartphone className="h-4 w-4 text-indigo-600" />
            الأجهزة
          </TabsTrigger>
        </TabsList>

        {/* ── تبويب الإرسال ── */}
        <TabsContent value="send" className="space-y-4">
          <Card className="border-2 border-gray-100 shadow-sm">
            <CardHeader className="bg-gray-50/70 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Send className="h-5 w-5 text-primary" />
                إنشاء وإرسال إشعار جديد
              </CardTitle>
              <CardDescription>
                اختر الفئة المستهدفة وحدد المستلم (جماعي أو فردي) مع التحكم في ميزة الردود
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* اختيار الفئة المستهدفة */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-gray-800">1. الفئة المستهدفة</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {RECIPIENT_TYPES.map(r => {
                    const Icon = r.icon;
                    const isSelected = form.recipientType === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ 
                            ...f, 
                            recipientType: r.value, 
                            targetMode: 'all', 
                            selectedUser: null 
                          }));
                          setUserSearchQuery('');
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-2 ${
                          isSelected 
                            ? `${r.border} ${r.bg} shadow-sm ring-2 ring-primary/20` 
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-xl bg-white shadow-xs ${r.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          {isSelected && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900">{r.label}</p>
                          <p className="text-xs text-gray-500 mt-1 leading-snug">{r.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* إذا تم اختيار العملاء أو السائقين: خيار (الكل أو محدد) */}
              {(form.recipientType === 'customer' || form.recipientType === 'driver') && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="font-bold text-sm text-gray-800">
                      نطاق الإرسال لـ {form.recipientType === 'customer' ? 'العملاء' : 'السائقين'}
                    </Label>
                    <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, targetMode: 'all', selectedUser: null }))}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          form.targetMode === 'all' 
                            ? 'bg-primary text-white shadow-xs' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {form.recipientType === 'customer' ? 'جميع العملاء' : 'جميع السائقين'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, targetMode: 'specific' }))}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          form.targetMode === 'specific' 
                            ? 'bg-primary text-white shadow-xs' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {form.recipientType === 'customer' ? 'عميل محدد بالاسم/الرقم' : 'سائق محدد بالاسم/الرقم'}
                      </button>
                    </div>
                  </div>

                  {/* في حال اختيار محدد: شريط البحث والاختيار السريع */}
                  {form.targetMode === 'specific' && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <div className="relative">
                        <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder={`ابحث عن ${form.recipientType === 'customer' ? 'العميل' : 'السائق'} بالاسم أو رقم الهاتف...`}
                          value={userSearchQuery}
                          onChange={e => setUserSearchQuery(e.target.value)}
                          className="pr-10 bg-white"
                        />
                      </div>

                      {/* بطاقة المستلم المختار */}
                      {form.selectedUser && (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                              {form.recipientType === 'customer' ? <User className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-green-900">{form.selectedUser.name || 'بدون اسم'}</p>
                              <p className="text-xs text-green-700 font-mono">{form.selectedUser.phone || 'بدون هاتف'}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-white text-green-800 border-green-300 font-bold">
                            تم التحديد ✓
                          </Badge>
                        </div>
                      )}

                      {/* قائمة النتائج السريعة */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5 bg-white p-2 rounded-xl border border-gray-200">
                        {form.recipientType === 'customer' ? (
                          filteredCustomers.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-3">لا يوجد عملاء مطابقين للبحث</p>
                          ) : (
                            filteredCustomers.map((c: any) => {
                              const isSelected = form.selectedUser?.id === c.id;
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => setForm(f => ({ ...f, selectedUser: c }))}
                                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                                    isSelected ? 'bg-primary/10 border border-primary/30 font-bold' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="text-sm text-gray-800">{c.name || 'عميل'}</span>
                                    {c.phone && <span className="text-xs text-gray-400 font-mono">({c.phone})</span>}
                                  </div>
                                  <Button size="sm" variant={isSelected ? "default" : "ghost"} className="h-7 text-xs">
                                    {isSelected ? 'محدد' : 'اختيار'}
                                  </Button>
                                </div>
                              );
                            })
                          )
                        ) : (
                          filteredDrivers.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-3">لا يوجد سائقون مطابقون للبحث</p>
                          ) : (
                            filteredDrivers.map((d: any) => {
                              const isSelected = form.selectedUser?.id === d.id;
                              return (
                                <div
                                  key={d.id}
                                  onClick={() => setForm(f => ({ ...f, selectedUser: d }))}
                                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                                    isSelected ? 'bg-primary/10 border border-primary/30 font-bold' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Truck className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="text-sm text-gray-800">{d.name || 'سائق'}</span>
                                    {d.phone && <span className="text-xs text-gray-400 font-mono">({d.phone})</span>}
                                  </div>
                                  <Button size="sm" variant={isSelected ? "default" : "ghost"} className="h-7 text-xs">
                                    {isSelected ? 'محدد' : 'اختيار'}
                                  </Button>
                                </div>
                              );
                            })
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* نوع وتصنيف الإشعار */}
              <div className="space-y-2">
                <Label className="text-sm font-bold text-gray-800">2. تصنيف الإشعار</Label>
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_TYPES.map(t => {
                    const Icon = t.icon;
                    const selected = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: t.value }))}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                          selected ? `border-primary bg-primary/10 text-primary shadow-xs` : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* العنوان والمحتوى */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-title" className="font-bold text-sm">3. عنوان الإشعار *</Label>
                    <span className="text-xs text-gray-400">{form.title.length}/100</span>
                  </div>
                  <Input
                    id="notif-title"
                    placeholder="مثال: خصم خاص 20% على طلبك القادم 🎉"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    maxLength={100}
                    className="text-right font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-message" className="font-bold text-sm">4. محتوى وتفاصيل الإشعار *</Label>
                    <span className="text-xs text-gray-400">{form.message.length}/300</span>
                  </div>
                  <Textarea
                    id="notif-message"
                    placeholder="اكتب تفاصيل الإشعار الذي سيظهر للمستلم على الشاشة..."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="text-right min-h-[110px] leading-relaxed"
                    maxLength={300}
                  />
                </div>
              </div>

              {/* ميزة السماح بالرد على الإشعار */}
              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Reply className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-purple-950">السماح للعميل بالرد على هذا الإشعار</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      عند التفعيل، سيظهر زر وحقل للعميل داخل صندوق الإشعارات في التطبيق لإرسال رد أو استفسار على هذا الإشعار مباشرة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-purple-900">
                    {form.allowReplies ? 'مفعلة' : 'معطلة'}
                  </span>
                  <Switch
                    checked={form.allowReplies}
                    onCheckedChange={(checked) => setForm(f => ({ ...f, allowReplies: checked }))}
                  />
                </div>
              </div>

              {/* معاينة الإشعار قبل الإرسال */}
              {(form.title || form.message) && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2">
                  <p className="text-xs font-bold text-gray-400">معاينة بطاقة الإشعار في التطبيق</p>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm text-gray-900">{form.title || 'عنوان الإشعار'}</p>
                        <span className="text-[10px] text-gray-400">الآن</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{form.message || 'المحتوى...'}</p>
                      
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${getTypeColor(form.type)}`}>
                          {getTypeLabel(form.type)}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-gray-50">
                          {form.targetMode === 'specific' && form.selectedUser 
                            ? `موجه إلى: ${form.selectedUser.name}`
                            : getRecipientLabel(form.recipientType)
                          }
                        </Badge>
                        {form.allowReplies ? (
                          <Badge className="text-xs bg-purple-100 text-purple-800 border-purple-200 font-bold">
                            💬 الردود مفعلة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-400">
                            الردود معطلة
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* زر الإرسال النهائي */}
              <Button
                type="button"
                onClick={handleSend}
                disabled={sendMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-12 rounded-xl text-base font-bold shadow-md shadow-green-600/20"
              >
                {sendMutation.isPending ? (
                  <><RefreshCw className="h-5 w-5 animate-spin" /> جارٍ إرسال الإشعار وبثه لجميع المستهدفين...</>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    تأكيد إرسال الإشعار إلى {
                      form.targetMode === 'specific' && form.selectedUser
                        ? `(${form.selectedUser.name})`
                        : getRecipientLabel(form.recipientType)
                    }
                  </>
                )}
              </Button>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── تبويب المراسلات المباشرة ── */}
        <TabsContent value="direct" className="space-y-4">
          <Card className="border-2 border-gray-100 shadow-sm overflow-hidden">
            <div className="flex h-[600px] flex-col md:flex-row">
              {/* قائمة المحادثات */}
              <div className="w-full md:w-80 border-l bg-gray-50 flex flex-col">
                <div className="p-4 border-b bg-white">
                  <h3 className="font-black text-gray-800 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    المحادثات المباشرة
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {(conversationsData?.conversations || []).length === 0 ? (
                    <div className="p-8 text-center opacity-40">
                      <p className="text-sm font-bold">لا توجد محادثات نشطة</p>
                    </div>
                  ) : (
                    (conversationsData?.conversations || []).map((conv: any) => (
                      <button
                        key={`${conv.userType}:${conv.userId}`}
                        onClick={() => setSelectedChatUser(conv)}
                        className={`w-full p-4 flex items-center gap-3 border-b transition-colors hover:bg-white ${
                          selectedChatUser?.userId === conv.userId ? 'bg-white border-r-4 border-primary shadow-sm' : ''
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          conv.userType === 'driver' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {conv.userType === 'driver' ? <Truck className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 text-right min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm truncate">{conv.userType === 'driver' ? 'سائق' : 'عميل'}: {conv.userId.slice(-6)}</span>
                            <span className="text-[9px] text-gray-400 shrink-0">{new Date(conv.lastMessageAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* نافذة الشات */}
              <div className="flex-1 flex flex-col bg-white">
                {selectedChatUser ? (
                  <>
                    <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedChatUser.userType === 'driver' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {selectedChatUser.userType === 'driver' ? <Truck className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </div>
                        <div className="text-right">
                          <h4 className="font-black text-sm">{selectedChatUser.userType === 'driver' ? 'سائق' : 'عميل'} (ID: {selectedChatUser.userId.slice(-6)})</h4>
                          <span className="text-[10px] text-green-600 font-bold">متصل الآن</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                      {chatMessages.map((msg: any) => {
                        const isMe = msg.senderType === 'admin';
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${
                              isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-gray-100 rounded-tl-none'
                            }`}>
                              <p className="leading-relaxed">{msg.content}</p>
                              <span className={`text-[9px] block mt-1 ${isMe ? 'text-white/60 text-left' : 'text-gray-400 text-right'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 border-t bg-gray-50/50">
                      <div className="flex gap-2">
                        <Textarea 
                          placeholder="اكتب ردك هنا..."
                          value={adminChatMessage}
                          onChange={(e) => setAdminChatMessage(e.target.value)}
                          className="min-h-[60px] resize-none rounded-xl border-gray-200 focus:border-primary"
                        />
                        <Button 
                          onClick={() => adminChatMessage.trim() && sendAdminMessageMutation.mutate(adminChatMessage)}
                          disabled={!adminChatMessage.trim() || sendAdminMessageMutation.isPending}
                          className="h-auto px-6 bg-primary hover:bg-primary/90 rounded-xl font-bold gap-2"
                        >
                          {sendAdminMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          إرسال
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-8 text-center">
                    <MessageCircle className="h-16 w-16 mb-4 text-primary" />
                    <h3 className="text-xl font-black">اختر محادثة للبدء</h3>
                    <p className="text-sm font-bold mt-2">تواصل مباشرة مع العملاء والسائقين من هنا</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ── تبويب ردود العملاء ── */}
        <TabsContent value="replies" className="space-y-4">
          <Card>
            <CardHeader className="bg-gray-50/70 border-b">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                    صندوق ردود وتفاعلات العملاء ({allReplies.length})
                  </CardTitle>
                  <CardDescription>
                    استعرض جميع الردود والاستفسارات المرسلة من العملاء عبر تطبيق الجوال
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchReplies()} className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  تحديث الردود
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {repliesLoading ? (
                <div className="text-center py-10 text-gray-400">جاري تحميل الردود...</div>
              ) : allReplies.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30 text-purple-500" />
                  <p className="font-bold text-gray-700">لا توجد ردود بعد من العملاء</p>
                  <p className="text-xs text-gray-400 mt-1">عند تفعيل ميزة الردود على أي إشعار وإرسال العميل لرده، سيظهر هنا فوراً</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allReplies.map((reply: any) => (
                    <div 
                      key={reply.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        !reply.isRead ? 'bg-purple-50/50 border-purple-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900">{reply.senderName || 'عميل'}</span>
                              {reply.senderPhone && (
                                <Badge variant="outline" className="text-xs font-mono bg-white">
                                  {reply.senderPhone}
                                </Badge>
                              )}
                              {!reply.isRead && (
                                <Badge className="text-xs bg-purple-600 text-white font-bold">
                                  رد جديد
                                </Badge>
                              )}
                            </div>

                            {/* الإشعار الأصلي */}
                            <div className="mt-1.5 p-2 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                              <span className="font-bold text-gray-700">رداً على إشعار: </span>
                              {reply.notificationTitle || 'إشعار عام'}
                            </div>

                            {/* نص الرد */}
                            <p className="text-sm text-gray-900 font-medium mt-2 bg-white p-3 rounded-xl border border-purple-100 leading-relaxed">
                              {reply.message}
                            </p>

                            <p className="text-[11px] text-gray-400 mt-2">
                              {new Date(reply.createdAt).toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setReplyingTo(reply)}
                            className="text-xs h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            الرد على العميل
                          </Button>
                          {!reply.isRead && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => markReplyReadMutation.mutate(reply.id)}
                              className="text-xs h-8 gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                              تعليم كمقروء
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteReplyMutation.mutate(reply.id)}
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── حوار الرد على العميل ── */}
        <Dialog open={!!replyingTo} onOpenChange={(open) => !open && setReplyingTo(null)}>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                الرد على العميل: {replyingTo?.senderName}
              </DialogTitle>
              <DialogDescription>
                سيتم إرسال ردك كإشعار تفاعلي للعميل على تطبيقه
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-50 rounded-xl border text-sm text-gray-600 italic">
                "{replyingTo?.message}"
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">نص الرد الإداري:</label>
                <Textarea
                  placeholder="اكتب ردك هنا..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="min-h-[120px] rounded-xl border-gray-300 focus:border-primary"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReplyingTo(null)} className="rounded-xl">إلغاء</Button>
              <Button 
                onClick={handleSendAdminReply} 
                disabled={!replyMessage.trim() || sendReplyToCustomerMutation.isPending}
                className="rounded-xl bg-primary hover:bg-primary/90"
              >
                {sendReplyToCustomerMutation.isPending ? 'جاري الإرسال...' : 'إرسال الرد الآن'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── تبويب سجل الإشعارات ── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-blue-600" />
                  سجل وتتبع الإشعارات المرسلة ({historyData?.total ?? 0})
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={historyFilter.recipientType}
                    onValueChange={v => setHistoryFilter(f => ({ ...f, recipientType: v }))}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="المستلمون" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {RECIPIENT_TYPES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={historyFilter.type || 'all_types'}
                    onValueChange={v => setHistoryFilter(f => ({ ...f, type: v === 'all_types' ? '' : v }))}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_types">كل الأنواع</SelectItem>
                      {NOTIFICATION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="icon" onClick={() => refetchHistory()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8 text-gray-400">جاري التحميل...</div>
              ) : notifs.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد إشعارات مرسلة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifs.map((n: any) => {
                    const repliesCount = n.replyCount || 0;
                    const allowReplies = n.allowReplies !== false;

                    return (
                      <div key={n.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:bg-gray-100/60 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <p className="font-bold text-sm text-gray-900">{n.title}</p>
                              <Badge variant="outline" className={`text-xs ${getTypeColor(n.type)}`}>
                                {getTypeLabel(n.type)}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-blue-700 bg-blue-50">
                                {n.recipientName ? `موجه: ${n.recipientName}` : getRecipientLabel(n.recipientType)}
                              </Badge>
                              {!n.isRead && (
                                <Badge className="text-xs bg-orange-500 text-white">غير مقروء</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2">{n.message}</p>
                            
                            <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                              <span>
                                {new Date(n.createdAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>

                              {/* زر تفعيل/تعطيل ميزة الردود */}
                              <button
                                type="button"
                                onClick={() => toggleAllowRepliesMutation.mutate({ id: n.id, allowReplies: !allowReplies })}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                                  allowReplies 
                                    ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' 
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                              >
                                {allowReplies ? <ToggleRight className="h-4 w-4 text-purple-700" /> : <ToggleLeft className="h-4 w-4" />}
                                {allowReplies ? 'ميزة الرد مفعلة للعميل (انقر للإلغاء)' : 'ميزة الرد معطلة (انقر للتفعيل)'}
                              </button>

                              {/* عداد الردود */}
                              {repliesCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedNotifForReplies(n)}
                                  className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold underline"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  عرض الردود ({repliesCount})
                                </button>
                              )}
                            </div>
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الإشعار</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من حذف هذا الإشعار وردوده المرتبطة؟</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => deleteMutation.mutate(n.id)}
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── تبويب التسويق الذكي ── */}
        <TabsContent value="marketing" className="space-y-4">
          <Card className="border-2 border-primary/10 shadow-sm">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                حملات التسويق الذكي وإعادة التنشيط
              </CardTitle>
              <CardDescription>استهدف العملاء غير النشطين أو أرسل حملات جماعية بالواتساب وSMS</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <Clock className="h-10 w-10 text-orange-500" />
                <div className="flex-1">
                  <p className="font-bold text-orange-900">تحديد فترة عدم النشاط</p>
                  <p className="text-xs text-orange-700 mt-0.5">العملاء الذين لم يطلبوا منذ أكثر من {marketingForm.days} أيام ({inactiveUsers.length} عميل)</p>
                </div>
                <Select value={marketingForm.days} onValueChange={v => setMarketingForm(f => ({ ...f, days: v }))}>
                  <SelectTrigger className="w-32 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 أيام</SelectItem>
                    <SelectItem value="7">7 أيام</SelectItem>
                    <SelectItem value="14">14 يوماً</SelectItem>
                    <SelectItem value="30">30 يوماً</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="font-bold">عنوان العرض الترويجي</Label>
                <Input 
                  placeholder="مثال: اشتقنا لك! خصم 25% على طلبك التالي"
                  value={marketingForm.title}
                  onChange={e => setMarketingForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label className="font-bold">محتوى الإشعار الترويجي</Label>
                <Textarea 
                  placeholder="اكتب رسالة العرض..."
                  value={marketingForm.message}
                  onChange={e => setMarketingForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>

              <Button 
                onClick={handleSendMarketing}
                disabled={sendMassMutation.isPending || inactiveUsers.length === 0}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2 font-bold h-11"
              >
                <Send className="h-4 w-4" />
                إرسال لـ {inactiveUsers.length} عميل غير نشط
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── تبويب الأجهزة ── */}
        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">إجمالي الأجهزة</p>
                <p className="text-3xl font-bold text-green-600">{devicesLoading ? '...' : devicesData?.count ?? 0}</p>
                <Users className="h-6 w-6 mx-auto mt-2 text-green-300" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Android</p>
                <p className="text-3xl font-bold text-gray-700">
                  {devicesLoading ? '...' : devices.filter((d: any) => d.platform === 'android').length}
                </p>
                <Smartphone className="h-6 w-6 mx-auto mt-2 text-green-300" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">iOS</p>
                <p className="text-3xl font-bold text-gray-700">
                  {devicesLoading ? '...' : devices.filter((d: any) => d.platform === 'ios').length}
                </p>
                <Smartphone className="h-6 w-6 mx-auto mt-2 text-blue-300" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                الأجهزة المسجّلة والمثبتة ({devices.length})
              </CardTitle>
              <CardDescription>قائمة بجميع أجهزة الهواتف الذكية المثبت عليها التطبيق</CardDescription>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <div className="text-center py-8 text-gray-400">جاري التحميل...</div>
              ) : devices.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد أجهزة مسجّلة بعد</p>
                  <p className="text-sm mt-1">ستظهر هنا عند تثبيت التطبيق</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رمز الجهاز</TableHead>
                      <TableHead>المنصة</TableHead>
                      <TableHead>تاريخ التسجيل</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device: any) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <span className="font-mono text-xs text-gray-500">
                            {device.token.substring(0, 25)}...
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.platform === 'ios' ? 'secondary' : 'default'}>
                            {device.platform === 'ios' ? '🍎 iOS' : '🤖 Android'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(device.createdAt).toLocaleDateString('ar-YE')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            نشط
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for viewing specific notification replies */}
      {selectedNotifForReplies && (
        <Dialog open={!!selectedNotifForReplies} onOpenChange={() => setSelectedNotifForReplies(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                ردود العملاء على: {selectedNotifForReplies.title}
              </DialogTitle>
              <DialogDescription>
                {selectedNotifForReplies.message}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-80 overflow-y-auto space-y-3 py-2">
              {allReplies.filter((r: any) => r.notificationId === selectedNotifForReplies.id).length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">لا توجد ردود على هذا الإشعار حتى الآن</p>
              ) : (
                allReplies.filter((r: any) => r.notificationId === selectedNotifForReplies.id).map((r: any) => (
                  <div key={r.id} className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-950">{r.senderName || 'عميل'} ({r.senderPhone || 'بدون هاتف'})</span>
                      <span className="text-gray-400">{new Date(r.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-gray-800 bg-white p-2.5 rounded-lg border border-purple-100">{r.message}</p>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedNotifForReplies(null)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
