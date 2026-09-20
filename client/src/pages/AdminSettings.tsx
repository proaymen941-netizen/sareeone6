import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Cog, Save, MessageCircle, Share2, ShieldCheck, 
  Send, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, Sparkles
} from 'lucide-react';

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: uiSettings, isLoading } = useQuery<any[]>({
    queryKey: ['/api/ui-settings'],
  });

  const [settings, setSettings] = useState({
    support_whatsapp: '',
    support_phone: '',
    share_text: '',
    share_url: '',
    enable_otp: 'true',
    otp_environment: 'production', // 'production' | 'development'
    otp_channel: 'whatsapp', // 'whatsapp' | 'sms' | 'both' | 'demo' | 'disabled'
    otp_whatsapp_number: '+1 (555) 197-1367',
    whatsapp_access_token: 'EAAPVxlflzSQBSVKE5MY8KZAjUZBrelzRulJ1X1n0aYhoJTZBgnvFCiUT5RlAdtQAS5jt3FUDnZC58F9HG1NuvwTQCgAs4hdjKkcM87LBZB7QasERpP1bMUhS91In3XruhOMRwKZBV324lwaXKfimMHD5O5GPbfrQ0W1TfIM0F210fwyKMBDtA7v52SFWVsrZCyZBMaebFiJYr1iXZACR9HW5xdn2QIOMZBxxEHCSy0KZCSDUJNN4aBj7URAMdM9VZAjmVKEk59rSZB4pZBZCPXsNslwRyURppuQ',
    whatsapp_phone_number_id: '1334025846455164',
    whatsapp_business_account_id: '2245913132898564',
    whatsapp_template_name: '',
    otp_sms_provider_url: '',
  });

  // حالات اختبار واتساب
  const [waTesting, setWaTesting] = useState(false);
  const [waTestResult, setWaTestResult] = useState<any>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState('777146387');
  const [sendingTestOtp, setSendingTestOtp] = useState(false);
  const [testSendResult, setTestSendResult] = useState<any>(null);

  useEffect(() => {
    if (uiSettings) {
      const newSettings = { ...settings };
      uiSettings.forEach(s => {
        if (s.key in newSettings) {
          (newSettings as any)[s.key] = s.value;
        }
      });
      setSettings(newSettings);
    }
  }, [uiSettings]);

  const updateSettingMutation = useMutation({
    mutationFn: async (data: { key: string, value: string }) => {
      const res = await apiRequest('PUT', `/api/ui-settings/${data.key}`, { value: data.value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ui-settings'] });
    },
  });

  const handleSave = async () => {
    try {
      const promises = Object.entries(settings).map(([key, value]) => 
        updateSettingMutation.mutateAsync({ key, value })
      );
      await Promise.all(promises);
      toast({
        title: "✅ تم الحفظ بنجاح",
        description: "تم تحديث إعدادات النظام وربط الواتساب بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive",
      });
    }
  };

  const handleVerifyWaToken = async () => {
    setWaTesting(true);
    setWaTestResult(null);
    try {
      const res = await fetch('/api/auth/whatsapp/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.whatsapp_access_token })
      });
      const data = await res.json();
      setWaTestResult(data);
      if (data.success) {
        toast({ title: "✅ الرمز سليم وصالح لدى Meta!", description: `تطبيق: ${data.appName || 'WhatsApp Business'}` });
      } else {
        toast({ title: "⚠️ تنبيه في الرمز", description: data.error || 'فشل التحقق من الرمز', variant: "destructive" });
      }
    } catch (err: any) {
      setWaTestResult({ success: false, error: err.message });
      toast({ title: "خطأ", description: "تعذر الاتصال بخادم Meta", variant: "destructive" });
    } finally {
      setWaTesting(false);
    }
  };

  const handleSendTestOtp = async () => {
    setSendingTestOtp(true);
    setTestSendResult(null);
    try {
      const res = await fetch('/api/auth/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneNumber })
      });
      const data = await res.json();
      setTestSendResult(data);
      if (data.deliveryMethod === 'meta_cloud_api') {
        toast({ title: "🚀 تم الإرسال السحابي بنجاح!", description: data.message });
      } else {
        toast({ title: "📱 تجهيز الرابط المباشر", description: data.message });
      }
    } catch (err: any) {
      setTestSendResult({ success: false, error: err.message });
      toast({ title: "خطأ", description: "فشل إرسال التجربة", variant: "destructive" });
    } finally {
      setSendingTestOtp(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground font-bold">جاري تحميل الإعدادات...</div>;

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* بطاقة التحكم الرئيسية في الواتساب ورموز OTP */}
      <Card className="border-emerald-200 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-emerald-950 flex items-center gap-2">
                  ربط وتكامل واتساب الرسمي (Meta WhatsApp Cloud API)
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">مباشر ومفعّل</Badge>
                </CardTitle>
                <CardDescription className="text-emerald-800 text-sm font-medium">
                  إدارة إرسال رموز التحقق OTP عند إنشاء الحساب ونسيان كلمة المرور واستعادة الحسابات
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2" disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4" />
              {updateSettingMutation.isPending ? 'جاري الحفظ...' : 'حفظ بيانات الربط'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          
          {/* بيئة العمل: إنتاج حقيقي أم تطوير واختبار */}
          <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-amber-700" />
                <h4 className="font-black text-amber-950 text-base">وضع وبيئة تشغيل رموز التحقق (OTP):</h4>
              </div>
              <Badge variant={settings.otp_environment === 'production' ? 'default' : 'secondary'} className={settings.otp_environment === 'production' ? 'bg-green-600 text-white text-xs px-3 py-1 font-bold' : 'bg-amber-600 text-white text-xs px-3 py-1 font-bold'}>
                {settings.otp_environment === 'production' ? '🟢 وضع الإنتاج الحقيقي (Production)' : '🧪 وضع التطوير والاختبار (Development)'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div 
                onClick={() => setSettings(prev => ({ ...prev, otp_environment: 'production' }))}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${settings.otp_environment === 'production' ? 'border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-500/20' : 'border-slate-200 bg-slate-50/50 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-black text-emerald-900">
                  <CheckCircle2 className={`w-5 h-5 ${settings.otp_environment === 'production' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  🟢 وضع الإنتاج والتشغيل الفعلي (Production)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  يتم إرسال كود OTP الفعلي تلقائياً عبر Meta WhatsApp Cloud API إلى واتساب المستخدم، ويتم إخفاء الرمز من الشاشة لضمان الحماية والخصوصية التامة.
                </p>
              </div>

              <div 
                onClick={() => setSettings(prev => ({ ...prev, otp_environment: 'development' }))}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${settings.otp_environment === 'development' ? 'border-amber-500 bg-white shadow-sm ring-2 ring-amber-500/20' : 'border-slate-200 bg-slate-50/50 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-black text-amber-900">
                  <Sparkles className={`w-5 h-5 ${settings.otp_environment === 'development' ? 'text-amber-600' : 'text-slate-400'}`} />
                  🧪 وضع التطوير والاختبار (Development & Testing)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  يتم إرسال الرمز للواتساب وأيضاً يظهر في واجهة المستخدم لتسهيل عملية الاختبار السريع دون استهلاك رصيد رسائل Meta.
                </p>
              </div>
            </div>
          </div>

          {/* بيانات الربط مع Meta Cloud API */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/60 p-5 rounded-2xl border">
            
            {/* رمز الوصول Meta Access Token */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="whatsapp_access_token" className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  رمز الوصول لواتساب السحابي (Meta Access Token):
                </Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleVerifyWaToken} 
                  disabled={waTesting}
                  className="h-8 text-xs font-bold gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${waTesting ? 'animate-spin' : ''}`} />
                  فحص صلاحية الرمز لدى Meta
                </Button>
              </div>
              <textarea 
                id="whatsapp_access_token" 
                rows={3}
                value={settings.whatsapp_access_token}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_access_token: e.target.value }))}
                placeholder="EAAP..."
                className="w-full p-3 text-xs font-mono rounded-xl border border-input bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500">رمز وصول Meta Graph API الممنوح بصلاحيات whatsapp_business_messaging للربط المباشر.</p>
              
              {waTestResult && (
                <div className={`p-3 rounded-xl text-xs font-bold border ${waTestResult.success ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'}`}>
                  {waTestResult.success ? (
                    <div>✅ الرمز سليم ومتصل بنجاح! التطبيق: {waTestResult.appName || 'saree'} | الصلاحيات: {waTestResult.scopes?.join(', ') || 'واتساب'}</div>
                  ) : (
                    <div>❌ خطأ في الرمز: {waTestResult.error || 'غير صالح'}</div>
                  )}
                </div>
              )}
            </div>

            {/* معرّف رقم الهاتف السحابي */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp_phone_number_id" className="font-bold text-sm text-slate-900">
                معرّف رقم الهاتف السحابي (Phone Number ID):
              </Label>
              <Input 
                id="whatsapp_phone_number_id" 
                value={settings.whatsapp_phone_number_id}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_phone_number_id: e.target.value }))}
                placeholder="1334025846455164"
                className="font-mono bg-white font-bold text-sm h-11"
              />
              <p className="text-xs text-slate-500">Phone Number ID المعين لرقم الواتساب داخل لوحة مطوري Meta.</p>
            </div>

            {/* معرّف حساب واتساب للأعمال WABA ID */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp_business_account_id" className="font-bold text-sm text-slate-900">
                معرّف حساب واتساب للأعمال (WhatsApp Business Account ID):
              </Label>
              <Input 
                id="whatsapp_business_account_id" 
                value={settings.whatsapp_business_account_id}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_business_account_id: e.target.value }))}
                placeholder="2245913132898564"
                className="font-mono bg-white font-bold text-sm h-11"
              />
              <p className="text-xs text-slate-500">معرّف حساب واتساب للأعمال WABA ID في حساب Meta Business.</p>
            </div>

            {/* رقم مرسل الواتساب */}
            <div className="space-y-2">
              <Label htmlFor="otp_whatsapp_number" className="font-bold text-sm text-slate-900">
                رقم هاتف المرسل (Sender Phone Number):
              </Label>
              <Input 
                id="otp_whatsapp_number" 
                value={settings.otp_whatsapp_number}
                onChange={(e) => setSettings(prev => ({ ...prev, otp_whatsapp_number: e.target.value }))}
                placeholder="+1 (555) 197-1367"
                className="font-mono bg-white font-bold text-sm h-11 dir-ltr text-right"
              />
              <p className="text-xs text-slate-500">الرقم المعتمد لإرسال الرسائل والتواصل مع العملاء.</p>
            </div>

            {/* اسم قالب Meta (اختياري) */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp_template_name" className="font-bold text-sm text-slate-900">
                اسم قالب الرسالة المعتمد في Meta (اختياري):
              </Label>
              <Input 
                id="whatsapp_template_name" 
                value={settings.whatsapp_template_name}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_template_name: e.target.value }))}
                placeholder="اتركه فارغاً للإرسال المباشر أو اسم القالب مثل hello_world"
                className="bg-white text-sm h-11"
              />
              <p className="text-xs text-slate-500">إذا كان لديك قالب معتمد في Meta Business Manager، يمكنك كتابة اسمه هنا.</p>
            </div>

            {/* قناة الإرسال */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="otp_channel" className="font-bold text-sm text-slate-900">
                القناة المعتمدة لإرسال رموز التحقق:
              </Label>
              <select
                id="otp_channel"
                value={settings.otp_channel || 'whatsapp'}
                onChange={(e) => setSettings(prev => ({ ...prev, otp_channel: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="whatsapp">📱 واتساب سحابي مباشر (Meta WhatsApp Cloud API / Direct Smart Link)</option>
                <option value="both">🔄 واتساب ورسائل SMS معاً</option>
                <option value="sms">💬 رسالة نصية قصيرة (SMS Gateway)</option>
                <option value="demo">🧪 وضع التجربة التلقائية فقط</option>
                <option value="disabled">🚫 تعطيل التحقق بالرمز (إنشاء وتخطي مباشر)</option>
              </select>
            </div>
          </div>

          {/* قسم إرسال رسالة تجريبية حية */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 space-y-3">
            <h4 className="font-black text-emerald-950 text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              إرسال رسالة تحقق تجريبية فورية (Live Test)
            </h4>
            <p className="text-xs text-slate-600">
              أدخل أي رقم هاتف للتأكد من وصول رسالة الواتساب وتجربة الاتصال مباشرة:
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Input 
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                placeholder="777123456 أو 967777123456"
                className="w-64 bg-white font-mono font-bold h-11"
              />
              <Button 
                type="button" 
                onClick={handleSendTestOtp} 
                disabled={sendingTestOtp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-5"
              >
                <Send className={`w-4 h-4 ml-2 ${sendingTestOtp ? 'animate-spin' : ''}`} />
                {sendingTestOtp ? 'جاري الإرسال...' : 'إرسال رسالة التجربة الآن'}
              </Button>
            </div>

            {testSendResult && (
              <div className={`p-4 rounded-xl text-xs font-bold border mt-3 ${testSendResult.deliveryMethod === 'meta_cloud_api' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-blue-50 text-blue-900 border-blue-200'}`}>
                <p className="text-sm mb-1">{testSendResult.message}</p>
                <p className="font-mono text-slate-700">الرمز التجريبي المرسل: <span className="font-black text-emerald-700">{testSendResult.code}</span></p>
                {testSendResult.messageId && (
                  <p className="font-mono text-slate-600 mt-1">معرّف الرسالة من Meta: {testSendResult.messageId}</p>
                )}
                {testSendResult.whatsappUrl && (
                  <a href={testSendResult.whatsappUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-emerald-800 underline font-black">
                    🔗 فتح الرابط المباشر للرسالة في الواتساب
                  </a>
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* بطاقة روابط الدعم والمشاركة العامة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cog className="h-5 w-5 text-slate-600" />
            روابط الدعم الفني والمشاركة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-bold">إعدادات الدعم للعملاء</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_whatsapp">رابط واتساب الدعم الفني</Label>
                <Input 
                  id="support_whatsapp" 
                  value={settings.support_whatsapp}
                  onChange={(e) => setSettings(prev => ({ ...prev, support_whatsapp: e.target.value }))}
                  placeholder="https://wa.me/967777777777"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_phone">رقم هاتف الاتصال المباشر</Label>
                <Input 
                  id="support_phone" 
                  value={settings.support_phone}
                  onChange={(e) => setSettings(prev => ({ ...prev, support_phone: e.target.value }))}
                  placeholder="tel:+967777777777"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold">إعدادات مشاركة التطبيق</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="share_text">نص المشاركة الترويجي</Label>
                <Input 
                  id="share_text" 
                  value={settings.share_text}
                  onChange={(e) => setSettings(prev => ({ ...prev, share_text: e.target.value }))}
                  placeholder="تسوق عبر تطبيق السريع ون واستمتع بأسرع توصيل..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="share_url">رابط تنزيل التطبيق</Label>
                <Input 
                  id="share_url" 
                  value={settings.share_url}
                  onChange={(e) => setSettings(prev => ({ ...prev, share_url: e.target.value }))}
                  placeholder="https://saree.app"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button onClick={handleSave} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4" />
              {updateSettingMutation.isPending ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

