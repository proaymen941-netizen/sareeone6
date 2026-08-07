import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Edit, Trash2, Tag, Save, X, Search, Layers, Store, Utensils, 
  ShoppingBag, ShoppingCart, Pill, Coffee, Gift, Sparkles, CheckCircle2, 
  XCircle, ArrowUpDown, RefreshCw 
} from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Category, Restaurant } from '@shared/schema';

// نماذج جاهزة لتصنيفات المتاجر السريعة
const PRESET_STORE_CATEGORIES = [
  { 
    name: 'مطاعم ومأكولات', 
    icon: 'Utensils', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80',
    description: 'مطاعم الوجبات السريعة والشرقية والغربية' 
  },
  { 
    name: 'محلات ومتاجر', 
    icon: 'ShoppingBag', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80',
    description: 'متاجر الملابس والإكسسوارات والمنتجات العامة' 
  },
  { 
    name: 'سوبر ماركت ومواد غذائية', 
    icon: 'ShoppingCart', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&q=80',
    description: 'المواد الغذائية والمنتجات الاستهلاكية اليومية' 
  },
  { 
    name: 'صيدليات ومنتجات طبية', 
    icon: 'Pill', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1586015555751-63c3d82d4754?w=500&q=80',
    description: 'الأدوية والمستلزمات الطبية والعناية الشخصية' 
  },
  { 
    name: 'مخابز وحلويات', 
    icon: 'Utensils', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80',
    description: 'المخبوزات والحلويات الشرقية والغربية والعدك' 
  },
  { 
    name: 'كافيهات ومقاهي', 
    icon: 'Coffee', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&q=80',
    description: 'القهوة المخصصة والمشروبات الساخنة والباردة' 
  },
  { 
    name: 'ورود وهدايا', 
    icon: 'Gift', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=500&q=80',
    description: 'تنسيق الزهور والباقات والهدايا التذكارية' 
  },
  { 
    name: 'خضار وفواكه طازجة', 
    icon: 'ShoppingBag', 
    type: 'primary',
    image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=500&q=80',
    description: 'المنتجات الزراعية والخضروات والفواكه الطازجة' 
  },
];

export default function AdminCategories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  const [formData, setFormData] = useState({
    name: '',
    icon: 'Store',
    image: '',
    type: 'primary',
    sortOrder: 0,
    isActive: true,
  });

  // جلب تصنيفات المتاجر
  const { data: categories = [], isLoading: isCategoriesLoading, refetch } = useQuery<Category[]>({
    queryKey: ['/api/admin/categories'],
  });

  // جلب المتاجر لمعرفة عدد المتاجر المسجلة بكل تصنيف
  const { data: restaurants = [] } = useQuery<Restaurant[]>({
    queryKey: ['/api/restaurants'],
  });

  // إحصائيات المتاجر لكل تصنيف
  const storeCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    restaurants.forEach((r) => {
      if (r.categoryId) {
        counts[r.categoryId] = (counts[r.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [restaurants]);

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/admin/categories', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم إنشاء التصنيف بنجاح", description: "تمت إضافة تصنيف المتجر الجديد للشبكة" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "خطأ في الإنشاء", description: error?.message || "تعذر حفظ التصنيف الجديد", variant: "destructive" });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest('PUT', `/api/admin/categories/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم التحديث", description: "تم تحديث بيانات التصنيف بنجاح" });
      resetForm();
      setEditingCategory(null);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "خطأ في التحديث", description: error?.message || "تعذر تحديث التصنيف", variant: "destructive" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/categories/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم الحذف", description: "تم حذف تصنيف المتجر بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ في الحذف", description: error?.message || "تعذر حذف التصنيف", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({ 
      name: '', 
      icon: 'Store', 
      image: '', 
      type: 'primary',
      sortOrder: 0, 
      isActive: true 
    });
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      icon: category.icon || 'Store',
      image: category.image || '',
      type: category.type || 'primary',
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive !== false,
    });
    setIsDialogOpen(true);
  };

  const handleApplyPreset = (preset: typeof PRESET_STORE_CATEGORIES[0]) => {
    setFormData(prev => ({
      ...prev,
      name: preset.name,
      icon: preset.icon,
      type: preset.type,
      image: prev.image || preset.image
    }));
    toast({ title: "تم تطبيق النموذج", description: `تم تعبئة بيانات تصنيف "${preset.name}"` });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم تصنيف المتجر", variant: "destructive" });
      return;
    }

    const payload = {
      ...formData,
      icon: formData.icon || 'Store',
      image: formData.image || 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=500&q=80'
    };

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: payload });
    } else {
      createCategoryMutation.mutate(payload);
    }
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = !searchTerm.trim() || (c.name || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && c.isActive !== false) ||
        (filterStatus === 'inactive' && c.isActive === false);
      return matchesSearch && matchesStatus;
    });
  }, [categories, searchTerm, filterStatus]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50/50" dir="rtl">
      {/* Sticky Top Header & Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">إدارة تصنيفات المتاجر</h1>
              <p className="text-sm text-gray-500">
                إضافة وتصنيف أشكال المتاجر (مطاعم، محلات، سوبرماركت، صيدليات، مخابز، وغيرها)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
              title="تحديث البيانات"
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
              data-testid="button-add-category"
            >
              <Plus className="h-4 w-4" />
              إضافة تصنيف جديد
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="البحث في تصنيفات المتاجر (مطاعم، صيدلية، محلات...)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 bg-gray-50/50"
              data-testid="input-search-categories"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">الحالة:</span>
            <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${filterStatus === 'all' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-900'}`}
              >
                الكل ({categories.length})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${filterStatus === 'active' ? 'bg-white shadow text-emerald-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                نشط ({categories.filter(c => c.isActive !== false).length})
              </button>
              <button
                onClick={() => setFilterStatus('inactive')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${filterStatus === 'inactive' ? 'bg-white shadow text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                غير نشط ({categories.filter(c => c.isActive === false).length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {/* Quick Add Presets Bar */}
        <div className="mb-6 bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-800">نماذج تصنيفات سريعة جاهزة</h3>
            </div>
            <span className="text-xs text-gray-500">انقر على أي نموذج لتعبئة النموذج بضغطة واحدة</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_STORE_CATEGORIES.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  resetForm();
                  handleApplyPreset(preset);
                  setIsDialogOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gray-50 hover:bg-primary/5 hover:border-primary/40 text-xs font-medium text-gray-700 hover:text-primary transition-all shadow-xs"
              >
                <span>{preset.name}</span>
                <Plus className="h-3 w-3 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Categories Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isCategoriesLoading ? (
            [...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-36 bg-gray-200" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : filteredCategories.length > 0 ? (
            filteredCategories.map((category) => {
              const storeCount = storeCountsByCategory[category.id] || 0;
              return (
                <Card 
                  key={category.id} 
                  className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg border ${
                    category.isActive === false ? 'opacity-75 bg-gray-50' : 'bg-white'
                  }`}
                >
                  {/* Category Image Header */}
                  <div className="h-36 bg-gray-100 relative overflow-hidden">
                    {category.image ? (
                      <img 
                        src={category.image} 
                        alt={category.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gradient-to-br from-gray-100 to-gray-200">
                        <Store className="h-10 w-10 mb-1 opacity-40" />
                        <span className="text-xs italic">بدون صورة غلاف</span>
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {category.isActive !== false ? (
                        <Badge className="bg-emerald-500/90 hover:bg-emerald-600 text-white border-none shadow-sm gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> نشط
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-800/80 text-gray-200 border-none shadow-sm gap-1 text-[11px]">
                          <XCircle className="h-3 w-3" /> معطل
                        </Badge>
                      )}
                    </div>

                    {/* Stores Count Badge */}
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-amber-400" />
                      <span>{storeCount} متجر</span>
                    </div>
                  </div>

                  {/* Card Info Content */}
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold text-gray-900 line-clamp-1">
                        {category.name}
                      </CardTitle>
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md flex-shrink-0">
                        #{category.sortOrder || 0}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>النوع: {category.type === 'primary' ? 'تصنيف رئيسي' : category.type || 'عام'}</span>
                      <span className="font-mono">{category.icon || 'Store'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 text-gray-700 hover:text-primary hover:bg-primary/5"
                        onClick={() => handleEdit(category)}
                        data-testid={`button-edit-category-${category.id}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        تعديل
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-red-600 font-bold">تأكيد حذف تصنيف المتجر</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2 text-right">
                              <p>
                                هل أنت متأكد من رغبتك في حذف تصنيف <strong>"{category.name}"</strong>؟
                              </p>
                              {storeCount > 0 && (
                                <p className="text-amber-600 font-semibold bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                  ⚠️ يوجد {storeCount} متجر مرتبط بهذا التصنيف حالياً.
                                </p>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              حذف التصنيف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200 p-8">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">لا توجد تصنيفات متاجر متطابقة</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                لم يتم العثور على أي تصنيف للمتاجر. قم بإضافة تصنيفات مثل المطاعم والمحلات والسوبرماركت للبدء.
              </p>
              <Button 
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="h-4 w-4" />
                إضافة أول تصنيف متجر
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Category Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {editingCategory ? 'تعديل تصنيف المتجر' : 'إضافة تصنيف متجر جديد'}
            </DialogTitle>
            <DialogDescription>
              تحديد اسم التصنيف (مطاعم، صيدليات، سوبرماركت...) وصورة العلاف والترتيب
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="name" className="text-xs font-bold text-gray-700 mb-1.5 block">
                اسم التصنيف <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="مثال: مطاعم ومأكولات، سوبر ماركت، صيدليات..."
                required
                data-testid="input-category-name"
              />
            </div>

            {/* Presets Selection */}
            {!editingCategory && (
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  اختر من النماذج السريعة:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_STORE_CATEGORIES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                        formData.name === preset.name
                          ? 'bg-primary text-white border-primary font-bold shadow-xs'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <ImageUpload
                label="صورة غلاف التصنيف (تظهر في التطبيق والصفحة الرئيسية)"
                value={formData.image}
                onChange={(url) => setFormData(prev => ({ ...prev, image: url }))}
                bucket="categories"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="icon" className="text-xs font-bold text-gray-700 mb-1.5 block">
                  رمز الأيقونة (Icon Code)
                </Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="Store, Utensils, ShoppingBag..."
                />
              </div>

              <div>
                <Label htmlFor="sortOrder" className="text-xs font-bold text-gray-700 mb-1.5 block">
                  ترتيب العرض (Sort Order)
                </Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <Label htmlFor="isActive" className="text-sm font-bold text-gray-900 cursor-pointer">
                  حالة التصنيف (مفعل للعملاء)
                </Label>
                <p className="text-xs text-gray-500">
                  عند التفعيل يظهر هذا التصنيف للعملاء في القوائم والصفحة الرئيسية
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-category-active"
              />
            </div>

            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                type="submit"
                className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                data-testid="button-save-category"
              >
                <Save className="h-4 w-4" />
                {editingCategory ? 'حفظ التعديلات' : 'إنشاء التصنيف'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { resetForm(); setIsDialogOpen(false); }}
                data-testid="button-cancel-category"
              >
                <X className="h-4 w-4" />
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
