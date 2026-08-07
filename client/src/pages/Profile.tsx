import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, User, Phone, Mail, MapPin, Settings, Shield, Star, Clock, Receipt, Truck, MessageCircle, Share2, Loader2, AtSign, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/context/AuthContext';
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

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  useEffect(() => {
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
      toast({ title: "الموقع غير مدعوم", description: "متصفحك لا يدعم الوصول لموقعك الجغرافي", variant: "destructive" });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ar`,
            { headers: { 'User-Agent': 'AlSarieOne/1.0' } }
          );
          const data = await response.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            const shortAddr = parts.slice(0, 4).join('،').trim();
            setProfile(prev => ({ ...prev, address: shortAddr }));
            toast({ title: "تم تحديث العنوان النصي", description: shortAddr });
          } else {
            const coordsText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            setProfile(prev => ({ ...prev, address: coordsText }));
            toast({ title: "تم تحديد موقعك الإحداثي", description: coordsText });
          }
        } catch {
          const coordsText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setProfile(prev => ({ ...prev, address: coordsText }));
          toast({ title: "تم جلب موقعك الإحداثي", description: "يرجى تعديل التفاصيل إن لزم الأمر" });
        } finally {
          setGettingLocation(false);
        }
      },
      (err) => {
        setGettingLocation(false);
        toast({
          title: "تعذر الوصول للموقع",
          description: "يرجى السماح بالوصول لموقعك الجغرافي في المتصفح لجلب العنوان تلقائياً",
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
      if (!userId) throw new Error('يجب تسجيل الدخول أولاً');
      const response = await apiRequest('PUT', `/api/users/${userId}`, profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId] });
      setIsEditing(false);
      toast({
        title: "تم حفظ البيانات",
        description: "تم تحديث معلومات الملف الشخصي بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في الحفظ",
        description: "حدث خطأ أثناء تحديث البيانات. يرجى المحاولة مرة أخرى.",
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
          <p className="text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  // تم إزالة وضع الضيف (Guest Mode) بناءً على طلب المستخدم لإجبار تسجيل الدخول

  const getSetting = (key: string, defaultValue: string = '') => {
    return uiSettings?.find(s => s.key === key)?.value || defaultValue;
  };

  const supportWhatsapp = getSetting('support_whatsapp', '');
  const supportPhone = getSetting('support_phone', '');
  const shareUrl = getSetting('share_url', '');
  const shareText = getSetting('share_text', 'انضم إلى تطبيق السريع ون الآن!');

  const profileStats = [
    { 
      icon: Receipt, 
      label: 'إجمالي الطلبات', 
      value: userOrders?.length?.toString() || '0', 
      color: 'text-primary' 
    },
    { icon: Star, label: 'التقييم', value: '4.8', color: 'text-yellow-500' },
    { 
      icon: Clock, 
      label: 'عضو منذ', 
      value: (user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('ar-YE', { month: 'short', year: 'numeric' }) : 'جديد', 
      color: 'text-green-500' 
    },
  ];

  const menuItems = [
    { icon: Receipt, label: 'طلباتي', path: '/orders', description: 'عرض تاريخ الطلبات', testId: 'profile-orders' },
    { icon: Truck, label: 'تطبيق الدلفري', path: '/driver', description: 'انتقال إلى تطبيق السائقين', testId: 'profile-delivery-app', onClick: () => { window.location.href = '/driver'; } },
    { icon: MapPin, label: 'العناوين المحفوظة', path: '/addresses', description: 'إدارة عناوين التوصيل', testId: 'profile-addresses' },
    { icon: Settings, label: 'الإعدادات', path: '/settings', description: 'إعدادات التطبيق والحساب', testId: 'profile-settings' },
    ...(supportWhatsapp ? [{
      icon: MessageCircle,
      label: 'دعم واتساب',
      path: '#',
      description: 'تواصل معنا عبر واتساب',
      testId: 'profile-whatsapp',
      onClick: () => { window.open(`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}`, '_blank'); }
    }] : []),
    ...(supportPhone ? [{
      icon: Phone,
      label: 'اتصل بنا',
      path: '#',
      description: 'اتصل برقم الدعم المباشر',
      testId: 'profile-call',
      onClick: () => { window.open(`tel:${supportPhone}`, '_blank'); }
    }] : []),
    ...(shareUrl ? [{
      icon: Share2,
      label: 'مشاركة التطبيق',
      path: '#',
      description: 'شارك التطبيق مع أصدقائك',
      testId: 'profile-share',
      onClick: () => {
        if (navigator.share) {
          navigator.share({ title: 'السريع ون', text: shareText, url: shareUrl });
        } else {
          toast({ title: 'نسخ الرابط', description: shareUrl });
        }
      }
    }] : []),
    { icon: Shield, label: 'سياسة الخصوصية', path: '/privacy', description: 'سياسة الخصوصية وشروط الاستخدام', testId: 'profile-privacy' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col items-center mb-8 border-b pb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-primary">السريع ون</h1>
          <p className="text-sm font-bold text-muted-foreground mt-1">لخدمات التوصيل</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-none border-2">
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl text-foreground">
                  {profile.name || (!isAuthenticated ? 'مستخدم ضيف' : 'المستخدم')}
                </CardTitle>
                <Badge variant={!isAuthenticated ? "outline" : "secondary"} className="mx-auto">
                  {!isAuthenticated ? 'مستخدم ضيف' : 'عضو مميز'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    {/* الحقل الأول: اسم العميل */}
                    <div>
                      <Label htmlFor="name" className="text-foreground font-bold">1. اسم العميل</Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="أدخل اسمك الكامل"
                        className="mt-1"
                      />
                    </div>
                    {/* الحقل الثاني: رقم الهاتف */}
                    <div>
                      <Label htmlFor="phone" className="text-foreground font-bold">2. رقم الهاتف</Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="أدخل رقم الهاتف"
                        dir="ltr"
                        className="mt-1 text-right"
                      />
                    </div>
                    {/* الحقل الثالث: اسم المستخدم */}
                    <div>
                      <Label htmlFor="username" className="text-foreground font-bold">3. اسم المستخدم</Label>
                      <Input
                        id="username"
                        value={profile.username}
                        onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="أدخل اسم المستخدم"
                        className="mt-1"
                      />
                    </div>
                    {/* الحقل الرابع: البريد الإلكتروني (إن وجد) */}
                    <div>
                      <Label htmlFor="email" className="text-foreground font-bold">4. البريد الإلكتروني (إن وجد)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="example@mail.com (اختياري)"
                        className="mt-1"
                      />
                    </div>
                    {/* الحقل الأخير: عنوان موقع العميل النصي */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="address" className="text-foreground font-bold">5. عنوان موقع العميل</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={fetchCurrentLocationAddress}
                          disabled={gettingLocation}
                          className="text-xs text-primary hover:text-primary/80 h-7 px-2"
                        >
                          {gettingLocation ? (
                            <><Loader2 className="h-3 w-3 animate-spin ml-1" /> جاري التحديد...</>
                          ) : (
                            <><MapPin className="h-3 w-3 ml-1" /> استخدام موقعي الحالي</>
                          )}
                        </Button>
                      </div>
                      <Input
                        id="address"
                        value={profile.address}
                        onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="أدخل عنوان موقعك أو انقر على استخدام موقعي الحالي"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSave} className="flex-1 font-bold" disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* الحقل الأول: اسم العميل */}
                    <div className="flex items-center justify-between p-3 bg-muted/60 rounded-xl border">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">1. اسم العميل</p>
                          <p className="font-bold text-foreground text-sm">{profile.name || profile.username || 'غير محدد'}</p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الثاني: رقم الهاتف */}
                    <div className="flex items-center justify-between p-3 bg-muted/60 rounded-xl border">
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">2. رقم الهاتف</p>
                          <p className="font-bold text-foreground text-sm" dir="ltr">{profile.phone || 'غير محدد'}</p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الثالث: اسم المستخدم */}
                    <div className="flex items-center justify-between p-3 bg-muted/60 rounded-xl border">
                      <div className="flex items-center gap-3">
                        <AtSign className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">3. اسم المستخدم</p>
                          <p className="font-semibold text-foreground text-sm">{profile.username || 'غير محدد'}</p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الرابع: البريد الإلكتروني (إن وجد) */}
                    <div className="flex items-center justify-between p-3 bg-muted/60 rounded-xl border">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">4. البريد الإلكتروني</p>
                          <p className="font-semibold text-foreground text-sm">
                            {profile.email ? profile.email : <span className="text-muted-foreground text-xs italic">لا يوجد بريد إلكتروني</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* الحقل الأخير: عنوان موقع العميل النصي */}
                    <div className="p-3 bg-muted/60 rounded-xl border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-primary shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">5. عنوان موقع العميل (نصي)</p>
                            <p className="font-bold text-foreground text-sm">{profile.address || 'لم يتم تحديث الموقع بعد'}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={fetchCurrentLocationAddress}
                          disabled={gettingLocation}
                          className="text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                        >
                          {gettingLocation ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري الجلب...</>
                          ) : (
                            <><MapPin className="h-3.5 w-3.5" /> جلب موقعي</>
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button onClick={() => setIsEditing(true)} className="w-full font-bold mt-2">
                      تعديل بيانات الملف الشخصي
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              {profileStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="text-center">
                    <CardContent className="p-4">
                      <Icon className={`h-6 w-6 ${stat.color} mx-auto mb-2`} />
                      <div className="text-lg font-bold text-foreground">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className="w-full h-auto p-4 justify-between hover:bg-accent"
                    onClick={() => item.onClick ? item.onClick() : setLocation(item.path)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 text-primary" />
                      <div className="text-right">
                        <div className="font-medium text-foreground">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground rotate-180" />
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
                  <div className="text-right">
                    <div className="font-bold text-red-600">تسجيل الخروج</div>
                    <div className="text-xs text-red-400">الخروج ومسح الجلسة الحالية</div>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-red-400 rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* نافذة تأكيد الخروج المنبثقة */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-lg font-black text-red-600 flex items-center gap-2">
              <LogOut className="w-5 h-5" />
              تأكيد تسجيل الخروج
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm font-semibold text-gray-700 py-3 leading-relaxed">
              عند تسجيل الخروج سوف يتم حذف كل شيء يتعلق بحساب العميل هذا ومسح جلسة الدخول الحالية. هل أنت متأكد من رغبتك في الخروج؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2 justify-end">
            <AlertDialogCancel className="font-bold rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutConfirm(false);
                logout();
                toast({
                  title: "تم تسجيل الخروج",
                  description: "تم تسجيل الخروج وتفريغ البيانات المتعلقة بالحساب بنجاح",
                });
                setLocation('/auth');
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
            >
              تأكيد تسجيل الخروج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
