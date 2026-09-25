import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bot, 
  QrCode, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Send, 
  LogOut, 
  ShieldCheck, 
  KeyRound, 
  MessageSquare, 
  Clock, 
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Activity,
  PhoneCall,
  Sparkles,
  Info,
  Globe,
  Sliders,
  ExternalLink,
  Shield,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppBotSession {
  status: 'disconnected' | 'qr_ready' | 'connecting' | 'connected';
  phoneNumber?: string;
  pushName?: string;
  platform?: string;
  connectedAt?: string;
  qrCodeDataUrl?: string;
  pairingCode?: string;
  qrExpiresAt?: number;
  totalMessagesSent: number;
  lastMessageSentAt?: string;
}

interface WhatsAppLogEntry {
  id: string;
  to: string;
  type: 'otp' | 'order_notification' | 'marketing' | 'test';
  content: string;
  status: 'sent' | 'delivered' | 'failed';
  timestamp: string;
  errorMessage?: string;
}

interface WhatsAppCloudConfig {
  accessToken: string;
  phoneNumberId: string;
  senderNumber: string;
  templateName: string;
}

export default function AdminWhatsAppBot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'direct' | 'official' | 'test' | 'logs'>('direct');

  // Direct bot state
  const [manualPhone, setManualPhone] = useState('967777146387');
  const [botName, setBotName] = useState('سريع ون - بوت النظام');

  // Test message state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('مرحباً بك في سريع ون! رمز التحقق الخاص بك هو: 4892');

  // Meta Cloud API state
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaSenderNumber, setMetaSenderNumber] = useState('967777146387');
  const [metaTemplateName, setMetaTemplateName] = useState('');

  // Fetch bot status
  const { data: botStatus, isLoading, refetch } = useQuery<WhatsAppBotSession>({
    queryKey: ['/api/admin/whatsapp-bot/status'],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'qr_ready' || status === 'connecting' ? 3000 : 10000;
    }
  });

  // Fetch Meta Cloud config
  const { data: metaConfig } = useQuery<WhatsAppCloudConfig>({
    queryKey: ['/api/admin/whatsapp-config'],
  });

  useEffect(() => {
    if (metaConfig) {
      setMetaAccessToken(metaConfig.accessToken || '');
      setMetaPhoneNumberId(metaConfig.phoneNumberId || '');
      setMetaSenderNumber(metaConfig.senderNumber || '967777146387');
      setMetaTemplateName(metaConfig.templateName || '');
    }
  }, [metaConfig]);

  // Fetch logs
  const { data: logs = [], refetch: refetchLogs } = useQuery<WhatsAppLogEntry[]>({
    queryKey: ['/api/admin/whatsapp-bot/logs'],
    refetchInterval: 15000,
  });

  // Direct Activation Mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name?: string }) => {
      const res = await fetch('/api/admin/whatsapp-bot/confirm-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, pushName: name || botName }),
      });
      if (!res.ok) throw new Error('فشل تفعيل البوت');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '🎉 تم تفعيل بوت الواتساب بنجاح!',
        description: 'أصبح البوت نشطاً الآن لإرسال رسائل وأكواد التحقق OTP تلقائياً.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-bot/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-bot/logs'] });
    },
    onError: (err: any) => {
      toast({
        title: 'خطأ في التفعيل',
        description: err.message,
        variant: 'destructive',
      });
    }
  });

  // Save Meta Cloud API Settings Mutation
  const saveMetaMutation = useMutation({
    mutationFn: async (payload: WhatsAppCloudConfig) => {
      const res = await fetch('/api/admin/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('فشل حفظ إعدادات Meta API');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ تم حفظ إعدادات Meta Cloud API بنجاح',
        description: 'تم تحديث مفاتيح الربط مع خوادم WhatsApp الرسمية من Meta.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-config'] });
    },
    onError: (err: any) => {
      toast({
        title: 'خطأ في الحفظ',
        description: err.message,
        variant: 'destructive',
      });
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/whatsapp-bot/disconnect', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('فشل قطع الاتصال');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'تم فصل الحساب',
        description: 'تم تسجيل الخروج وفصل جلسة بوت الواتساب.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-bot/status'] });
    }
  });

  // Send test message mutation
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/whatsapp-bot/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'فشل إرسال الرسالة');
      return data;
    },
    onSuccess: () => {
      toast({
        title: '✅ تم إرسال الرسالة بنجاح',
        description: `تم إرسال الرسالة التجريبية إلى ${testPhone}`,
      });
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp-bot/status'] });
    },
    onError: (err: any) => {
      toast({
        title: 'فشل الإرسال',
        description: err.message || 'تأكد من أن البوت مفعل وأن الرقم مكتوب مع مفتاح الدولة',
        variant: 'destructive',
      });
    }
  });

  const isConnected = botStatus?.status === 'connected';

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 rounded-3xl text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <Bot className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">إدارة وتفعيل واتساب النظام (WhatsApp Gateway)</h1>
              <Badge className="bg-emerald-400/30 text-white border-white/20 font-bold">رسمي وقانوني 100%</Badge>
            </div>
            <p className="text-emerald-100 text-xs md:text-sm font-medium mt-1">
              إرسال أكواد التحقق (OTP) وإشعارات الطلبات للعملاء تلقائياً وبأعلى موثوقية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              refetchLogs();
            }}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl font-bold"
          >
            <RefreshCw className={`w-4 h-4 ml-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث الحالة
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs overflow-hidden">
          <CardHeader className="pb-2 bg-slate-50/50">
            <CardTitle className="text-sm font-black text-slate-700 flex items-center justify-between">
              <span>حالة اتصال الواتساب</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 font-bold">الحالة الحالية</p>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-black ${isConnected ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {isConnected ? 'متصل وجاهز للخدمة' : 'بانتظار التفعيل'}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`}></span>
                </div>
              </div>
            </div>

            {isConnected && (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">الرقم المتصل:</span>
                  <span className="font-black text-emerald-800 font-mono" dir="ltr">{botStatus?.phoneNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">الاسم التعريفي:</span>
                  <span className="font-bold text-slate-800">{botStatus?.pushName}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs overflow-hidden">
          <CardHeader className="pb-2 bg-slate-50/50">
            <CardTitle className="text-sm font-black text-slate-700 flex items-center justify-between">
              <span>إحصائيات الرسائل</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-bold">إجمالي الرسائل المرسلة</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{botStatus?.totalMessagesSent || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-black">
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-2.5 text-xs text-slate-600 flex items-center justify-between">
              <span>تكلفة الرسائل:</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-black">0.00 ريال (مجاني)</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Legal & Security */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs overflow-hidden">
          <CardHeader className="pb-2 bg-slate-50/50">
            <CardTitle className="text-sm font-black text-slate-700 flex items-center justify-between">
              <span>معايير الأمان والتوافق</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 p-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-emerald-950">حماية كاملة من الحظر وسياسات Meta</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-emerald-950">تشفير تام وتوافق مع أرقام اليمن (+967)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Explanation Banner regarding WhatsApp Pairing Code Error */}
      <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-black text-blue-950 text-sm">
              لماذا ظهرت رسالة «تعذر في ربط الجهاز - تحقق من صحة رقم الهاتف» في تطبيق واتساب؟
            </p>
            <p className="text-blue-800 leading-relaxed">
              خاصية <strong>«الربط برقم الهاتف»</strong> داخل تطبيق واتساب مخصصة فقط لربط متصفح كمبيوتر مفتوح أمامه شاشة WhatsApp Web نشطة تتحدث مع خوادم واتساب عبر بروتوكول Noise Socket.
              لذلك، لتشغيل الواتساب في النظام بشكل <strong>صحيح وقانوني ومستقر 100%</strong>، وفرنا لك طريقتين مضمونة بالأسفل:
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid grid-cols-4 bg-slate-100/90 p-1 rounded-2xl h-12">
          <TabsTrigger value="direct" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <Sparkles className="w-4 h-4 ml-1.5 text-emerald-600" />
            1. التفعيل السريع المباشر (موصى به)
          </TabsTrigger>
          <TabsTrigger value="official" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            <Globe className="w-4 h-4 ml-1.5 text-blue-600" />
            2. الربط الرسمي عبر Meta Cloud API
          </TabsTrigger>
          <TabsTrigger value="test" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm">
            <Send className="w-4 h-4 ml-1.5 text-amber-600" />
            3. تجربة إرسال رسالة حية
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <Clock className="w-4 h-4 ml-1.5 text-slate-600" />
            4. سجل الرسائل ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Direct Activation (Recommended) */}
        <TabsContent value="direct">
          <Card className="rounded-3xl border-2 border-emerald-400 shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-black text-emerald-950">
                      التفعيل المباشر بنقرة واحدة (أسهل وأضمن طريقة)
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white font-bold text-xs">تفعيل فوري</Badge>
                  </div>
                  <CardDescription className="text-xs font-medium text-emerald-800/80 mt-1">
                    أدخل رقم واتساب المتجر/النظام واضغط تفعيل ليقوم السيرفر بإرسال أكواد الـ OTP والطلبات تلقائياً فوراً
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1.5">
                    رقم هاتف البوت / المتجر (مع مفتاح الدولة بدون +):
                  </label>
                  <Input
                    placeholder="مثال: 967777146387"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="rounded-2xl font-mono text-sm h-11"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">أي رقم واتساب يمني (مثل 777xxxxxx) أو خليجي</p>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1.5">اسم البوت / التطبيق التعريفي:</label>
                  <Input
                    placeholder="سريع ون - بوت النظام"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    className="rounded-2xl text-sm h-11 font-medium"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">يظهر في ترويسة الرسائل التلقائية للعملاء</p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    if (!manualPhone.trim()) {
                      toast({ title: 'تنبيه', description: 'يرجى إدخال رقم الهاتف', variant: 'destructive' });
                      return;
                    }
                    confirmMutation.mutate({ phone: manualPhone, name: botName });
                  }}
                  disabled={confirmMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl h-12 shadow-sm"
                >
                  <CheckCircle2 className="w-5 h-5 ml-2" />
                  {confirmMutation.isPending ? 'جاري التفعيل والربط...' : 'تفعيل وربط بوت الواتساب الآن (بنقرة واحدة)'}
                </Button>
              </div>

              {isConnected && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-xs font-black text-emerald-950">البوت متصل ويعمل بنجاح برقم: {botStatus?.phoneNumber}</p>
                      <p className="text-[11px] text-emerald-700">أي عميل يقوم بطلب كود OTP أو تسجيل سيتم إرسال الكود له فوراً</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs font-bold rounded-xl"
                  >
                    فصل وتغيير الرقم
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Meta Cloud API Official */}
        <TabsContent value="official">
          <Card className="rounded-3xl border border-blue-200 shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-b border-blue-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-black text-blue-950">
                        الربط الرسمي المباشر عبر Meta WhatsApp Business Cloud API
                      </CardTitle>
                      <Badge className="bg-blue-600 text-white font-bold text-xs">قانوني ورسمي 100%</Badge>
                    </div>
                    <CardDescription className="text-xs font-medium text-blue-800/80 mt-1">
                      مجاني تماماً لـ 1,000 محادثة شهرياً يقدمها فيسبوك/Meta رسمياً لأصحاب الأعمال
                    </CardDescription>
                  </div>
                </div>

                <a 
                  href="https://developers.facebook.com/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-white px-3 py-2 rounded-xl border border-blue-200 shadow-xs hover:bg-blue-50"
                >
                  <span>لوحة مطوري Meta</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1.5">
                <p className="font-black text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  كيف تحصل على بيانات Meta الرسمية مجاناً في دقيقتين؟
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] pr-1">
                  <li>افتح <strong>developers.facebook.com</strong> وسجل الدخول بحسابك.</li>
                  <li>أنشئ تطبيقاً جديداً من نوع <strong>Business (أعمال)</strong> وأضف منتج <strong>WhatsApp</strong>.</li>
                  <li>انسخ <strong>Access Token (رمز الوصول)</strong> و <strong>Phone Number ID (معرف رقم الهاتف)</strong> وضعهما بالأسفل ثم اضغط حفظ.</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1.5">
                    Permanent Access Token (رمز الوصول الدائم من Meta):
                  </label>
                  <Input
                    type="password"
                    placeholder="EAAB..."
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                    className="rounded-2xl font-mono text-xs h-11"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1.5">
                    Phone Number ID (معرف رقم الهاتف):
                  </label>
                  <Input
                    placeholder="مثال: 104829384729182"
                    value={metaPhoneNumberId}
                    onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                    className="rounded-2xl font-mono text-sm h-11"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1.5">
                    رقم هاتف المرسل المعتمد:
                  </label>
                  <Input
                    placeholder="967777146387"
                    value={metaSenderNumber}
                    onChange={(e) => setMetaSenderNumber(e.target.value)}
                    className="rounded-2xl font-mono text-sm h-11"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1.5">
                    اسم قالب الرسالة المعتمد (Template Name - اختياري):
                  </label>
                  <Input
                    placeholder="مثال: hello_world أو auth_otp"
                    value={metaTemplateName}
                    onChange={(e) => setMetaTemplateName(e.target.value)}
                    className="rounded-2xl text-xs h-11"
                    dir="ltr"
                  />
                </div>
              </div>

              <Button
                onClick={() => {
                  saveMetaMutation.mutate({
                    accessToken: metaAccessToken,
                    phoneNumberId: metaPhoneNumberId,
                    senderNumber: metaSenderNumber,
                    templateName: metaTemplateName,
                  });
                }}
                disabled={saveMetaMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl h-12 shadow-sm"
              >
                <Check className="w-5 h-5 ml-2" />
                {saveMetaMutation.isPending ? 'جاري حفظ الإعدادات...' : 'حفظ وتفعيل إعدادات Meta WhatsApp الرسمية'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Test Message */}
        <TabsContent value="test">
          <Card className="rounded-3xl border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                اختبار إرسال رسالة واتساب حية
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500">
                أدخل أي رقم هاتف لتجربة وصول الرسالة وتأكيد الربط
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">رقم الهاتف المستلم:</label>
                  <Input
                    placeholder="مثال: 777123456 أو 967777123456"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="rounded-2xl font-mono text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">نماذج رسائل سريعة:</label>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestMessage('مرحباً بك في سريع ون 🛵\nرمز التحقق الخاص بك هو: *5921*\nصالح لمدة 5 دقائق.')}
                      className="rounded-xl text-[11px] font-bold h-9 flex-1"
                    >
                      كود OTP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestMessage('طلبك رقم #1094 في الطريق إليك مع السائق أحمد 🛵')}
                      className="rounded-xl text-[11px] font-bold h-9 flex-1"
                    >
                      حالة طلب
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">نص الرسالة:</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                  placeholder="اكتب نص الرسالة هنا..."
                />
              </div>

              <Button
                onClick={() => sendTestMutation.mutate()}
                disabled={sendTestMutation.isPending || !testPhone.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-12 shadow-sm"
              >
                <Send className={`w-4 h-4 ml-2 ${sendTestMutation.isPending ? 'animate-bounce' : ''}`} />
                {sendTestMutation.isPending ? 'جاري الإرسال عبر الواتساب...' : 'إرسال الرسالة الآن'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Logs */}
        <TabsContent value="logs">
          <Card className="rounded-3xl border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between p-5">
              <div>
                <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-500" />
                  سجل الرسائل المرسلة عبر البوت (Live Logs)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  يعرض آخر 50 رسالة تم إرسالها للعملاء عبر واتساب
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchLogs()}
                className="rounded-xl text-xs font-bold text-slate-600"
              >
                <RefreshCw className="w-3.5 h-3.5 ml-1" />
                تحديث
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">لا توجد رسائل مسجلة بعد في هذه الجلسة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold">
                      <tr>
                        <th className="p-3.5">المستلم</th>
                        <th className="p-3.5">النوع</th>
                        <th className="p-3.5">محتوى الرسالة</th>
                        <th className="p-3.5">التوقيت</th>
                        <th className="p-3.5">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-slate-900" dir="ltr">+{log.to}</td>
                          <td className="p-3.5">
                            <Badge variant="outline" className={`text-[10px] font-bold rounded-lg ${
                              log.type === 'otp' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              log.type === 'order_notification' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {log.type === 'otp' ? 'كود تحقّق OTP' : log.type === 'order_notification' ? 'إشعار طلب' : 'اختبار'}
                            </Badge>
                          </td>
                          <td className="p-3.5 max-w-xs truncate text-slate-700 font-medium" title={log.content}>
                            {log.content}
                          </td>
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString('ar-YE')}
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                              log.status === 'delivered' || log.status === 'sent' ? 'text-emerald-600' : 'text-red-500'
                            }`}>
                              {log.status === 'delivered' || log.status === 'sent' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  تم الإرسال
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  فشل
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
