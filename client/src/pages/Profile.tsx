import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, User, Phone, Mail, MapPin, Settings, Shield, Star, Clock, Receipt, MessageCircle, Share2, Loader2, AtSign, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User as UserType, UiSettings } from '@shared/schema';
import ShareAppModal from '@/components/ShareAppModal';

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { user: currentUser, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  
  useEffect(() => {
    // إذا كان المستخدم غير مسجل، نوجهه لصفحة تسجيل الدخول فوراً
    // لا نسمح للمستخدم الضيف برؤية الملف الشخصي فارغاً
    if (!authLoading && !isAuthenticated) {
      setLocation('/auth');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const userId = currentUser?.id;

  const { data: uiSettings } = useQuery<UiSettings[]>({
    queryKey: ['/api/admin/ui-settings'],
  });
  
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    username: '',
    email: '',
    address: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const fetchCurrentLocationAddress = async () => {
    if (!navigator.geolocation) {
      toast({ 
        title: language === 'ar' ? "الموقع غير مدعوم" : "Location Not Supported", 
        description: language === 'ar' ? "متصفحك لا يدعم الوصول لموقعك الجغرافي" : "Browser does not support geolocation", 
        variant: "destructive" 
      });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=${language}`,
            { headers: { 'User-Agent': 'AlSarieOne/1.0' } }
          );
          const data = await response.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            const shortAddr = parts.slice(0, 4).join('،').trim();
            setProfile(prev => ({ ...prev, address: shortAddr }));
            toast({ 
              title: language === 'ar' ? "تم تحديث العنوان النصي" : "Address Updated", 
              description: shortAddr 
            });
          } else {
            const coordsText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            setProfile(prev => ({ ...prev, address: coordsText }));
            toast({ 
              title: language === 'ar' ? "تم تحديد موقعك الإحداثي" : "Location Coordinates Found", 
              description: coordsText 
            });
          }
        } catch {
          const coordsText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setProfile(prev => ({ ...prev, address: coordsText }));
          toast({ 
            title: language === 'ar' ? "تم جلب موقعك الإحداثي" : "Coordinates Fetched", 
            description: language === 'ar' ? "يرجى تعديل التفاصيل إن لزم الأمر" : "Please adjust details if needed" 
          });
        } finally {
          setGettingLocation(false);
        }
      },
      () => {
        setGettingLocation(false);
        toast({
          title: language === 'ar' ? "تعذر الوصول للموقع" : "Location Access Denied",
          description: language === 'ar' ? "يرجى السماح بالوصول لموقعك الجغرافي في المتصفح لجلب العنوان تلقائياً" : "Please allow location access in your browser",
          variant: "destructive"
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/users', userId],
    enabled: !!userId && isAuthenticated,
    retry: false,
  });

  const { data: userOrders = [] } = useQuery({
    queryKey: ['/api/orders/customer', profile.phone],
    enabled: !!profile.phone,
    queryFn: async () => {
      const response = await fetch(`/api/orders/customer/${profile.phone}`);
      if (!response.ok) return [];
      return response.json();
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: Partial<UserType>) => {
      if (!userId) throw new Error(language === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Please login first');
      const response = await apiRequest('PUT', `/api/users/${userId}`, profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId] });
      setIsEditing(false);
      toast({
        title: language === 'ar' ? "تم حفظ البيانات" : "Profile Saved",
        description: language === 'ar' ? "تم تحديث معلومات الملف الشخصي بنجاح" : "Your profile has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ في الحفظ" : "Save Error",
        description: language === 'ar' ? "حدث خطأ أثناء تحديث البيانات. يرجى المحاولة مرة أخرى." : "An error occurred while updating profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user) {
      setProfile({
        username: (user as UserType).username || '',
        name: (user as UserType).name || '',
        phone: (user as UserType).phone || '',
        email: (user as UserType).email || '',
        address: (user as UserType).address || '',
      });
    }
  }, [user]);

  const handleSave = () => {
    updateProfileMutation.mutate({
      username: profile.username,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
    } as any);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const getSetting = (key: string, defaultValue: string = '') => {
    return uiSettings?.find(s => s.key === key)?.value || defaultValue;
  };

  const supportWhatsapp = getSetting('support_whatsapp', '');
  const supportPhone = getSetting('support_phone', '');
  const shareUrl = getSetting('share_url', '');
  const shareText = getSetting('share_text', 'السريع ون');

  const profileStats = [
    { 
      icon: Receipt, 
      label: language === 'ar' ? 'إجمالي الطلبات' : 'Total Orders', 
      value: userOrders?.length?.toString() || '0', 
      color: 'text-primary' 
    },
    { icon: Star, label: language === 'ar' ? 'التقييم' : 'Rating', value: '4.8', color: 'text-yellow-500' },
    { 
      icon: Clock, 
      label: language === 'ar' ? 'عضو منذ' : 'Member Since', 
      value: (user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString(language === 'ar' ? 'ar-YE' : 'en-US', { month: 'short', year: 'numeric' }) : (language === 'ar' ? 'جديد' : 'New'), 
      color: 'text-green-500' 
    },
  ];

  const menuItems = [
    { icon: Receipt, label: t('my_orders'), path: '/orders', description: language === 'ar' ? 'عرض تاريخ الطلبات' : 'View your order history', testId: 'profile-orders' },
    { icon: MapPin, label: t('saved_addresses'), path: '/addresses', description: language === 'ar' ? 'إدارة عناوين التوصيل' : 'Manage delivery addresses', testId: 'profile-addresses' },
    { icon: Settings, label: t('settings'), path: '/settings', description: language === 'ar' ? 'إعدادات التطبيق والحساب' : 'App & account settings', testId: 'profile-settings' },
    ...(supportWhatsapp ? [{
      icon: MessageCircle,
      label: language === 'ar' ? 'دعم واتساب' : 'WhatsApp Support',
      path: '#',
      description: language === 'ar' ? 'تواصل معنا عبر واتساب' : 'Chat with our support',
      testId: 'profile-whatsapp',
      onClick: () => { window.open(`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}`, '_blank'); }
    }] : []),
    ...(supportPhone ? [{
      icon: Phone,
      label: language === 'ar' ? 'اتصل بنا' : 'Call Us',
      path: '#',
      description: language === 'ar' ? 'اتصل برقم الدعم المباشر' : 'Direct phone support',
      testId: 'profile-call',
      onClick: () => { window.open(`tel:${supportPhone}`, '_blank'); }
    }] : []),
    {
      icon: Share2,
      label: language === 'ar' ? 'مشاركة التطبيق' : 'Share App',
      path: '#',
      description: language === 'ar' ? 'شارك التطبيق مع أصدقائك' : 'Share with friends',
      testId: 'profile-share',
      onClick: async () => {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          try {
            await navigator.share({
              title: getSetting('app_name', 'السريع ون'),
              text: shareText || (language === 'ar' ? 'تسوق من السريع ون الآن!' : 'Shop from Saree One now!'),
              url: shareUrl || window.location.origin
            });
            return;
          } catch (err: any) {
            if (err?.name === 'AbortError') return;
            console.warn('Native share failed, showing modal', err);
          }
        }
        setShareModalOpen(true);
      }
    },
    { icon: Shield, label: language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy', path: '/privacy', description: language === 'ar' ? 'سياسة الخصوصية وشروط الاستخدام' : 'Privacy terms & conditions', testId: 'profile-privacy' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col items-center mb-6 bg-white p-6 rounded-3xl border border-orange-100/80 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black text-[#FF5722]">السريع ون</span>
            <span className="text-[10px] font-black text-[#FF5722] bg-orange-50 border border-orange-200 rounded-lg px-2 py-0.5">SAREE ONE</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-1">
            {language === 'ar' ? 'الملف الشخصي وإعدادات الحساب' : 'Profile & Account Settings'}
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-3xl border border-orange-100/80 shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden bg-white">
              <CardHeader className="text-center bg-orange-50/40 pb-6 border-b border-orange-100/50">
                <div className="w-20 h-20 bg-gradient-to-tr from-[#FF5722] to-[#FF6E40] rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-orange-500/20 text-white">
                  <User className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-lg font-black text-slate-900">
                  {profile.name || (!isAuthenticated ? (language === 'ar' ? 'مستخدم ضيف' : 'Guest') : (language === 'ar' ? 'المستخدم' : 'User'))}
                </CardTitle>
                <Badge variant={!isAuthenticated ? "outline" : "secondary"} className="mx-auto mt-1 font-black text-xs bg-orange-100 text-[#FF5722] border-orange-200">
                  {!isAuthenticated ? (language === 'ar' ? 'مستخدم ضيف' : 'Guest') : (language === 'ar' ? 'عضو مميز' : 'Premium Member')}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {isEditing ? (
                  <div className="space-y-4">
                    {/* الحقل الأول: اسم العميل */}
                    <div>
                      <Label htmlFor="name" className="text-slate-800 font-black text-xs">
                        {language === 'ar' ? '1. اسم العميل' : '1. Full Name'}
                      </Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={language === 'ar' ? "أدخل اسمك الكامل" : "Enter your full name"}
                        className="mt-1 rounded-xl border-slate-200 focus:border-[#FF5722]"
                      />
                    </div>
                    {/* الحقل الثاني: رقم الهاتف */}
                    <div>
                      <Label htmlFor="phone" className="text-slate-800 font-black text-xs">
                        {language === 'ar' ? '2. رقم الهاتف' : '2. Phone Number'}
                      </Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder={language === 'ar' ? "أدخل رقم الهاتف" : "Enter phone number"}
                        dir="ltr"
                        className="mt-1 rounded-xl border-slate-200 focus:border-[#FF5722]"
                      />
                    </div>
                    {/* الحقل الثالث: اسم المستخدم */}
                    <div>
                      <Label htmlFor="username" className="text-slate-800 font-black text-xs">
                        {language === 'ar' ? '3. اسم المستخدم' : '3. Username'}
                      </Label>
                      <Input
                        id="username"
                        value={profile.username}
                        onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                        placeholder={language === 'ar' ? "أدخل اسم المستخدم" : "Enter username"}
                        className="mt-1 rounded-xl border-slate-200 focus:border-[#FF5722]"
                      />
                    </div>
                    {/* الحقل الرابع: البريد الإلكتروني (إن وجد) */}
                    <div>
                      <Label htmlFor="email" className="text-slate-800 font-black text-xs">
                        {language === 'ar' ? '4. البريد الإلكتروني (إن وجد)' : '4. Email (optional)'}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="example@mail.com"
                        className="mt-1 rounded-xl border-slate-200 focus:border-[#FF5722]"
                      />
                    </div>
                    {/* الحقل الأخير: عنوان موقع العميل النصي */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="address" className="text-slate-800 font-black text-xs">
                          {language === 'ar' ? '5. عنوان موقع العميل' : '5. Location Address'}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={fetchCurrentLocationAddress}
                          disabled={gettingLocation}
                          className="text-xs text-[#FF5722] hover:bg-orange-50 h-7 px-2 font-black rounded-lg"
                        >
                          {gettingLocation ? (
                            <><Loader2 className="h-3 w-3 animate-spin mx-1" /> {language === 'ar' ? 'جاري التحديد...' : 'Locating...'}</>
                          ) : (
                            <><MapPin className="h-3 w-3 mx-1" /> {language === 'ar' ? 'استخدام موقعي الحالي' : 'Use Current Location'}</>
                          )}
                        </Button>
                      </div>
                      <Input
                        id="address"
                        value={profile.address}
                        onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                        placeholder={language === 'ar' ? "أدخل عنوان موقعك أو انقر على استخدام موقعي الحالي" : "Enter address or fetch current location"}
                        className="rounded-xl border-slate-200 focus:border-[#FF5722]"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSave} className="flex-1 font-black rounded-xl bg-gradient-to-r from-[#FF6E40] to-[#FF5722] text-white shadow-sm shadow-orange-500/20" disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? t('loading') : t('save')}
                      </Button>
                      <Button variant="outline" className="rounded-xl font-black" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* الحقل الأول: اسم العميل */}
                    <div className="flex items-center justify-between p-3.5 bg-orange-50/40 rounded-2xl border border-orange-100/60">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-[#FF5722] shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {language === 'ar' ? '1. اسم العميل' : '1. Customer Name'}
                          </p>
                          <p className="font-black text-slate-900 text-sm">{profile.name || profile.username || (language === 'ar' ? 'غير محدد' : 'Not specified')}</p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الثاني: رقم الهاتف */}
                    <div className="flex items-center justify-between p-3.5 bg-orange-50/40 rounded-2xl border border-orange-100/60">
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-[#FF5722] shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {language === 'ar' ? '2. رقم الهاتف' : '2. Phone Number'}
                          </p>
                          <p className="font-black text-slate-900 text-sm" dir="ltr">{profile.phone || (language === 'ar' ? 'غير محدد' : 'Not specified')}</p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الثالث: اسم المستخدم */}
                    <div className="flex items-center justify-between p-3.5 bg-orange-50/40 rounded-2xl border border-orange-100/60">
                      <div className="flex items-center gap-3">
                        <AtSign className="h-5 w-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {language === 'ar' ? '3. اسم المستخدم' : '3. Username'}
                          </p>
                          <p className="font-black text-slate-800 text-sm">{profile.username || (language === 'ar' ? 'غير محدد' : 'Not specified')}</p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الرابع: البريد الإلكتروني (إن وجد) */}
                    <div className="flex items-center justify-between p-3.5 bg-orange-50/40 rounded-2xl border border-orange-100/60">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {language === 'ar' ? '4. البريد الإلكتروني' : '4. Email'}
                          </p>
                          <p className="font-black text-slate-800 text-sm">
                            {profile.email ? profile.email : <span className="text-slate-400 text-xs italic">{language === 'ar' ? 'لا يوجد بريد إلكتروني' : 'No email provided'}</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الأخير: عنوان موقع العميل النصي */}
                    <div className="p-3.5 bg-orange-50/40 rounded-2xl border border-orange-100/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-[#FF5722] shrink-0" />
                          <div>
                            <p className="text-[11px] text-slate-400 font-bold">
                              {language === 'ar' ? '5. عنوان موقع العميل (نصي)' : '5. Location Address (Text)'}
                            </p>
                            <p className="font-black text-slate-900 text-sm">{profile.address || (language === 'ar' ? 'لم يتم تحديث الموقع بعد' : 'No address set')}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={fetchCurrentLocationAddress}
                          disabled={gettingLocation}
                          className="text-xs gap-1 border-orange-200 text-[#FF5722] hover:bg-orange-50 rounded-xl shrink-0 font-black"
                        >
                          {gettingLocation ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {language === 'ar' ? 'جاري الجلب...' : 'Locating...'}</>
                          ) : (
                            <><MapPin className="h-3.5 w-3.5" /> {language === 'ar' ? 'جلب موقعي' : 'Get Location'}</>
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button onClick={() => setIsEditing(true)} className="w-full font-black mt-2 rounded-2xl bg-gradient-to-r from-[#FF6E40] to-[#FF5722] hover:from-[#FF5722] hover:to-[#E64A19] text-white shadow-md shadow-orange-500/20 py-3">
                      {t('edit_profile')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              {profileStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="text-center rounded-3xl border border-orange-100/80 shadow-[0_4px_16px_rgba(0,0,0,0.02)] bg-white overflow-hidden">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-2 text-[#FF5722]">
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <div className="text-base font-black text-slate-900">{stat.value}</div>
                      <div className="text-[11px] font-bold text-slate-400">{stat.label}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-2.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path + item.label}
                    variant="ghost"
                    className="w-full h-auto p-4 justify-between bg-white hover:bg-orange-50/60 rounded-3xl border border-orange-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all"
                    onClick={() => item.onClick ? item.onClick() : setLocation(item.path)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center text-[#FF5722]">
                        <Icon className="h-5 w-5 text-[#FF5722]" />
                      </div>
                      <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                        <div className="font-black text-slate-900 text-sm">{item.label}</div>
                        <div className="text-xs text-slate-400 font-bold">{item.description}</div>
                      </div>
                    </div>
                    <ArrowRight className={`h-4 w-4 text-slate-400 ${language === 'ar' ? 'rotate-180' : ''}`} />
                  </Button>
                );
              })}

              {/* زر تسجيل الخروج مع التنبيه */}
              <Button
                variant="outline"
                className="w-full h-auto p-4 justify-between border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold transition-all mt-4"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-6 w-6 text-red-600" />
                  <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                    <div className="font-bold text-red-600">{t('logout')}</div>
                    <div className="text-xs text-red-400">{language === 'ar' ? 'الخروج ومسح الجلسة الحالية' : 'Exit and clear session'}</div>
                  </div>
                </div>
                <ArrowRight className={`h-5 w-5 text-red-400 ${language === 'ar' ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* نافذة تأكيد الخروج المنبثقة */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className={`${language === 'ar' ? 'text-right' : 'text-left'} text-lg font-black text-red-600 flex items-center gap-2`}>
              <LogOut className="w-5 h-5" />
              {t('logout_confirm_title')}
            </AlertDialogTitle>
            <AlertDialogDescription className={`${language === 'ar' ? 'text-right' : 'text-left'} text-sm font-semibold text-gray-700 py-3 leading-relaxed`}>
              {t('logout_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2 justify-end">
            <AlertDialogCancel className="font-bold rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutConfirm(false);
                logout();
                toast({
                  title: t('logout'),
                  description: language === 'ar' ? "تم تسجيل الخروج وتفريغ البيانات المتعلقة بالحساب بنجاح" : "Successfully logged out",
                });
                setLocation('/auth');
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
            >
              {t('logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نافذة مشاركة التطبيق */}
      <ShareAppModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        appName={getSetting('app_name', 'السريع ون')}
        shareText={shareText || (language === 'ar' ? 'تسوق من السريع ون الآن!' : 'Shop from Saree One now!')}
        shareUrl={shareUrl || window.location.origin}
        logoUrl={getSetting('header_logo_url') || getSetting('logo_url')}
      />
    </div>
  );
}
