import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Store, Save, X, Clock, Star, Search, MapPin, Phone, Layers, ChevronDown, ChevronUp, Link2, ClipboardPaste, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { matchesSearchQuery, normalizeArabicText, extractCoordsFromTextOrUrl } from '@/lib/utils';
import type { Restaurant, Category, MenuItem } from '@shared/schema';
import LocationPicker from '@/components/maps/GoogleMapPicker';

export default function AdminRestaurants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionsRestaurant, setSectionsRestaurant] = useState<Restaurant | null>(null);
  const [isSectionsDialogOpen, setIsSectionsDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [googleMapsUrlInput, setGoogleMapsUrlInput] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    phone: '',
    deliveryTime: '',
    commissionRate: '10',
    isOpen: true,
    categoryId: '',
    openingTime: '08:00',
    closingTime: '23:00',
    workingDays: '0,1,2,3,4,5,6',
    isTemporarilyClosed: false,
    temporaryCloseReason: '',
    latitude: '',
    longitude: '',
    address: '',
    isFeatured: false,
    isNew: false,
    isActive: true,
  });

  const { data: restaurantsData, isLoading: restaurantsLoading } = useQuery<{restaurants: Restaurant[], pagination: any}>({
    queryKey: ['/api/admin/restaurants'],
  });

  const restaurants = restaurantsData?.restaurants || [];

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/admin/categories'],
  });

  const { data: allMenuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ['/api/admin/menu-items'],
  });

  const { data: restaurantSections = [], refetch: refetchSections } = useQuery<any[]>({
    queryKey: ['/api/admin/restaurants', sectionsRestaurant?.id, 'sections'],
    queryFn: async () => {
      if (!sectionsRestaurant?.id) return [];
      const res = await apiRequest('GET', `/api/admin/restaurants/${sectionsRestaurant.id}/sections`);
      return res.json();
    },
    enabled: !!sectionsRestaurant?.id && isSectionsDialogOpen,
  });

  const createSectionMutation = useMutation({
    mutationFn: async ({ restaurantId, name }: { restaurantId: string; name: string }) => {
      const res = await apiRequest('POST', '/api/admin/restaurant-sections', { restaurantId, name, isActive: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants', sectionsRestaurant?.id, 'sections'] });
      setNewSectionName('');
      toast({ title: 'تم إضافة القسم', description: 'تم إضافة القسم الجديد بنجاح' });
    },
    onError: () => toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في إضافة القسم' }),
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, name, isActive }: { id: string; name: string; isActive?: boolean }) => {
      const res = await apiRequest('PUT', `/api/admin/restaurant-sections/${id}`, { name, isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants', sectionsRestaurant?.id, 'sections'] });
      setEditingSectionId(null);
      setEditingSectionName('');
      toast({ title: 'تم تحديث القسم' });
    },
    onError: () => toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحديث القسم' }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/restaurant-sections/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants', sectionsRestaurant?.id, 'sections'] });
      toast({ title: 'تم حذف القسم' });
    },
    onError: () => toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في حذف القسم' }),
  });

  const createRestaurantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const submitData = {
        ...data,
        deliveryFee: '0',
        perKmFee: '0',
        latitude: data.latitude ? String(data.latitude) : null,
        longitude: data.longitude ? String(data.longitude) : null,
        categoryId: data.categoryId && data.categoryId !== 'null' ? data.categoryId : null,
        temporaryCloseReason: data.isTemporarilyClosed ? (data.temporaryCloseReason || null) : null,
      };
      const response = await apiRequest('POST', '/api/admin/restaurants', submitData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "تم إضافة المتجر",
        description: "تم إضافة المتجر الجديد بنجاح",
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إضافة المتجر",
        description: error?.message || "تعذر إضافة المتجر",
        variant: "destructive",
      });
    }
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const submitData: any = { ...data };
      if ('latitude' in data) {
        submitData.latitude = data.latitude && String(data.latitude).trim() !== '' ? String(data.latitude).trim() : null;
      }
      if ('longitude' in data) {
        submitData.longitude = data.longitude && String(data.longitude).trim() !== '' ? String(data.longitude).trim() : null;
      }
      if ('categoryId' in data) {
        submitData.categoryId = data.categoryId && data.categoryId !== 'null' && data.categoryId !== 'undefined' ? data.categoryId : null;
      }
      if ('isTemporarilyClosed' in data) {
        submitData.isTemporarilyClosed = Boolean(data.isTemporarilyClosed);
        submitData.temporaryCloseReason = data.isTemporarilyClosed 
          ? (typeof data.temporaryCloseReason === 'string' && data.temporaryCloseReason.trim() ? data.temporaryCloseReason.trim() : null)
          : null;
      } else if ('temporaryCloseReason' in data) {
        submitData.temporaryCloseReason = typeof data.temporaryCloseReason === 'string' && data.temporaryCloseReason.trim() ? data.temporaryCloseReason.trim() : null;
      }
      if ('workingDays' in data) {
        submitData.workingDays = typeof data.workingDays === 'string' 
          ? data.workingDays 
          : Array.isArray(data.workingDays) 
            ? (data.workingDays as any[]).join(',') 
            : '0,1,2,3,4,5,6';
      }
      const response = await apiRequest('PUT', `/api/admin/restaurants/${id}`, submitData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "تم تحديث المتجر",
        description: "تم تحديث بيانات المتجر بنجاح",
      });
      resetForm();
      setEditingRestaurant(null);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في تحديث المتجر",
        description: error?.message || "تعذر تحديث بيانات المتجر",
        variant: "destructive",
      });
    }
  });

  const deleteRestaurantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/restaurants/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurants'] });
      toast({
        title: "تم حذف المتجر",
        description: "تم حذف المتجر بنجاح",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      phone: '',
      deliveryTime: '',
      commissionRate: '10',
      isOpen: true,
      categoryId: '',
      openingTime: '08:00',
      closingTime: '23:00',
      workingDays: '0,1,2,3,4,5,6',
      isTemporarilyClosed: false,
      temporaryCloseReason: '',
      // الحقول المفقودة من قاعدة البيانات
      latitude: '',
      longitude: '',
      address: '',
      isFeatured: false,
      isNew: false,
      isActive: true,
    });
    setEditingRestaurant(null);
  };

  const handleEdit = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setFormData({
      name: restaurant.name || '',
      description: restaurant.description || '',
      phone: restaurant.phone || '',
      image: restaurant.image || '',
      deliveryTime: restaurant.deliveryTime || '30-45 دقيقة',
      commissionRate: restaurant.commissionRate ? String(restaurant.commissionRate) : '10',
      isOpen: restaurant.isOpen !== false,
      categoryId: restaurant.categoryId || '',
      openingTime: restaurant.openingTime || '08:00',
      closingTime: restaurant.closingTime || '23:00',
      workingDays: restaurant.workingDays || '0,1,2,3,4,5,6',
      isTemporarilyClosed: restaurant.isTemporarilyClosed || false,
      temporaryCloseReason: restaurant.temporaryCloseReason || '',
      latitude: restaurant.latitude ? String(restaurant.latitude) : '',
      longitude: restaurant.longitude ? String(restaurant.longitude) : '',
      address: restaurant.address || '',
      isFeatured: restaurant.isFeatured || false,
      isNew: restaurant.isNew || false,
      isActive: restaurant.isActive !== false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المتجر",
        variant: "destructive",
      });
      return;
    }

    if (!formData.deliveryTime.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال وقت التوصيل",
        variant: "destructive",
      });
      return;
    }

    // Working days validation safely
    const workingDaysStr = typeof formData.workingDays === 'string' 
      ? formData.workingDays 
      : Array.isArray(formData.workingDays) 
        ? (formData.workingDays as any[]).join(',') 
        : '0,1,2,3,4,5,6';
    const workingDaysArray = workingDaysStr.split(',').map(s => s.trim()).filter(Boolean);
    if (workingDaysArray.length === 0) {
      toast({
        title: "خطأ في أيام العمل",
        description: "يجب اختيار يوم واحد على الأقل للعمل",
        variant: "destructive",
      });
      return;
    }

    // Time validation (ensure valid time format)
    if (formData.openingTime && formData.closingTime) {
      if (!String(formData.openingTime).includes(':') || !String(formData.closingTime).includes(':')) {
        toast({
          title: "خطأ في أوقات العمل",
          description: "يرجى إدخال وقت فتح وإغلاق صحيحين",
          variant: "destructive",
        });
        return;
      }
    }

    // Temporary closure validation safely
    const isTempClosed = Boolean(formData.isTemporarilyClosed);
    const reasonStr = typeof formData.temporaryCloseReason === 'string' ? formData.temporaryCloseReason.trim() : '';
    if (isTempClosed && !reasonStr) {
      toast({
        title: "خطأ في الإغلاق المؤقت",
        description: "يرجى إدخال سبب الإغلاق المؤقت للمتجر",
        variant: "destructive",
      });
      return;
    }

    if (editingRestaurant) {
      updateRestaurantMutation.mutate({ id: editingRestaurant.id, data: formData });
    } else {
      createRestaurantMutation.mutate(formData);
    }
  };

  const toggleRestaurantStatus = (restaurant: Restaurant, field: 'isOpen') => {
    updateRestaurantMutation.mutate({
      id: restaurant.id,
      data: { [field]: !restaurant[field] }
    });
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories?.find(c => c.id === categoryId);
    return category?.name || 'غير محدد';
  };

  // استخراج وتحديد موقع المتجر بدقة من رابط خرائط جوجل (Google Maps Link)
  const handleResolveGoogleMapsUrl = async (customUrl?: string) => {
    const targetUrl = (customUrl || googleMapsUrlInput).trim();
    if (!targetUrl) {
      toast({
        title: "يرجى إدخال رابط خرائط جوجل",
        description: "الصق رابط خرائط جوجل مثل maps.app.goo.gl أو رابط المتصفح",
        variant: "destructive"
      });
      return;
    }

    // 1. استخراج فوري من الرابط أو الإحداثيات (Direct client extraction)
    const direct = extractCoordsFromTextOrUrl(targetUrl);
    if (direct) {
      setFormData(prev => ({
        ...prev,
        latitude: direct.lat.toString(),
        longitude: direct.lng.toString(),
        address: direct.title || prev.address || `${direct.lat.toFixed(6)}, ${direct.lng.toFixed(6)}`
      }));
      toast({
        title: "تم استخراج الموقع بنجاح 🎯",
        description: `خط العرض: ${direct.lat.toFixed(6)} | خط الطول: ${direct.lng.toFixed(6)}`
      });
      setGoogleMapsUrlInput('');
      return;
    }

    // 2. تحليل الرابط القصير عبر السيرفر (Server shortlink resolution)
    setIsResolvingUrl(true);
    try {
      const res = await fetch(`/api/geocode/resolve-url?url=${encodeURIComponent(targetUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.lat && data.lon) {
          setFormData(prev => ({
            ...prev,
            latitude: data.lat,
            longitude: data.lon,
            address: data.display_name || prev.address || `${data.lat}, ${data.lon}`
          }));
          toast({
            title: "تم تحديد موقع المتجر بدقة من الرابط 🎯",
            description: data.display_name || `تم تعبئة الإحداثيات بنجاح`
          });
          setGoogleMapsUrlInput('');
          return;
        }
      }
      toast({
        title: "تعذر استخراج الموقع من الرابط",
        description: "تأكد من نسخ رابط صحيح من تطبيق خرائط جوجل أو افتح الخريطة للتحديد",
        variant: "destructive"
      });
    } catch (e) {
      toast({
        title: "خطأ في الاتصال بالخادم",
        description: "يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    } finally {
      setIsResolvingUrl(false);
    }
  };

  const handlePasteClipboardToForm = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setGoogleMapsUrlInput(text);
        handleResolveGoogleMapsUrl(text);
      }
    } catch (e) {
      toast({
        title: "يرجى لصق الرابط يدوياً",
        description: "استخدم Ctrl+V أو اضغط باستمرار للصق الرابط في الحقل",
      });
    }
  };
  // فلترة المتاجر حسب البحث بدقة عالية وحساسية للأحرف والهمزات والكلمات المتعددة
  const filteredRestaurants = useMemo(() => {
    const term = (searchTerm || '').trim();
    if (!term) return restaurants;

    return restaurants
      .map(restaurant => {
        const catName = getCategoryName(restaurant.categoryId || '');
        const fields = [
          restaurant.name,
          catName,
          restaurant.address,
          restaurant.phone,
          (restaurant as any).description,
          (restaurant as any).email,
          (restaurant as any).city
        ].filter(Boolean);

        const isMatch = matchesSearchQuery(fields, term);
        if (!isMatch) return null;

        // حساب درجة الأهمية لترتيب النتائج بدقة (Google Maps-like ranking)
        let score = 0;
        const normTerm = normalizeArabicText(term);
        const normName = normalizeArabicText(restaurant.name || '');
        if (normName === normTerm) score += 100;
        else if (normName.startsWith(normTerm)) score += 50;
        else if (normName.includes(normTerm)) score += 30;

        return { restaurant, score };
      })
      .filter((item): item is { restaurant: Restaurant; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map(item => item.restaurant);
  }, [restaurants, searchTerm, categories]);

  // فتح موقع المتجر على خرائط جوجل
  const openRestaurantOnMap = (restaurant: Restaurant) => {
    if (restaurant.latitude && restaurant.longitude) {
      const url = `https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`;
      window.open(url, '_blank');
    } else if (restaurant.address) {
      const encodedAddress = encodeURIComponent(restaurant.address);
      const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      window.open(url, '_blank');
    } else {
      toast({
        title: "موقع غير متوفر",
        description: "لم يتم تحديد موقع لهذا المتجر",
        variant: "destructive",
      });
    }
  };

  // دالة لتحويل القيم الرقمية من string إلى number للعرض
  const parseDecimal = (value: string | null): number => {
    if (!value) return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة المتاجر</h1>
            <p className="text-muted-foreground">إدارة المتاجر والعلامات التجارية</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="gap-2"
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
              data-testid="button-add-restaurant"
            >
              <Plus className="h-4 w-4" />
              إضافة متجر جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl xl:max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50/70 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 shadow-2xl rounded-2xl" dir="rtl">
            <DialogHeader className="p-4 sm:p-5 bg-gradient-to-r from-orange-600 via-[#f06424] to-amber-600 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                    <Store className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-white">
                      {editingRestaurant ? 'تعديل بيانات المتجر' : 'إضافة متجر جديد'}
                    </DialogTitle>
                    <p className="text-xs text-orange-100 mt-0.5">
                      أدخل بيانات المتجر، الموقع الجغرافي، وساعات العمل بنظام عرضي متكامل
                    </p>
                  </div>
                </div>
              </div>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* العمود الأول: البيانات الأساسية والصورة والحالة */}
                  <div className="space-y-5">
                    {/* بطاقة البيانات الأساسية */}
                    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <Store className="h-4 w-4 text-[#f06424]" />
                        <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">البيانات الأساسية للمتجر</h3>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="name" className="text-xs font-semibold text-gray-700 dark:text-gray-300">اسم المتجر *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="أدخل اسم المتجر أو المطعم"
                            required
                            className="mt-1 h-10 rounded-xl"
                            data-testid="input-restaurant-name"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="phone" className="text-xs font-semibold text-gray-700 dark:text-gray-300">رقم الهاتف</Label>
                            <Input
                              id="phone"
                              value={formData.phone}
                              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="+967xxxxxxxxx"
                              className="mt-1 h-10 rounded-xl text-left"
                              dir="ltr"
                              data-testid="input-restaurant-phone"
                            />
                          </div>

                          <div>
                            <Label htmlFor="category" className="text-xs font-semibold text-gray-700 dark:text-gray-300">القسم / التصنيف *</Label>
                            <Select value={formData.categoryId} onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}>
                              <SelectTrigger className="mt-1 h-10 rounded-xl" data-testid="select-restaurant-category">
                                <SelectValue placeholder="اختر قسم المتجر" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories?.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="deliveryTime" className="text-xs font-semibold text-gray-700 dark:text-gray-300">وقت التوصيل التقديري *</Label>
                            <Input
                              id="deliveryTime"
                              value={formData.deliveryTime}
                              onChange={(e) => setFormData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                              placeholder="30-45 دقيقة"
                              required
                              className="mt-1 h-10 rounded-xl"
                              data-testid="input-restaurant-delivery-time"
                            />
                          </div>

                          <div>
                            <Label htmlFor="commissionRate" className="text-xs font-semibold text-gray-700 dark:text-gray-300">نسبة العمولة (%)</Label>
                            <Input
                              id="commissionRate"
                              type="number"
                              value={formData.commissionRate}
                              onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                              placeholder="10"
                              className="mt-1 h-10 rounded-xl text-left"
                              dir="ltr"
                              data-testid="input-restaurant-commission"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="description" className="text-xs font-semibold text-gray-700 dark:text-gray-300">وصف المتجر</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="نبذة مختصرة عن المتجر وما يقدمه من منتجات أو مأكولات..."
                            rows={2}
                            className="mt-1 rounded-xl resize-none"
                            data-testid="input-restaurant-description"
                          />
                        </div>
                      </div>
                    </div>

                    {/* بطاقة صورة المتجر */}
                    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-[#f06424]" />
                          <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">صورة المتجر</h3>
                        </div>
                        {formData.image && (
                          <span className="text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md font-medium">تم تحديد صورة</span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            id="image"
                            value={formData.image}
                            onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                            placeholder="https://example.com/image.jpg أو ارفع صورة"
                            required
                            data-testid="input-restaurant-image"
                            className="flex-1 h-10 rounded-xl text-left"
                            dir="ltr"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('restaurant-file-upload')?.click()}
                            data-testid="button-select-image"
                            className="h-10 rounded-xl shrink-0 font-bold border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-orange-600"
                          >
                            اختيار صورة
                          </Button>
                          <input
                            id="restaurant-file-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const result = event.target?.result as string;
                                  setFormData(prev => ({ ...prev, image: result }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>

                        {formData.image && (
                          <div className="relative w-full h-28 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-50 flex items-center justify-center group">
                            <img src={formData.image} alt="معاينة" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                                className="h-8 rounded-lg gap-1 text-xs"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                حذف الصورة
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* بطاقة الحالات والتفعيل */}
                    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-100 dark:border-zinc-800">حالات المتجر في النظام</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700">
                          <Label htmlFor="isOpen" className="text-xs font-semibold cursor-pointer">مفتوح للطلبات</Label>
                          <Switch
                            id="isOpen"
                            checked={formData.isOpen}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOpen: checked }))}
                            data-testid="switch-restaurant-open"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700">
                          <Label htmlFor="isActive" className="text-xs font-semibold cursor-pointer">المتجر مفعل</Label>
                          <Switch
                            id="isActive"
                            checked={formData.isActive}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                            data-testid="switch-restaurant-active"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700">
                          <Label htmlFor="isFeatured" className="text-xs font-semibold cursor-pointer">متجر مميز</Label>
                          <Switch
                            id="isFeatured"
                            checked={formData.isFeatured}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFeatured: checked }))}
                            data-testid="switch-restaurant-featured"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700">
                          <Label htmlFor="isNew" className="text-xs font-semibold cursor-pointer">متجر جديد</Label>
                          <Switch
                            id="isNew"
                            checked={formData.isNew}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isNew: checked }))}
                            data-testid="switch-restaurant-new"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* العمود الثاني: الموقع الجغرافي وأوقات العمل */}
                  <div className="space-y-5">
                    {/* بطاقة الموقع الجغرافي وتحديد الإحداثيات */}
                    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#f06424]" />
                          <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">الموقع الجغرافي والإحداثيات</h3>
                        </div>
                        {formData.latitude && formData.longitude && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            تم التحديد بدقة
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* صندوق لصق رابط خرائط جوجل المباشر */}
                        <div className="bg-orange-50/70 dark:bg-zinc-800/60 p-3 rounded-xl border border-orange-200/80 dark:border-zinc-700/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="googleMapsLink" className="text-xs font-bold text-orange-950 dark:text-orange-300 flex items-center gap-1.5">
                              <Link2 className="h-3.5 w-3.5 text-[#f06424]" />
                              <span>لصق رابط المتجر من خرائط جوجل (Google Maps Link):</span>
                            </Label>
                            <span className="text-[10px] text-orange-700 dark:text-orange-400 font-semibold bg-orange-100/80 dark:bg-orange-950/60 px-2 py-0.5 rounded-full">
                              دقة 100%
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Input
                              id="googleMapsLink"
                              value={googleMapsUrlInput}
                              onChange={(e) => setGoogleMapsUrlInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleResolveGoogleMapsUrl();
                                }
                              }}
                              placeholder="الصق الرابط هنا (مثال: https://maps.app.goo.gl/... أو إحداثيات)..."
                              className="h-10 text-xs bg-white dark:bg-zinc-900 border-orange-200 dark:border-zinc-700 text-left placeholder:text-right"
                              dir="ltr"
                              data-testid="input-google-maps-link"
                            />
                            <Button
                              type="button"
                              onClick={() => handleResolveGoogleMapsUrl()}
                              disabled={isResolvingUrl || !googleMapsUrlInput.trim()}
                              className="h-10 px-3 bg-[#f06424] hover:bg-orange-700 text-white font-bold text-xs shrink-0 rounded-xl"
                              data-testid="button-extract-link-location"
                            >
                              {isResolvingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              <span className="hidden sm:inline mr-1">استخراج</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handlePasteClipboardToForm}
                              className="h-10 px-2.5 border-orange-300 dark:border-zinc-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100/60 shrink-0 rounded-xl"
                              title="لصق من الحافظة"
                            >
                              <ClipboardPaste className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                            💡 انسخ رابط مشاركة الموقع من تطبيق خرائط جوجل والصقه هنا ليتم استخراج خطوط الطول والعرض والعنوان تلقائياً بدقة تامة.
                          </p>
                        </div>

                        {/* خط فاصل أنيق */}
                        <div className="flex items-center gap-2 my-1">
                          <div className="h-px bg-gray-200 dark:bg-zinc-800 flex-1"></div>
                          <span className="text-[11px] font-semibold text-gray-400">أو حدد عبر الخريطة التفاعلية</span>
                          <div className="h-px bg-gray-200 dark:bg-zinc-800 flex-1"></div>
                        </div>

                        {/* زر الخريطة الكبير والواضح */}
                        <Button
                          type="button"
                          onClick={() => setIsLocationPickerOpen(true)}
                          className="w-full h-11 rounded-xl gap-2 font-bold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-sm transition-all active:scale-[0.99]"
                          data-testid="button-open-maps"
                        >
                          <MapPin className="h-4 w-4" />
                          <span>فتح خريطة التحديد والبحث العالمية</span>
                        </Button>

                        {/* العنوان الكامل */}
                        <div>
                          <Label htmlFor="address" className="text-xs font-semibold text-gray-700 dark:text-gray-300">العنوان الكامل</Label>
                          <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="مثال: صنعاء، شارع حدة، بجوار جولة الرويشان..."
                            rows={2}
                            className="mt-1 rounded-xl resize-none"
                            data-testid="input-restaurant-address"
                          />
                        </div>

                        {/* حقول الإحداثيات */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="latitude" className="text-xs font-semibold text-gray-700 dark:text-gray-300">خط العرض (Latitude)</Label>
                            <Input
                              id="latitude"
                              type="number"
                              step="any"
                              value={formData.latitude}
                              onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                              placeholder="15.3694"
                              className="mt-1 h-10 rounded-xl text-left"
                              dir="ltr"
                              data-testid="input-restaurant-latitude"
                            />
                          </div>
                          <div>
                            <Label htmlFor="longitude" className="text-xs font-semibold text-gray-700 dark:text-gray-300">خط الطول (Longitude)</Label>
                            <Input
                              id="longitude"
                              type="number"
                              step="any"
                              value={formData.longitude}
                              onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                              placeholder="44.1910"
                              className="mt-1 h-10 rounded-xl text-left"
                              dir="ltr"
                              data-testid="input-restaurant-longitude"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* بطاقة أوقات وأيام العمل */}
                    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <Clock className="h-4 w-4 text-[#f06424]" />
                        <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">أوقات وساعات العمل</h3>
                      </div>

                      <div className="space-y-4">
                        {/* أوقات الفتح والإغلاق */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="openingTime" className="text-xs font-semibold text-gray-700 dark:text-gray-300">وقت الفتح</Label>
                            <Input
                              id="openingTime"
                              type="time"
                              value={formData.openingTime}
                              onChange={(e) => setFormData(prev => ({ ...prev, openingTime: e.target.value }))}
                              className="mt-1 h-10 rounded-xl text-center"
                              data-testid="input-restaurant-opening-time"
                            />
                          </div>
                          <div>
                            <Label htmlFor="closingTime" className="text-xs font-semibold text-gray-700 dark:text-gray-300">وقت الإغلاق</Label>
                            <Input
                              id="closingTime"
                              type="time"
                              value={formData.closingTime}
                              onChange={(e) => setFormData(prev => ({ ...prev, closingTime: e.target.value }))}
                              className="mt-1 h-10 rounded-xl text-center"
                              data-testid="input-restaurant-closing-time"
                            />
                          </div>
                        </div>

                        {/* أيام العمل */}
                        <div>
                          <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">أيام العمل الأسبوعية</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { value: '0', label: 'الأحد' },
                              { value: '1', label: 'الإثنين' },
                              { value: '2', label: 'الثلاثاء' },
                              { value: '3', label: 'الأربعاء' },
                              { value: '4', label: 'الخميس' },
                              { value: '5', label: 'الجمعة' },
                              { value: '6', label: 'السبت' },
                            ].map((day) => {
                              const workingDaysStr = typeof formData.workingDays === 'string' 
                                ? formData.workingDays 
                                : Array.isArray(formData.workingDays) 
                                  ? (formData.workingDays as any[]).join(',') 
                                  : '0,1,2,3,4,5,6';
                              const workingDaysArray = workingDaysStr.split(',').map(s => s.trim()).filter(Boolean);
                              const isChecked = workingDaysArray.includes(day.value);
                              
                              return (
                                <div key={day.value} className="flex items-center space-x-2 space-x-reverse bg-gray-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-gray-100 dark:border-zinc-700">
                                  <Checkbox
                                    id={`day-${day.value}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentDays = workingDaysArray;
                                      let newDays;
                                      if (checked) {
                                        newDays = [...currentDays, day.value].sort((a, b) => parseInt(a) - parseInt(b));
                                      } else {
                                        newDays = currentDays.filter(d => d !== day.value);
                                      }
                                      setFormData(prev => ({ ...prev, workingDays: newDays.join(',') }));
                                    }}
                                    data-testid={`checkbox-working-day-${day.value}`}
                                  />
                                  <Label
                                    htmlFor={`day-${day.value}`}
                                    className="text-xs font-medium cursor-pointer"
                                  >
                                    {day.label}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* إغلاق مؤقت */}
                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                            <div>
                              <Label htmlFor="isTemporarilyClosed" className="text-xs font-bold text-amber-900 dark:text-amber-400 cursor-pointer">إغلاق مؤقت للمتجر</Label>
                              <p className="text-[11px] text-amber-700 dark:text-amber-500">تفعيل هذا الخيار يوقف استقبال الطلبات مؤقتاً مع إبقاء المتجر ظاهراً</p>
                            </div>
                            <Switch
                              id="isTemporarilyClosed"
                              checked={formData.isTemporarilyClosed}
                              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isTemporarilyClosed: checked }))}
                              data-testid="switch-restaurant-temporarily-closed"
                            />
                          </div>
                          
                          {formData.isTemporarilyClosed && (
                            <div>
                              <Label htmlFor="temporaryCloseReason" className="text-xs font-semibold text-gray-700 dark:text-gray-300">سبب الإغلاق المؤقت</Label>
                              <Textarea
                                id="temporaryCloseReason"
                                value={formData.temporaryCloseReason}
                                onChange={(e) => setFormData(prev => ({ ...prev, temporaryCloseReason: e.target.value }))}
                                placeholder="مثال: أعمال صيانة، إجازة عيد، ظروف خاصة..."
                                rows={2}
                                className="mt-1 rounded-xl resize-none"
                                data-testid="input-restaurant-temporary-close-reason"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* شريط الإجراءات السفلي الثابت */}
              <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 sm:p-5 flex items-center justify-end gap-3 z-10 shrink-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-11 px-6 rounded-xl font-bold text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                  data-testid="button-cancel-restaurant"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  إلغاء
                </Button>

                <Button 
                  type="submit" 
                  className="h-11 px-8 rounded-xl gap-2 font-bold bg-[#f06424] hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all"
                  disabled={createRestaurantMutation.isPending || updateRestaurantMutation.isPending}
                  data-testid="button-save-restaurant"
                >
                  <Save className="h-4 w-4" />
                  {editingRestaurant ? 'حفظ وتحديث بيانات المتجر' : 'إضافة المتجر الآن'}
                </Button>
              </div>
            </form>

            {/* نافذة الخريطة المنبثقة */}
            {isLocationPickerOpen && (
              <LocationPicker
                isOpen={isLocationPickerOpen}
                onClose={() => setIsLocationPickerOpen(false)}
                onLocationSelect={(location) => {
                  setFormData(prev => ({
                    ...prev,
                    latitude: location.lat.toString(),
                    longitude: location.lng.toString(),
                    address: location.address || prev.address
                  }));
                  setIsLocationPickerOpen(false);
                  toast({
                    title: "تم تحديد الموقع بنجاح",
                    description: location.address || "تم حفظ الإحداثيات",
                  });
                }}
                initialLocation={
                  formData.latitude && formData.longitude
                    ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
                    : undefined
                }
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* حوار إدارة الأقسام */}
      <Dialog open={isSectionsDialogOpen} onOpenChange={(open) => {
        setIsSectionsDialogOpen(open);
        if (!open) { setNewSectionName(''); setEditingSectionId(null); setEditingSectionName(''); }
      }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              إدارة أقسام: {sectionsRestaurant?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="اسم القسم الجديد (مثال: قسم البيتزا)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSectionName.trim() && sectionsRestaurant) {
                    createSectionMutation.mutate({ restaurantId: sectionsRestaurant.id, name: newSectionName.trim() });
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (newSectionName.trim() && sectionsRestaurant) {
                    createSectionMutation.mutate({ restaurantId: sectionsRestaurant.id, name: newSectionName.trim() });
                  }
                }}
                disabled={!newSectionName.trim() || createSectionMutation.isPending}
                size="sm"
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                إضافة
              </Button>
            </div>

            <div className="space-y-2">
              {restaurantSections.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا توجد أقسام بعد</p>
                  <p className="text-xs">أضف أقساماً مثل: قسم البروست، قسم البيتزا...</p>
                </div>
              ) : (
                restaurantSections.map((section: any) => (
                  <div key={section.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    {editingSectionId === section.id ? (
                      <>
                        <Input
                          value={editingSectionName}
                          onChange={(e) => setEditingSectionName(e.target.value)}
                          className="flex-1 h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingSectionName.trim()) {
                              updateSectionMutation.mutate({ id: section.id, name: editingSectionName.trim(), isActive: section.isActive });
                            }
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => updateSectionMutation.mutate({ id: section.id, name: editingSectionName.trim(), isActive: section.isActive })}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingSectionId(null); setEditingSectionName(''); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <span className="text-sm font-medium">{section.name}</span>
                          {!section.isActive && <Badge variant="outline" className="mr-2 text-xs">مخفي</Badge>}
                        </div>
                        <Switch
                          checked={section.isActive}
                          onCheckedChange={(checked) => updateSectionMutation.mutate({ id: section.id, name: section.name, isActive: checked })}
                          className="scale-75"
                        />
                        <Button size="sm" variant="ghost" onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); }}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف القسم</AlertDialogTitle>
                              <AlertDialogDescription>هل أنت متأكد من حذف قسم "{section.name}"؟</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSectionMutation.mutate(section.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* شريط البحث */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="البحث في المتاجر..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search-restaurants"
            />
          </div>
        </CardContent>
      </Card>

      {/* Restaurants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {restaurantsLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="w-full h-48 bg-muted" />
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))
        ) : filteredRestaurants?.length ? (
          filteredRestaurants.map((restaurant) => (
            <Card key={restaurant.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                {restaurant.image ? (
                  <img 
                    src={restaurant.image} 
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="h-16 w-16 text-primary/50" />
                )}
              </div>
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{restaurant.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mb-2">
                      {getCategoryName(restaurant.categoryId || '')}
                    </p>
                    {restaurant.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                        <Phone className="h-3 w-3" />
                        <span>{restaurant.phone}</span>
                      </div>
                    )}
                    {restaurant.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {restaurant.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={restaurant.isOpen ? "default" : "outline"}>
                    {restaurant.isOpen ? 'مفتوح' : 'مغلق'}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{restaurant.deliveryTime}</span>
                  </div>
                  {restaurant.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs truncate">{restaurant.address}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    توصيل: {parseDecimal(restaurant.deliveryFee)} ريال
                  </div>
                  {restaurant.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>{restaurant.rating}</span>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">مفتوح</p>
                  <Switch
                    checked={restaurant.isOpen}
                    onCheckedChange={() => toggleRestaurantStatus(restaurant, 'isOpen')}
                    data-testid={`switch-restaurant-open-${restaurant.id}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 col-span-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                    onClick={() => { setSectionsRestaurant(restaurant); setIsSectionsDialogOpen(true); }}
                    data-testid={`button-sections-${restaurant.id}`}
                  >
                    <Layers className="h-3 w-3" />
                    إدارة الأقسام
                  </Button>

                  {(restaurant.latitude && restaurant.longitude) || restaurant.address ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRestaurantOnMap(restaurant)}
                      className="gap-1"
                      data-testid={`button-map-${restaurant.id}`}
                    >
                      <MapPin className="h-3 w-3" />
                      خريطة
                    </Button>
                  ) : (
                    <div></div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleEdit(restaurant)}
                    data-testid={`button-edit-restaurant-${restaurant.id}`}
                  >
                    <Edit className="h-3 w-3" />
                    تعديل
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive gap-1 col-span-2"
                        data-testid={`button-delete-restaurant-${restaurant.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        حذف المتجر
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف المتجر وبيناتة</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2 text-right">
                          <span>
                            تنبيه: المتجر <strong>"{restaurant.name}"</strong> مرتبط حالياً بـ <strong>{allMenuItems.filter(i => i.restaurantId === restaurant.id).length} منتج/منتجات</strong> وبالأقسام والعروض والبيانات التابعة له.
                          </span>
                          <br /><br />
                          <strong className="text-red-600 block">سبب التأكيد ونطاق الحذف:</strong>
                          <ul className="list-disc list-inside mt-1 text-sm space-y-1">
                            <li>عند الموافقة، سيتم حذف المتجر نهائياً</li>
                            <li>سيتم حذف جميع المنتجات المرتبطة به ({allMenuItems.filter(i => i.restaurantId === restaurant.id).length} منتج)</li>
                            <li>سيتم حذف أقسام القائمة والعروض والتقييمات التابعة للمتجر</li>
                          </ul>
                          <br />
                          <span className="font-semibold text-destructive text-sm block">
                            هل توافق على حذف المتجر مع كافة بياناته ومنتجاته التابعة؟
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteRestaurantMutation.mutate(restaurant.id)}
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                          موافقة وحذف المتجر ومنتجاته
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'لا توجد نتائج' : 'لا توجد مطاعم'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'جرب البحث بكلمات مختلفة' : 'ابدأ بإضافة المتاجر والمتاجر'}
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-restaurant">
              إضافة المتجر الأول
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}