import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Phone, Truck, LogOut, Save, Settings, Lock, Coins, KeyRound, Eye, EyeOff, Check } from 'lucide-react';
import { safeTriggerPhoneCall } from '@/lib/callUtils';

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType?: string;
  vehicleNumber?: string;
  isAvailable: boolean;
  allowProfileEdit?: boolean;
  paymentMode?: 'commission' | 'salary';
  commissionRate?: number;
  salaryAmount?: number;
  completedOrders?: number;
  averageRating?: string;
  totalEarnings?: string;
}

interface ProfilePageProps {
  driverId?: string;
  onLogout: () => void;
}

export default function ProfilePage({ onLogout }: ProfilePageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [formData, setFormData] = useState<Partial<Driver>>({
    name: '',
    email: '',
    phone: '',
    vehicleType: '',
    vehicleNumber: '',
    isAvailable: false,
    allowProfileEdit: true,
    paymentMode: 'commission',
    commissionRate: 70,
    salaryAmount: 0,
    completedOrders: 0,
    averageRating: '0',
  });

  const driverToken = localStorage.getItem('driver_token');

  const { data: serverProfile } = useQuery({
    queryKey: ['/api/drivers/app/dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/drivers/app/dashboard', {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (!response.ok) return null;
      return response.json();
    },
    retry: false,
  });

  useEffect(() => {
    const source = serverProfile?.driver || null;
    const fallback = (() => {
      try {
        const raw = localStorage.getItem('driver_user');
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();
    const driver = source || fallback;
    if (!driver) return;
    setFormData({
      id: driver.id,
      name: driver.name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      vehicleType: driver.vehicleType || '',
      vehicleNumber: driver.vehicleNumber || '',
      isAvailable: driver.isAvailable || false,
      allowProfileEdit: driver.allowProfileEdit !== false,
      paymentMode: driver.paymentMode || 'commission',
      commissionRate: driver.commissionRate || 70,
      salaryAmount: parseFloat(driver.salaryAmount || '0'),
      completedOrders: driver.completedOrders || 0,
      averageRating: driver.averageRating || '0',
      totalEarnings: driver.totalEarnings || driver.earnings || '0',
    });
  }, [serverProfile]);

  const canEdit = formData.allowProfileEdit !== false;

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<Driver>) => {
      const payload = {
        name: data.name !== undefined ? data.name : formData.name,
        email: data.email !== undefined ? data.email : formData.email,
        phone: data.phone !== undefined ? data.phone : formData.phone,
        vehicleType: data.vehicleType !== undefined ? data.vehicleType : formData.vehicleType,
        vehicleNumber: data.vehicleNumber !== undefined ? data.vehicleNumber : formData.vehicleNumber,
      };

      const response = await fetch(`/api/drivers/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'فشل في تحديث الملف الشخصي');
      }
      return responseData;
    },
    onSuccess: (result) => {
      if (result.success && result.driver) {
        localStorage.setItem('driver_user', JSON.stringify(result.driver));
        setFormData(prev => ({ ...prev, ...result.driver }));
        queryClient.invalidateQueries({ queryKey: ['/api/drivers/app/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/drivers/profile'] });
      }
      setIsEditing(false);
      toast({
        title: "تم التحديث",
        description: "تم تحديث بيانات الملف الشخصي بنجاح"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!passwordData.currentPassword || !passwordData.newPassword) {
        throw new Error('يرجى إدخال كلمة المرور الحالية وكلمة المرور الجديدة');
      }
      if (passwordData.newPassword.length < 6) {
        throw new Error('كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل');
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('كلمة المرور الجديدة غير متطابقة مع تأكيد كلمة المرور');
      }

      const response = await fetch('/api/drivers/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'فشل تغيير كلمة المرور');
      }
      return responseData;
    },
    onSuccess: () => {
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
      toast({
        title: "تم التغيير",
        description: "تم تغيير كلمة المرور بنجاح"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const status = isAvailable ? 'available' : 'offline';
      const response = await fetch(`/api/drivers/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({ status }),
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resData.error || 'فشل في تحديث حالة التوفر');
      return resData;
    },
    onSuccess: (result) => {
      if (result.success) {
        setFormData(prev => ({ ...prev, isAvailable: result.status === 'available' }));
        const driverData = localStorage.getItem('driver_user');
        if (driverData) {
          const driver = JSON.parse(driverData);
          driver.isAvailable = result.status === 'available';
          localStorage.setItem('driver_user', JSON.stringify(driver));
        }
      }
      toast({
        title: "تم التحديث",
        description: result.status === 'available' ? "أنت متاح الآن 🟢" : "أنت غير متاح 🔴"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getVehicleLabel = (type?: string) => {
    const map: Record<string, string> = {
      motorcycle: 'دراجة نارية',
      car: 'سيارة',
      van: 'فان',
      truck: 'شاحنة صغيرة',
    };
    return type ? (map[type] || type) : '-';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-right">الملف الشخصي</h1>

        {/* Profile Header */}
        <Card className="mb-4 bg-gradient-to-r from-green-500 to-green-600 text-white border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div className="text-right flex-1">
                <p className="text-sm opacity-90">السائق</p>
                <p className="text-xl font-bold">{formData.name}</p>
                <p className="text-xs opacity-75">{formData.phone}</p>
                <div className="flex gap-2 mt-2 justify-end">
                  <Badge className="bg-white/20 text-white border-none text-xs">
                    {formData.completedOrders || 0} طلب مكتمل
                  </Badge>
                  <Badge className="bg-white/20 text-white border-none text-xs">
                    ⭐ {(parseFloat(formData.averageRating || '0') || 0).toFixed(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Agreement Card */}
        <Card className="mb-4 border border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-right text-base">
              <Coins className="h-5 w-5 text-primary" />
              اتفاقية العمل والمدفوعات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">نظام الدفع</p>
                <Badge variant={formData.paymentMode === 'salary' ? 'secondary' : 'default'}>
                  {formData.paymentMode === 'salary' ? 'راتب شهري' : 'عمولة'}
                </Badge>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {formData.paymentMode === 'salary' ? 'الراتب الشهري' : 'نسبة العمولة'}
                </p>
                <p className="font-bold text-primary">
                  {formData.paymentMode === 'salary'
                    ? `${formData.salaryAmount || 0} ريال`
                    : `${formData.commissionRate || 70}%`}
                </p>
              </div>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 text-sm text-center text-muted-foreground">
              {formData.paymentMode === 'salary'
                ? 'تحصل على راتب شهري ثابت بغض النظر عن عدد الطلبات'
                : `تحصل على ${formData.commissionRate || 70}% من رسوم التوصيل لكل طلب تكمله`}
            </div>
          </CardContent>
        </Card>

        {/* Availability Status */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-right">
              <span className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5 text-primary" />
                حالة التوفر لاستقبال الطلبات
              </span>
              <Switch
                checked={formData.isAvailable || false}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, isAvailable: checked }));
                  updateAvailabilityMutation.mutate(checked);
                }}
                disabled={updateAvailabilityMutation.isPending}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-sm text-gray-600">
                {formData.isAvailable ? 'أنت متاح لاستقبال طلبات جديدة 🟢' : 'أنت غير متاح الآن 🔴'}
              </p>
              <div className={`w-3 h-3 rounded-full ${formData.isAvailable ? 'bg-green-600' : 'bg-gray-400'}`} />
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row justify-between items-center">
            <div className="flex items-center gap-2">
              {canEdit ? (
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'إلغاء' : 'تعديل'}
                </Button>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  مقفل من الإدارة
                </Badge>
              )}
            </div>
            <CardTitle className="flex items-center gap-2 text-right text-base">
              <User className="h-5 w-5 text-primary" />
              معلومات الملف الشخصي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-right">
            {!canEdit && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 text-right">
                تعديل الملف الشخصي موقوف حالياً من قبل الإدارة. تواصل مع الإدارة لإجراء التعديلات.
              </div>
            )}
            <div>
              <Label className="mb-2 block">الاسم</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={!isEditing || !canEdit}
                placeholder="اسم السائق"
                className="text-right"
              />
            </div>

            <div>
              <Label className="mb-2 block">البريد الإلكتروني</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!isEditing || !canEdit}
                placeholder="البريد الإلكتروني"
                className="text-right"
              />
            </div>

            <div>
              <Label className="mb-2 block">رقم الهاتف</Label>
              <div className="flex gap-2 items-center">
                {formData.phone && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => safeTriggerPhoneCall(formData.phone || '')}
                    title="اتصال"
                  >
                    <Phone className="h-4 w-4 text-primary" />
                  </Button>
                )}
                <Input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing || !canEdit}
                  placeholder="رقم الهاتف"
                  className="text-right flex-1"
                />
              </div>
            </div>

            {isEditing && canEdit && (
              <Button
                onClick={() => updateProfileMutation.mutate(formData)}
                disabled={updateProfileMutation.isPending}
                className="w-full gap-2"
              >
                <Save className="h-4 w-4" />
                {updateProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Information */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row justify-between items-center">
            <div className="flex items-center gap-2">
              {canEdit ? (
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'إلغاء' : 'تعديل'}
                </Button>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  مقفل
                </Badge>
              )}
            </div>
            <CardTitle className="flex items-center gap-2 text-right text-base">
              <Truck className="h-5 w-5 text-primary" />
              معلومات المركبة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-right">
            <div>
              <Label className="mb-2 block">نوع المركبة</Label>
              <Input
                value={isEditing ? (formData.vehicleType || '') : getVehicleLabel(formData.vehicleType)}
                onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                disabled={!isEditing || !canEdit}
                placeholder="دراجة نارية / سيارة / فان"
                className="text-right"
              />
            </div>

            <div>
              <Label className="mb-2 block">رقم لوحة المركبة</Label>
              <Input
                value={formData.vehicleNumber || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                disabled={!isEditing || !canEdit}
                placeholder="رقم اللوحة"
                className="text-right"
              />
            </div>

            {isEditing && canEdit && (
              <Button
                onClick={() => updateProfileMutation.mutate({
                  vehicleType: formData.vehicleType,
                  vehicleNumber: formData.vehicleNumber
                })}
                disabled={updateProfileMutation.isPending}
                className="w-full gap-2"
              >
                <Save className="h-4 w-4" />
                {updateProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ بيانات المركبة'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row justify-between items-center">
            <Button
              variant={isChangingPassword ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setIsChangingPassword(!isChangingPassword);
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
              }}
            >
              {isChangingPassword ? 'إلغاء' : 'تغيير كلمة المرور'}
            </Button>
            <CardTitle className="flex items-center gap-2 text-right text-base">
              <KeyRound className="h-5 w-5 text-primary" />
              أمان الحساب وكلمة المرور
            </CardTitle>
          </CardHeader>
          {isChangingPassword && (
            <CardContent className="space-y-4 text-right">
              <div>
                <Label className="mb-2 block">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="أدخل كلمة المرور الحالية"
                    className="text-right pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">كلمة المرور الجديدة</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="6 أحرف على الأقل"
                  className="text-right"
                />
              </div>

              <div>
                <Label className="mb-2 block">تأكيد كلمة المرور الجديدة</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  className="text-right"
                />
              </div>

              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending || !passwordData.currentPassword || !passwordData.newPassword}
                className="w-full gap-2"
              >
                <Save className="h-4 w-4" />
                {changePasswordMutation.isPending ? 'جاري التغيير...' : 'تأكيد تغيير كلمة المرور'}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Logout Button */}
        <Card className="border-red-200 bg-red-50 border">
          <CardContent className="p-6">
            <Button
              onClick={onLogout}
              className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white border-none"
            >
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

