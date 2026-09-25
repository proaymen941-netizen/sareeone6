import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Edit, Trash2, Home, Briefcase, Star, Check, ArrowRight, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface UserAddress {
  id: string;
  userId: string;
  type: string;
  title: string;
  address: string;
  details?: string;
  latitude?: string;
  longitude?: string;
  isDefault: boolean;
  createdAt: Date;
}

interface CustomerAddressesProps {
  userId?: string;
}

export default function CustomerAddresses({ userId: propUserId }: CustomerAddressesProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const effectiveUserId =
    propUserId ||
    user?.id ||
    user?.phone ||
    localStorage.getItem('customer_id') ||
    localStorage.getItem('customer_phone') ||
    localStorage.getItem('user_id') ||
    '';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [formData, setFormData] = useState({
    type: 'home',
    title: '',
    address: '',
    details: '',
    latitude: '',
    longitude: '',
    isDefault: false
  });

  // Fetch addresses
  const { data: addresses = [], isLoading } = useQuery<UserAddress[]>({
    queryKey: ['/api/customer/addresses', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) {
        // قراءة من التخزين المحلي للزوار
        try {
          const cached = localStorage.getItem('local_saved_addresses');
          return cached ? JSON.parse(cached) : [];
        } catch (_) {
          return [];
        }
      }
      const response = await fetch(`/api/customer/addresses?userId=${encodeURIComponent(effectiveUserId)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: true
  });

  // Create address mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!effectiveUserId) {
        // حفظ محلياً في حال عدم وجود حساب
        const newLocal: UserAddress = {
          id: 'local_' + Date.now(),
          userId: 'guest',
          type: data.type || 'home',
          title: data.title,
          address: data.address,
          details: data.details,
          isDefault: data.isDefault || false,
          createdAt: new Date()
        };
        const current = JSON.parse(localStorage.getItem('local_saved_addresses') || '[]');
        localStorage.setItem('local_saved_addresses', JSON.stringify([newLocal, ...current]));
        return newLocal;
      }
      const response = await fetch('/api/customer/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: effectiveUserId })
      });
      if (!response.ok) throw new Error('Failed to create address');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/addresses'] });
      toast({ title: 'تم إضافة العنوان بنجاح' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'خطأ في إضافة العنوان', variant: 'destructive' });
    }
  });

  // Update address mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      if (id.startsWith('local_')) {
        const current: UserAddress[] = JSON.parse(localStorage.getItem('local_saved_addresses') || '[]');
        const updated = current.map(a => a.id === id ? { ...a, ...data } : a);
        localStorage.setItem('local_saved_addresses', JSON.stringify(updated));
        return { success: true };
      }
      const response = await fetch(`/api/customer/addresses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: effectiveUserId })
      });
      if (!response.ok) throw new Error('Failed to update address');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/addresses'] });
      toast({ title: 'تم تحديث العنوان بنجاح' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'خطأ في تحديث العنوان', variant: 'destructive' });
    }
  });

  // Delete address mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('local_')) {
        const current: UserAddress[] = JSON.parse(localStorage.getItem('local_saved_addresses') || '[]');
        const filtered = current.filter(a => a.id !== id);
        localStorage.setItem('local_saved_addresses', JSON.stringify(filtered));
        return;
      }
      const response = await fetch(`/api/customer/addresses/${id}?userId=${encodeURIComponent(effectiveUserId)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete address');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/addresses'] });
      toast({ title: 'تم حذف العنوان بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ في حذف العنوان', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      type: 'home',
      title: '',
      address: '',
      details: '',
      latitude: '',
      longitude: '',
      isDefault: false
    });
    setEditingAddress(null);
  };

  const handleOpenDialog = (address?: UserAddress) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        type: address.type || 'home',
        title: address.title || '',
        address: address.address || '',
        details: address.details || '',
        latitude: address.latitude || '',
        longitude: address.longitude || '',
        isDefault: address.isDefault || false
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      userId: effectiveUserId
    };

    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getAddressIcon = (type: string) => {
    switch (type) {
      case 'home': return <Home className="h-5 w-5" />;
      case 'work': return <Briefcase className="h-5 w-5" />;
      default: return <MapPin className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  setLocation('/track-orders');
                }
              }}
              className="rounded-full"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-black text-gray-900">عناويني المحفوظة</h1>
              <p className="text-xs text-gray-500 font-bold">عناوين التوصيل الحقيقية لحسابك</p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            إضافة عنوان
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {!effectiveUserId && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-orange-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-800">حفظ العناوين الدائم</p>
                <p className="text-[11px] text-gray-500">سجل الدخول لربط عناوينك بحسابك ومزامنتها على كل أجهزتك</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setLocation('/auth')} className="shrink-0 text-xs">
              تسجيل الدخول
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-gray-500 font-medium">جاري جلب عناوينك المحفوظة...</div>
        ) : addresses.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-200 rounded-3xl">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 text-primary flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-8 w-8" />
              </div>
              <h3 className="font-black text-gray-800 text-lg mb-1">لا توجد عناوين محفوظة بعد</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
                أضف عناوينك المفضلة (المنزل، العمل) لتسهيل وتسريع توصيل طلباتك
              </p>
              <Button onClick={() => handleOpenDialog()} className="rounded-xl px-6">
                <Plus className="h-4 w-4 mr-2" />
                إضافة أول عنوان
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {addresses.map((addr) => (
              <Card key={addr.id} className={`rounded-2xl transition-all shadow-sm ${addr.isDefault ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'hover:border-gray-300'}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div className={`p-3 rounded-2xl shrink-0 ${addr.isDefault ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {getAddressIcon(addr.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-black text-gray-900 text-base">{addr.title}</h3>
                          {addr.isDefault && (
                            <Badge className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">افتراضي</Badge>
                          )}
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {addr.type === 'home' ? 'منزل' : addr.type === 'work' ? 'عمل' : 'آخر'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium leading-relaxed">{addr.address}</p>
                        {addr.details && (
                          <p className="text-xs text-gray-500 mt-1 bg-white/80 p-2 rounded-xl border border-gray-100">{addr.details}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenDialog(addr)}>
                        <Edit className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-50" onClick={() => deleteMutation.mutate(addr.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md w-[92vw] rounded-3xl p-6" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-gray-900">
              {editingAddress ? 'تعديل العنوان' : 'إضافة عنوان توصيل جديد'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-bold text-gray-700">نوع العنوان</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[
                  { value: 'home', label: 'منزل', icon: Home },
                  { value: 'work', label: 'عمل', icon: Briefcase },
                  { value: 'other', label: 'أخرى', icon: MapPin }
                ].map((type) => (
                  <Button
                    key={type.value}
                    type="button"
                    variant={formData.type === type.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className="gap-1.5 rounded-xl h-10 font-bold text-xs"
                  >
                    <type.icon className="h-3.5 w-3.5" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="title" className="text-xs font-bold text-gray-700">اسم العنوان (مختصر)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: منزلي، العمل، شقة الوالد"
                required
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-xs font-bold text-gray-700">العنوان الكامل (الشارع والحي)</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="مثال: صنعاء، شارع حدة، خلف برج نماء"
                required
                rows={3}
                className="mt-1 rounded-xl resize-none"
              />
            </div>

            <div>
              <Label htmlFor="details" className="text-xs font-bold text-gray-700">تفاصيل إضافية أو علامة مميزة (اختياري)</Label>
              <Input
                id="details"
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="مثال: عمارة النور، الطابق الثالث، شقة 5"
                className="mt-1 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-primary rounded accent-primary cursor-pointer"
              />
              <Label htmlFor="isDefault" className="text-xs font-bold text-gray-700 cursor-pointer">تعيين كعنوان افتراضي للتوصيل</Label>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl font-bold">
                {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ العنوان'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

