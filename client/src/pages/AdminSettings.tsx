import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Cog, Save, MessageCircle, Share2, PhoneCall, ShieldCheck, Smartphone, Send } from 'lucide-react';

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
    otp_channel: 'whatsapp', // 'whatsapp' | 'sms' | 'both' | 'demo'
    otp_whatsapp_number: '',
    otp_sms_provider_url: '',
  });

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
        title: "تم الحفظ",
        description: "تم تحديث إعدادات النظام بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            إعدادات الروابط والدعم (السريع ون)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-bold">إعدادات الدعم</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_whatsapp">رابط واتساب (https://wa.me/...)</Label>
                <Input 
                  id="support_whatsapp" 
                  value={settings.support_whatsapp}
                  onChange={(e) => setSettings(prev => ({ ...prev, support_whatsapp: e.target.value }))}
                  placeholder="https://wa.me/967777777777"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_phone">رقم الهاتف (tel:+967...)</Label>
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
                <h3 className="font-bold">إعدادات المشاركة</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="share_text">نص المشاركة</Label>
                <Input 
                  id="share_text" 
                  value={settings.share_text}
                  onChange={(e) => setSettings(prev => ({ ...prev, share_text: e.target.value }))}
                  placeholder="تسوق أفضل الفواكه والخضروات..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="share_url">رابط التطبيق</Label>
                <Input 
                  id="share_url" 
                  value={settings.share_url}
                  onChange={(e) => setSettings(prev => ({ ...prev, share_url: e.target.value }))}
                  placeholder="https://tamtom.app"
                />
              </div>
            </div>
          </div>

          {/* قسم إعدادات التوصيل ورمز OTP (واتساب / SMS) */}
          <div className="pt-6 border-t space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="font-bold text-lg">إعدادات توجيه رمـز التحقـق (OTP) عند إنشاء الحساب</h3>
                <p className="text-xs text-muted-foreground">تحديد الوسيلة المستخدمة لإرسال كود التحقق للمستخدم (واتساب / SMS / التجريبي)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border">
              <div className="space-y-2">
                <Label htmlFor="otp_channel" className="font-bold">قناة الإرسال المفضلة</Label>
                <select
                  id="otp_channel"
                  value={settings.otp_channel || 'whatsapp'}
                  onChange={(e) => setSettings(prev => ({ ...prev, otp_channel: e.target.value }))}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                >
                  <option value="whatsapp">📱 واتساب (WhatsApp Direct Link / API)</option>
                  <option value="sms">💬 رسالة نصية قصيرة (SMS)</option>
                  <option value="both">🔄 كلاهما (واتساب مع زر SMS)</option>
                  <option value="demo">🧪 وضع العرض والتجربة التلقائية (مع عرض الكود بالشاشة)</option>
                </select>
                <p className="text-xs text-slate-500">اختر الوسيلة التي ستصل بها الأكواد للزبائن عند فتح حساب جديد.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp_whatsapp_number" className="font-bold">رقم مرسل الواتساب (للربط الذكي)</Label>
                <Input 
                  id="otp_whatsapp_number" 
                  value={settings.otp_whatsapp_number}
                  onChange={(e) => setSettings(prev => ({ ...prev, otp_whatsapp_number: e.target.value }))}
                  placeholder="967777777777"
                />
                <p className="text-xs text-slate-500">رقم الواتساب الخاص بإدارة التطبيق لإرسال وتوجيه الأكواد تلقائياً.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="otp_sms_provider_url" className="font-bold">رابط بوابة SMS Gateway (اختياري للربط مع شركات الاتصال اليمنية)</Label>
                <Input 
                  id="otp_sms_provider_url" 
                  value={settings.otp_sms_provider_url}
                  onChange={(e) => setSettings(prev => ({ ...prev, otp_sms_provider_url: e.target.value }))}
                  placeholder="https://api.sms-gateway-yemen.com/send?apiKey=...&to={phone}&msg={code}"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button onClick={handleSave} className="gap-2" disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4" />
              {updateSettingMutation.isPending ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
