import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { matchesSearchQuery, normalizeArabicText, extractCoordsFromTextOrUrl } from '@/lib/utils'
import { Restaurant, Category } from '@shared/schema'
import { Plus, Search, Edit, Trash2, Store, MapPin, Clock, Star, Map as MapIcon, Loader2, Link2, ClipboardPaste } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import MapComponent from './maps/MapComponent'

export default function RestaurantManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState<any[]>([])
  const [isSearchingMap, setIsSearchingMap] = useState(false)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState<Partial<Restaurant>>({
    name: '',
    description: '',
    address: '',
    categoryId: '',
    isOpen: true,
    rating: '4.5',
    deliveryTime: '30-45',
    deliveryFee: '5',
    minimumOrder: '50',
    image: '',
    latitude: '',
    longitude: '',
    isFeatured: false,
    isNew: false,
    isActive: true
  })

  // Fetch restaurants
  const { data: restaurants = [], isLoading } = useQuery<Restaurant[]>({
    queryKey: ['/api/restaurants'],
    enabled: true
  })

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/admin/categories'],
    enabled: true
  })

  // Create restaurant mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<Restaurant>) => 
      apiRequest('POST', '/api/restaurants', data),
    onSuccess: () => {
      toast({ title: 'تم إنشاء المتجر بنجاح' })
      setIsDialogOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['/api/restaurants'] })
    },
    onError: () => {
      toast({ title: 'خطأ في إنشاء المتجر', variant: 'destructive' })
    }
  })

  // Update restaurant mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Restaurant> }) => 
      apiRequest('PUT', `/api/restaurants/${id}`, data),
    onSuccess: () => {
      toast({ title: 'تم تحديث المتجر بنجاح' })
      setIsDialogOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['/api/restaurants'] })
    },
    onError: () => {
      toast({ title: 'خطأ في تحديث المتجر', variant: 'destructive' })
    }
  })

  // Delete restaurant mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest('DELETE', `/api/restaurants/${id}`),
    onSuccess: () => {
      toast({ title: 'تم حذف المتجر بنجاح' })
      queryClient.invalidateQueries({ queryKey: ['/api/restaurants'] })
    },
    onError: () => {
      toast({ title: 'خطأ في حذف المتجر', variant: 'destructive' })
    }
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      address: '',
      categoryId: '',
      isOpen: true,
      rating: '4.5',
      deliveryTime: '30-45',
      deliveryFee: '5',
      minimumOrder: '50',
      image: '',
      latitude: '',
      longitude: '',
      isFeatured: false,
      isNew: false,
      isActive: true
    })
    setSelectedRestaurant(null)
    setIsEditing(false)
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.image || !formData.deliveryTime) {
      toast({ title: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' })
      return
    }

    // Clean data for API - only send defined fields that match schema
    const submitData: Partial<Restaurant> = {
      name: formData.name,
      image: formData.image,
      deliveryTime: formData.deliveryTime,
      description: formData.description || null,
      address: formData.address || null,
      categoryId: formData.categoryId || null,
      deliveryFee: formData.deliveryFee || "0",
      minimumOrder: formData.minimumOrder || "0", 
      rating: formData.rating || "4.5",
      latitude: formData.latitude || null,
      longitude: formData.longitude || null,
      isOpen: formData.isOpen ?? true,
      isFeatured: formData.isFeatured ?? false,
      isNew: formData.isNew ?? false,
      isActive: formData.isActive ?? true
    }

    if (isEditing && selectedRestaurant) {
      updateMutation.mutate({ id: selectedRestaurant.id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleEdit = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant)
    setFormData({
      name: restaurant.name || '',
      description: restaurant.description || '',
      address: restaurant.address || '',
      categoryId: restaurant.categoryId || '',
      isOpen: restaurant.isOpen,
      rating: restaurant.rating || '4.5',
      deliveryTime: restaurant.deliveryTime || '30-45',
      deliveryFee: restaurant.deliveryFee || '5',
      minimumOrder: restaurant.minimumOrder || '50',
      image: restaurant.image || '',
      latitude: restaurant.latitude || '',
      longitude: restaurant.longitude || '',
      isFeatured: restaurant.isFeatured || false,
      isNew: restaurant.isNew || false,
      isActive: restaurant.isActive
    })
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleMapSelect = (lat: number, lng: number, address: string) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
      address: address || prev.address
    }))
    setIsMapOpen(false)
  }

  const handleSearchMapLocation = async () => {
    const q = mapSearchQuery.trim()
    if (!q) return
    setIsSearchingMap(true)
    try {
      // 1. Direct coordinate or Google Maps link extraction
      const direct = extractCoordsFromTextOrUrl(q)
      if (direct) {
        setFormData(prev => ({
          ...prev,
          latitude: direct.lat.toString(),
          longitude: direct.lng.toString(),
          address: direct.title || prev.address || `${direct.lat.toFixed(6)}, ${direct.lng.toFixed(6)}`
        }))
        toast({ title: 'تم استخراج وتحديد الموقع بدقة من الرابط 🎯' })
        setIsMapOpen(false)
        return
      }

      // 2. Check server geocode API (supports names and shortened links)
      const srvRes = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`)
      if (srvRes.ok) {
        const data = await srvRes.json()
        if (Array.isArray(data) && data.length > 0) {
          setMapSearchResults(data)
          return
        }
      }
      // 3. Fallback to Photon Worldwide
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`)
      const data = await response.json()
      if (data?.features && data.features.length > 0) {
        setMapSearchResults(data.features.map((f: any) => ({
          display_name: [f.properties.name, f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join('، '),
          lat: f.geometry.coordinates[1].toString(),
          lon: f.geometry.coordinates[0].toString()
        })))
      } else {
        toast({ title: 'لم يتم العثور على نتائج للموقع المدخل', description: 'يرجى تجربة اسم منطقة أو معلم معروف أو رابط خرائط جوجل' })
      }
    } catch (error) {
      console.error('Error searching location:', error)
      toast({ title: 'خطأ في البحث عن الموقع', variant: 'destructive' })
    } finally {
      setIsSearchingMap(false)
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المتجر؟')) {
      deleteMutation.mutate(id)
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'غير محدد'
    const category = categories.find(cat => cat.id === categoryId)
    return category?.name || 'غير محدد'
  }

  const filteredRestaurants = restaurants
    .map(restaurant => {
      const term = (searchTerm || '').trim();
      if (!term) return { restaurant, score: 0 };
      const catName = getCategoryName(restaurant.categoryId);
      const fields = [
        restaurant.name,
        catName,
        restaurant.address,
        restaurant.description,
      ].filter(Boolean);

      const isMatch = matchesSearchQuery(fields, term);
      if (!isMatch) return null;

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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">جاري تحميل المتاجر...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              إدارة المتاجر
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    resetForm()
                    setIsDialogOpen(true)
                  }}
                  data-testid="button-add-restaurant"
                >
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة متجر جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl xl:max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50/70 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 shadow-2xl rounded-2xl" dir="rtl">
                <DialogHeader className="p-4 sm:p-5 bg-gradient-to-r from-orange-600 via-[#f06424] to-amber-600 text-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                      <Store className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-bold text-white">
                        {isEditing ? 'تعديل بيانات المتجر' : 'إضافة متجر جديد'}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-orange-100 mt-0.5">
                        {isEditing ? 'قم بتحديث بيانات وموقع وساعات عمل المتجر' : 'أدخل بيانات المتجر الجديد، موقعه، وصورته بنظام عرضي منظم'}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    {/* Column 1: Info, Image, Flags */}
                    <div className="space-y-5">
                      {/* Basic details */}
                      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                          <Store className="h-4 w-4 text-[#f06424]" />
                          <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">البيانات الأساسية</h3>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="name" className="text-xs font-semibold">اسم المتجر *</Label>
                            <Input
                              id="name"
                              value={formData.name || ''}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="اسم المتجر"
                              className="mt-1 h-10 rounded-xl"
                              data-testid="input-restaurant-name"
                            />
                          </div>

                          <div>
                            <Label htmlFor="categoryId" className="text-xs font-semibold">الفئة / القسم *</Label>
                            <Select value={formData.categoryId || ''} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                              <SelectTrigger className="mt-1 h-10 rounded-xl" data-testid="select-category">
                                <SelectValue placeholder="اختر الفئة" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="deliveryTime" className="text-xs font-semibold">وقت التوصيل *</Label>
                              <Input
                                id="deliveryTime"
                                value={formData.deliveryTime || ''}
                                onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                                placeholder="30-45 دقيقة"
                                className="mt-1 h-10 rounded-xl"
                                data-testid="input-delivery-time"
                              />
                            </div>
                            <div>
                              <Label htmlFor="rating" className="text-xs font-semibold">التقييم</Label>
                              <Input
                                id="rating"
                                type="number"
                                min="0"
                                max="5"
                                step="0.1"
                                value={formData.rating || ''}
                                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                                placeholder="4.5"
                                className="mt-1 h-10 rounded-xl"
                                data-testid="input-rating"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="deliveryFee" className="text-xs font-semibold">رسوم التوصيل</Label>
                              <Input
                                id="deliveryFee"
                                type="number"
                                value={formData.deliveryFee || ''}
                                onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                                placeholder="5"
                                className="mt-1 h-10 rounded-xl"
                                data-testid="input-delivery-fee"
                              />
                            </div>
                            <div>
                              <Label htmlFor="minimumOrder" className="text-xs font-semibold">الحد الأدنى للطلب</Label>
                              <Input
                                id="minimumOrder"
                                type="number"
                                value={formData.minimumOrder || ''}
                                onChange={(e) => setFormData({ ...formData, minimumOrder: e.target.value })}
                                placeholder="50"
                                className="mt-1 h-10 rounded-xl"
                                data-testid="input-minimum-order"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="description" className="text-xs font-semibold">الوصف</Label>
                            <Textarea
                              id="description"
                              value={formData.description || ''}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              placeholder="وصف المتجر والمنتجات..."
                              rows={2}
                              className="mt-1 rounded-xl resize-none"
                              data-testid="input-restaurant-description"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Image Upload */}
                      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
                        <ImageUpload
                          label="صورة المتجر *"
                          value={formData.image || ''}
                          onChange={(url) => setFormData({ ...formData, image: url })}
                          bucket="restaurants"
                          required={true}
                          data-testid="input-restaurant-image"
                        />
                      </div>
                    </div>

                    {/* Column 2: Location & Status Flags */}
                    <div className="space-y-5">
                      {/* Location Card */}
                      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#f06424]" />
                            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">الموقع الجغرافي</h3>
                          </div>
                          {formData.latitude && formData.longitude && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              تم تحديد الإحداثيات
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-3">
                          {/* Map trigger */}
                          <div>
                            <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  type="button" 
                                  className="w-full h-11 rounded-xl gap-2 font-bold bg-[#f06424] hover:bg-orange-600 text-white shadow-md"
                                >
                                  <MapIcon className="h-4 w-4" />
                                  <span>تحديد الموقع والبحث عبر الخريطة</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-2xl" dir="rtl">
                                <DialogHeader className="p-4 border-b bg-gradient-to-r from-orange-600 to-[#f06424] text-white">
                                  <DialogTitle className="flex items-center gap-2 text-white">
                                    <MapPin className="h-5 w-5" />
                                    تحديد موقع المتجر عبر الخريطة والبحث
                                  </DialogTitle>
                                  <DialogDescription className="text-xs text-orange-100">
                                    ابحث عن العنوان أو الموقع بالاسم، أو انقر مباشرة على الخريطة لتثبيت الإحداثيات.
                                  </DialogDescription>
                                </DialogHeader>

                                {/* Location Search Bar */}
                                <div className="p-3 bg-white border-b flex gap-2">
                                  <div className="relative flex-1">
                                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                      placeholder="ابحث عن شارع، منطقة، أو معلم (مثلاً: حدة، صنعاء)..."
                                      value={mapSearchQuery}
                                      onChange={(e) => setMapSearchQuery(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSearchMapLocation()}
                                      className="pr-9 text-sm rounded-xl"
                                    />
                                  </div>
                                  <Button
                                    onClick={handleSearchMapLocation}
                                    disabled={isSearchingMap || !mapSearchQuery.trim()}
                                    className="gap-1.5 shrink-0 bg-[#f06424] hover:bg-orange-600 text-white rounded-xl"
                                  >
                                    {isSearchingMap ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    بحث
                                  </Button>
                                </div>

                                {/* Search Results Dropdown List */}
                                {mapSearchResults.length > 0 && (
                                  <div className="bg-orange-50/80 dark:bg-zinc-800/80 border-b border-orange-200 dark:border-zinc-700 shadow-sm">
                                    <div className="p-2 bg-orange-100/90 dark:bg-orange-950/60 text-[11px] font-bold text-orange-900 dark:text-orange-300 flex items-center justify-between border-b border-orange-200/50">
                                      <span className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-orange-600" />
                                        نتائج البحث المباشرة ({mapSearchResults.length}):
                                      </span>
                                      <button 
                                        type="button"
                                        onClick={() => setMapSearchResults([])} 
                                        className="text-gray-500 hover:text-gray-700 text-[10px] font-medium"
                                      >
                                        إغلاق النتائج ✕
                                      </button>
                                    </div>
                                    <div className="max-h-44 overflow-y-auto divide-y divide-orange-100 dark:divide-zinc-700/50">
                                      {mapSearchResults.map((result: any, idx: number) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          className="w-full text-right p-2.5 hover:bg-orange-100/60 dark:hover:bg-zinc-700 text-xs flex items-center justify-between gap-2 transition-colors"
                                          onClick={() => {
                                            const lat = parseFloat(result.lat);
                                            const lon = parseFloat(result.lon);
                                            handleMapSelect(lat, lon, result.display_name);
                                            setMapSearchResults([]);
                                            setMapSearchQuery('');
                                          }}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded shrink-0">#{idx + 1}</span>
                                            <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{result.display_name}</span>
                                          </div>
                                          <span className="text-[10px] text-white shrink-0 bg-[#f06424] hover:bg-orange-700 px-2.5 py-1 rounded-lg font-bold shadow-xs">تثبيت الموقع</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="h-[380px] w-full">
                                  <MapComponent 
                                    center={[
                                      formData.latitude ? parseFloat(formData.latitude) : 15.3694, 
                                      formData.longitude ? parseFloat(formData.longitude) : 44.1910
                                    ]}
                                    zoom={15}
                                    onLocationSelect={handleMapSelect}
                                  />
                                </div>
                                <div className="p-3 bg-gray-50 text-xs text-center text-gray-600 font-medium border-t">
                                  💡 انقر على أي مكان بالخريطة أو اختر من نتائج البحث لتثبيت الموقع بدقة
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>

                          <div>
                            <Label htmlFor="address" className="text-xs font-semibold">العنوان *</Label>
                            <Input
                              id="address"
                              value={formData.address || ''}
                              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              placeholder="عنوان المتجر الكامل"
                              className="mt-1 h-10 rounded-xl"
                              data-testid="input-restaurant-address"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="latitude" className="text-xs font-semibold">خط العرض</Label>
                              <Input
                                id="latitude"
                                value={formData.latitude || ''}
                                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                placeholder="15.3694"
                                className="mt-1 h-10 rounded-xl text-left"
                                dir="ltr"
                                data-testid="input-latitude"
                              />
                            </div>
                            <div>
                              <Label htmlFor="longitude" className="text-xs font-semibold">خط الطول</Label>
                              <Input
                                id="longitude"
                                value={formData.longitude || ''}
                                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                placeholder="44.1910"
                                className="mt-1 h-10 rounded-xl text-left"
                                dir="ltr"
                                data-testid="input-longitude"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status flags */}
                      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-100 dark:border-zinc-800">حالة المتجر</h3>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              id="isOpen"
                              checked={formData.isOpen || false}
                              onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                              data-testid="checkbox-is-open"
                              className="rounded text-[#f06424]"
                            />
                            <span className="text-xs font-semibold">مفتوح</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              id="isFeatured"
                              checked={formData.isFeatured || false}
                              onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                              data-testid="checkbox-is-featured"
                              className="rounded text-[#f06424]"
                            />
                            <span className="text-xs font-semibold">مميز</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              id="isNew"
                              checked={formData.isNew || false}
                              onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                              data-testid="checkbox-is-new"
                              className="rounded text-[#f06424]"
                            />
                            <span className="text-xs font-semibold">جديد</span>
                          </label>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 sm:p-5 flex items-center justify-end gap-3 z-10 shrink-0">
                  <Button 
                    variant="outline" 
                    className="h-11 px-6 rounded-xl font-bold text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    إلغاء
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="h-11 px-8 rounded-xl gap-2 font-bold bg-[#f06424] hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all"
                    data-testid="button-save"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : (isEditing ? 'حفظ التعديلات' : 'إضافة المتجر')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="البحث في المتاجر..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
                data-testid="input-search-restaurants"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restaurants List */}
      <Card>
        <CardContent className="p-6">
          {filteredRestaurants.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'لا توجد نتائج' : 'لا توجد مطاعم'}
              </h3>
              <p className="text-gray-600">
                {searchTerm ? 'جرب البحث بكلمات مختلفة' : 'ابدأ بإضافة متجر جديد'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRestaurants.map((restaurant: Restaurant) => (
                <Card key={restaurant.id} className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900" data-testid={`text-restaurant-name-${restaurant.id}`}>
                          {restaurant.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">الفئة: {getCategoryName(restaurant.categoryId)}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{restaurant.description}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant={restaurant.isOpen ? "default" : "secondary"}
                          className={restaurant.isOpen ? "bg-green-100 text-green-800" : ""}
                          data-testid={`badge-status-${restaurant.id}`}
                        >
                          {restaurant.isOpen ? "مفتوح" : "مغلق"}
                        </Badge>
                        {restaurant.isFeatured && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                            مفضل
                          </Badge>
                        )}
                        {restaurant.isNew && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                            جديد
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{restaurant.address}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{restaurant.deliveryTime} دقيقة</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span>{restaurant.rating}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>رسوم التوصيل: {restaurant.deliveryFee} </span>
                        <span>الحد الأدنى: {restaurant.minimumOrder} </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(restaurant)}
                        data-testid={`button-edit-${restaurant.id}`}
                      >
                        <Edit className="h-4 w-4 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(restaurant.id)}
                        data-testid={`button-delete-${restaurant.id}`}
                      >
                        <Trash2 className="h-4 w-4 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}