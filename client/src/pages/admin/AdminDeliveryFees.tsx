import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { 
  Truck, 
  Settings, 
  Plus, 
  Trash2, 
  Save,
  Calculator,
  Percent,
  ShieldCheck,
  Layers,
  MapPin,
  Info,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Map as MapIcon,
  Play,
  RotateCcw,
  Clock,
  ArrowRight,
  ShieldAlert,
  Eye,
  Check,
  LocateFixed,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Compass,
  Maximize2,
  Minimize2,
  Pencil,
  Edit
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { apiRequest } from '@/lib/queryClient';
import GeoZoneMapEditor from '@/components/maps/GeoZoneMapEditor';
import GeoZoneOverviewMap from '@/components/maps/GeoZoneOverviewMap';
import OutOfDeliveryZoneModal from '@/components/OutOfDeliveryZoneModal';

interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  minDistance: string;
  maxDistance: string;
  deliveryFee: string;
  estimatedTime?: string;
  isActive: boolean;
}

interface DeliveryFeeSettings {
  id?: string;
  type: 'fixed' | 'per_km' | 'zone_based' | 'geo_zone' | 'hybrid' | 'restaurant_custom';
  baseFee: string;
  perKmFee: string;
  minFee: string;
  maxFee: string;
  freeDeliveryThreshold: string;
}

interface GeoZone {
  id: string;
  name: string;
  description?: string | null;
  coordinates: string; // JSON
  deliveryFee?: string | null;
  surgeMultiplier?: string | null;
  isActive: boolean;
}

interface DeliveryRule {
  id: string;
  name: string;
  ruleType: 'distance' | 'order_value' | 'zone';
  minDistance?: string;
  maxDistance?: string;
  minOrderValue?: string;
  maxOrderValue?: string;
  geoZoneId?: string;
  fee: string;
  isActive: boolean;
  priority: number;
}

interface DeliveryDiscount {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: string;
  minOrderValue?: string;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
}

interface SimulationResult {
  fee: number;
  distance: number;
  estimatedTime: string;
  calculationMethod: string;
  feeBreakdown: {
    baseFee: number;
    distanceFee: number;
    totalBeforeLimit: number;
  };
  isFreeDelivery: boolean;
  freeDeliveryReason?: string;
  matchedGeoZone?: {
    id: string;
    name: string;
    deliveryFee?: number;
    surgeMultiplier?: number;
  };
  matchedDeliveryZone?: {
    id: string;
    name: string;
    minDistance: string;
    maxDistance: string;
    deliveryFee: string;
  };
  appliedRule?: {
    id: string;
    name: string;
    ruleType: string;
    fee: string;
  };
  appliedDiscount?: {
    id: string;
    name: string;
    discountType: string;
    discountValue: string;
  };
  surgeMultiplierApplied?: number;
}

const PRESET_TEST_POINTS = [
  { name: 'صنعاء - حدة (شارع الستين الجنوبي)', lat: 15.3180, lng: 44.1950 },
  { name: 'صنعاء - التحرير وباب اليمن', lat: 15.3550, lng: 44.2080 },
  { name: 'صنعاء - مذبح وشارع الستين الغربي', lat: 15.3780, lng: 44.1700 },
  { name: 'صنعاء - الحصبة وشارع المطار', lat: 15.4100, lng: 44.2150 },
  { name: 'صنعاء - شملان وضواحيها', lat: 15.4150, lng: 44.1450 },
];

export default function AdminDeliveryFees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('settings');

  // Queries
  const { data: settings } = useQuery<DeliveryFeeSettings>({
    queryKey: ['/api/delivery-fees/settings'],
  });

  const { data: zones = [], isLoading: zonesLoading } = useQuery<DeliveryZone[]>({
    queryKey: ['/api/delivery-fees/zones'],
  });

  const { data: geoZones = [], isLoading: geoZonesLoading } = useQuery<GeoZone[]>({
    queryKey: ['/api/delivery-fees/geo-zones'],
  });

  const { data: deliveryRules = [], isLoading: rulesLoading } = useQuery<DeliveryRule[]>({
    queryKey: ['/api/delivery-fees/rules'],
  });

  const { data: discounts = [], isLoading: discountsLoading } = useQuery<DeliveryDiscount[]>({
    queryKey: ['/api/delivery-fees/discounts'],
  });

  // Modal Dialogs
  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isEditZoneOpen, setIsEditZoneOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<{
    id: string;
    name: string;
    description: string;
    minDistance: string;
    maxDistance: string;
    deliveryFee: string;
    estimatedTime: string;
    isActive: boolean;
  } | null>(null);

  const [isAddGeoZoneOpen, setIsAddGeoZoneOpen] = useState(false);
  const [isEditGeoZoneOpen, setIsEditGeoZoneOpen] = useState(false);
  const [editingGeoZone, setEditingGeoZone] = useState<{
    id: string;
    name: string;
    description: string;
    coordinates: string;
    deliveryFee: string;
    surgeMultiplier: string;
    isActive: boolean;
  } | null>(null);

  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isAddDiscountOpen, setIsAddDiscountOpen] = useState(false);

  // Settings state
  const [formSettings, setFormSettings] = useState<DeliveryFeeSettings>({
    type: 'hybrid',
    baseFee: '500',
    perKmFee: '150',
    minFee: '400',
    maxFee: '5000',
    freeDeliveryThreshold: '20000',
  });

  useEffect(() => {
    if (settings) {
      setFormSettings(settings);
    }
  }, [settings]);

  // Form states for new items
  const [newZone, setNewZone] = useState({
    name: '',
    description: '',
    minDistance: '0',
    maxDistance: '5',
    deliveryFee: '500',
    estimatedTime: '20-30 دقيقة'
  });

  const [newGeoZone, setNewGeoZone] = useState<{
    name: string;
    description: string;
    coordinates: string;
    deliveryFee: string;
    surgeMultiplier: string;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    coordinates: '',
    deliveryFee: '1000',
    surgeMultiplier: '1.00',
    isActive: true
  });

  const [newRule, setNewRule] = useState<Partial<DeliveryRule>>({
    name: '',
    ruleType: 'distance',
    fee: '1000',
    priority: 1,
    isActive: true
  });

  const [newDiscount, setNewDiscount] = useState<Partial<DeliveryDiscount>>({
    name: '',
    discountType: 'percentage',
    discountValue: '20',
    minOrderValue: '5000',
    isActive: true
  });

  // Simulator state
  const [testLocation, setTestLocation] = useState<{ lat: number; lng: number }>({
    lat: 15.3180,
    lng: 44.1950
  });
  const [testSubtotal, setTestSubtotal] = useState<string>('6000');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Zone Restriction Settings state
  const { data: zoneRestrictionData } = useQuery<{
    enableRestriction: boolean;
    maxDistanceKm: number;
    restrictionMode: string;
    geoZonesCount: number;
    activeGeoZonesCount: number;
    centerLat?: number;
    centerLng?: number;
  }>({
    queryKey: ['/api/delivery-fees/zone-restriction'],
  });

  const [enableZoneRestriction, setEnableZoneRestriction] = useState(true);
  const [maxDistanceKm, setMaxDistanceKm] = useState('25');
  const [restrictionMode, setRestrictionMode] = useState('both');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number }>({
    lat: 15.3694,
    lng: 44.1910
  });
  const [mapFlyTarget, setMapFlyTarget] = useState<[number, number] | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  useEffect(() => {
    if (zoneRestrictionData) {
      setEnableZoneRestriction(zoneRestrictionData.enableRestriction ?? true);
      setMaxDistanceKm(String(zoneRestrictionData.maxDistanceKm ?? '25'));
      setRestrictionMode(zoneRestrictionData.restrictionMode || 'both');
      if (zoneRestrictionData.centerLat && zoneRestrictionData.centerLng) {
        setPinLocation({
          lat: Number(zoneRestrictionData.centerLat),
          lng: Number(zoneRestrictionData.centerLng)
        });
        setMapFlyTarget([Number(zoneRestrictionData.centerLat), Number(zoneRestrictionData.centerLng)]);
      }
    }
  }, [zoneRestrictionData]);

  const saveZoneRestrictionMutation = useMutation({
    mutationFn: async (data: { 
      enableRestriction: boolean; 
      maxDistanceKm: number; 
      restrictionMode: string;
      centerLat?: number;
      centerLng?: number;
    }) => {
      const res = await apiRequest('POST', '/api/delivery-fees/zone-restriction', data);
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: 'تم حفظ وتطبيق دبوس ونطاق التوصيل بنجاح ✅',
        description: res.message || 'تم تحديث الدبوس والمسافة ونطاق التوصيل وتطبيقها فوراً على تطبيق العميل'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/zone-restriction'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ui-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/settings'] });
    },
    onError: (err: any) => {
      toast({
        title: 'خطأ في حفظ الإعدادات',
        description: err.message,
        variant: 'destructive'
      });
    }
  });

  const handleLocateCurrentPosition = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'خاصية تحديد الموقع غير متوفرة',
        description: 'متصفحك لا يدعم الوصول للموقع الجغرافي',
        variant: 'destructive'
      });
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const newLat = Number(pos.coords.latitude.toFixed(6));
        const newLng = Number(pos.coords.longitude.toFixed(6));
        setPinLocation({ lat: newLat, lng: newLng });
        setMapFlyTarget([newLat, newLng]);
        toast({
          title: 'تم تحديد موقعك بدقة 📍',
          description: `تم نقل دبوس مركز التوصيل إلى إحداثياتك (${newLat}, ${newLng})`
        });
      },
      (err) => {
        setIsLocatingGps(false);
        toast({
          title: 'تعذر تحديد الموقع',
          description: 'يرجى التأكد من تفعيل إذن الموقع في متصفحك',
          variant: 'destructive'
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const STORE_PIN_PRESETS = [
    { name: 'صنعاء - السبعين وحدّة', lat: 15.3180, lng: 44.1950 },
    { name: 'صنعاء - التحرير وباب اليمن', lat: 15.3550, lng: 44.2080 },
    { name: 'صنعاء - مذبح والستين', lat: 15.3780, lng: 44.1700 },
    { name: 'صنعاء - الحصبة والمطار', lat: 15.4100, lng: 44.2150 },
    { name: 'عدن - المنصورة', lat: 12.8600, lng: 44.9850 },
    { name: 'عدن - كريتر والمعلا', lat: 12.7850, lng: 45.0350 },
    { name: 'تعز - المركز والجمهوري', lat: 13.5780, lng: 44.0150 },
    { name: 'حضرموت - المكلا', lat: 14.5400, lng: 49.1250 },
  ];

  const handleApplyPinPreset = (preset: { name: string; lat: number; lng: number }) => {
    setPinLocation({ lat: preset.lat, lng: preset.lng });
    setMapFlyTarget([preset.lat, preset.lng]);
    toast({
      title: `تم نقل الدبوس إلى ${preset.name} 📍`,
      description: `الإحداثيات: ${preset.lat}, ${preset.lng}`
    });
  };

  const handleAdjustDistance = (deltaKm: number) => {
    const current = parseFloat(maxDistanceKm) || 25;
    const nextVal = Math.max(1, Math.min(100, Number((current + deltaKm).toFixed(1))));
    setMaxDistanceKm(String(nextVal));
  };

  // Mutations
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: DeliveryFeeSettings) => {
      const normalizedData = {
        ...data,
        baseFee: data.baseFee ? parseFloat(data.baseFee).toString() : '0',
        perKmFee: data.perKmFee ? parseFloat(data.perKmFee).toString() : '0',
        minFee: data.minFee ? parseFloat(data.minFee).toString() : '0',
        maxFee: data.maxFee ? parseFloat(data.maxFee).toString() : '0',
        freeDeliveryThreshold: data.freeDeliveryThreshold ? parseFloat(data.freeDeliveryThreshold).toString() : '0',
      };
      const response = await apiRequest('POST', '/api/delivery-fees/settings', normalizedData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'تم حفظ الإعدادات بنجاح ✅',
        description: data.message || 'تم تحديث قواعد وطرق حساب رسوم التوصيل بنجاح'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/settings'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'خطأ في حفظ الإعدادات ❌', 
        description: error.message || 'تعذر حفظ الإعدادات',
        variant: 'destructive'
      });
    }
  });

  // Add Distance Zone Mutation
  const addZoneMutation = useMutation({
    mutationFn: async (data: typeof newZone) => {
      const response = await apiRequest('POST', '/api/delivery-fees/zones', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تمت إضافة شريحة المسافة بنجاح ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/zones'] });
      setIsAddZoneOpen(false);
      setNewZone({
        name: '',
        description: '',
        minDistance: '',
        maxDistance: '',
        deliveryFee: '',
        estimatedTime: ''
      });
    },
    onError: (err: any) => {
      toast({ title: 'خطأ في إضافة الشريحة', description: err.message, variant: 'destructive' });
    }
  });

  // Seed Default Distance Zones Mutation
  const seedDistanceZonesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/delivery-fees/zones/seed-defaults', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'تم إنشاء شرائح المسافات الافتراضية بنجاح 🎯',
        description: `تمت إضافة ${data.count} شرائح للمسافات`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/zones'] });
    }
  });

  // Add Geo-Zone Mutation
  const addGeoZoneMutation = useMutation({
    mutationFn: async (data: typeof newGeoZone) => {
      if (!data.name.trim()) throw new Error('اسم المنطقة مطلوب');
      if (!data.coordinates || data.coordinates === '[]') {
        throw new Error('يرجى تحديد المنطقة على الخريطة أولاً');
      }
      const response = await apiRequest('POST', '/api/delivery-fees/geo-zones', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تمت إضافة المنطقة الجغرافية بنجاح ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/geo-zones'] });
      setIsAddGeoZoneOpen(false);
      setNewGeoZone({
        name: '',
        description: '',
        coordinates: '',
        deliveryFee: '1000',
        surgeMultiplier: '1.00',
        isActive: true
      });
    },
    onError: (err: any) => {
      toast({ title: 'خطأ في حفظ المنطقة', description: err.message, variant: 'destructive' });
    }
  });

  // Seed Default Geo-Zones Mutation
  const seedGeoZonesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/delivery-fees/geo-zones/seed-defaults', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'تم إنشاء مناطق العاصمة الافتراضية بنجاح 🗺️',
        description: `تمت إضافة ${data.count} مناطق جغرافية تشمل حدة، التحرير، مذبح، والمطار`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/geo-zones'] });
    }
  });

  // Add Dynamic Rule Mutation
  const addRuleMutation = useMutation({
    mutationFn: async (data: Partial<DeliveryRule>) => {
      const response = await apiRequest('POST', '/api/delivery-fees/rules', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تمت إضافة القاعدة الديناميكية بنجاح ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/rules'] });
      setIsAddRuleOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'خطأ في حفظ القاعدة', description: err.message, variant: 'destructive' });
    }
  });

  // Add Discount Mutation
  const addDiscountMutation = useMutation({
    mutationFn: async (data: Partial<DeliveryDiscount>) => {
      const response = await apiRequest('POST', '/api/delivery-fees/discounts', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تمت إضافة الخصم بنجاح ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/discounts'] });
      setIsAddDiscountOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'خطأ في حفظ الخصم', description: err.message, variant: 'destructive' });
    }
  });

  // Update Distance Zone Mutation
  const updateZoneMutation = useMutation({
    mutationFn: async (data: NonNullable<typeof editingZone>) => {
      if (!data.name.trim()) throw new Error('اسم الشريحة مطلوب');
      const response = await apiRequest('PUT', `/api/delivery-fees/zones/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تم حفظ وتحديث شريحة المسافة بنجاح ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/zones'] });
      setIsEditZoneOpen(false);
      setEditingZone(null);
    },
    onError: (err: any) => {
      toast({ title: 'خطأ في تعديل شريحة المسافة', description: err.message, variant: 'destructive' });
    }
  });

  // Update Geo-Zone Mutation
  const updateGeoZoneMutation = useMutation({
    mutationFn: async (data: NonNullable<typeof editingGeoZone>) => {
      if (!data.name.trim()) throw new Error('اسم المنطقة الجغرافية مطلوب');
      if (!data.coordinates || data.coordinates === '[]') {
        throw new Error('يرجى تحديد حدود المنطقة على الخريطة');
      }
      const response = await apiRequest('PATCH', `/api/delivery-fees/geo-zones/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'تم حفظ وتحديث المنطقة الجغرافية بنجاح ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/geo-zones'] });
      setIsEditGeoZoneOpen(false);
      setEditingGeoZone(null);
    },
    onError: (err: any) => {
      toast({ title: 'خطأ في تعديل المنطقة الجغرافية', description: err.message, variant: 'destructive' });
    }
  });

  // Toggle active status handlers
  const toggleZoneActive = async (zone: any) => {
    try {
      const newStatus = zone.isActive === false ? true : false;
      await apiRequest('PUT', `/api/delivery-fees/zones/${zone.id}`, {
        ...zone,
        isActive: newStatus
      });
      toast({ title: newStatus ? 'تم تفعيل شريحة المسافة بنجاح ✅' : 'تم تعطيل شريحة المسافة ⏸️' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/zones'] });
    } catch (e: any) {
      toast({ title: 'خطأ في تغيير حالة الشريحة', description: e.message, variant: 'destructive' });
    }
  };

  const toggleGeoZoneActive = async (zone: any) => {
    try {
      const newStatus = !zone.isActive;
      await apiRequest('PATCH', `/api/delivery-fees/geo-zones/${zone.id}`, {
        isActive: newStatus
      });
      toast({ title: newStatus ? 'تم تفعيل المنطقة الجغرافية بنجاح ✅' : 'تم تعطيل المنطقة الجغرافية ⏸️' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/geo-zones'] });
    } catch (e: any) {
      toast({ title: 'خطأ في تغيير حالة المنطقة', description: e.message, variant: 'destructive' });
    }
  };

  const handleOpenEditZone = (zone: any) => {
    setEditingZone({
      id: zone.id,
      name: zone.name || '',
      description: zone.description || '',
      minDistance: String(zone.minDistance ?? '0'),
      maxDistance: String(zone.maxDistance ?? '5'),
      deliveryFee: String(zone.deliveryFee ?? '500'),
      estimatedTime: zone.estimatedTime || '20-30 دقيقة',
      isActive: zone.isActive !== false
    });
    setIsEditZoneOpen(true);
  };

  const handleOpenEditGeoZone = (zone: any) => {
    setEditingGeoZone({
      id: zone.id,
      name: zone.name || '',
      description: zone.description || '',
      coordinates: zone.coordinates || '',
      deliveryFee: String(zone.deliveryFee ?? '1000'),
      surgeMultiplier: String(zone.surgeMultiplier ?? '1.00'),
      isActive: zone.isActive !== false
    });
    setIsEditGeoZoneOpen(true);
  };

  // Delete handlers
  const deleteDistanceZone = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/delivery-fees/zones/${id}`, {});
      toast({ title: 'تم حذف شريحة المسافة' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/zones'] });
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    }
  };

  const deleteGeoZone = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/delivery-fees/geo-zones/${id}`, {});
      toast({ title: 'تم حذف المنطقة الجغرافية' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/geo-zones'] });
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/delivery-fees/rules/${id}`, {});
      toast({ title: 'تم حذف القاعدة' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/rules'] });
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    }
  };

  const deleteDiscount = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/delivery-fees/discounts/${id}`, {});
      toast({ title: 'تم حذف الخصم' });
      queryClient.invalidateQueries({ queryKey: ['/api/delivery-fees/discounts'] });
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    }
  };

  // Run Real Calculation Simulation
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const response = await apiRequest('POST', '/api/delivery-fees/calculate', {
        customerLocation: testLocation,
        orderSubtotal: parseFloat(testSubtotal) || 0
      });
      const data: SimulationResult = await response.json();
      setSimulationResult(data);
      toast({
        title: 'تم فحص واحتساب الرسوم بنجاح 🎯',
        description: `الرسوم المحسوبة: ${data.fee} ريال (${data.calculationMethod})`
      });
    } catch (error: any) {
      toast({
        title: 'خطأ في عملية الفحص',
        description: error.message || 'تعذر حساب الرسوم',
        variant: 'destructive'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">إدارة وتحكم رسوم التوصيل</h1>
              <p className="text-sm text-muted-foreground">
                إعداد مناطق المسافات، تحديد المناطق بالخرائط، وضبط القواعد الديناميكية والخصومات
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('simulator')}
            className="flex items-center gap-1.5 text-xs h-9 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Zap className="h-4 w-4" />
            فاحص ومحاكي الرسوم
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/70 gap-1 rounded-xl">
          <TabsTrigger value="settings" className="flex items-center gap-1.5 py-2.5 text-xs md:text-sm">
            <Settings className="h-4 w-4" />
            طريقة الحساب
          </TabsTrigger>
          <TabsTrigger value="zones" className="flex items-center gap-1.5 py-2.5 text-xs md:text-sm">
            <MapPin className="h-4 w-4" />
            مناطق المسافات
            {zones.length > 0 && (
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 h-4">
                {zones.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="geo-zones" className="flex items-center gap-1.5 py-2.5 text-xs md:text-sm">
            <Layers className="h-4 w-4" />
            مناطق الخريطة
            {geoZones.length > 0 && (
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 h-4">
                {geoZones.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="zone-restrictions" className="flex items-center gap-1.5 py-2.5 text-xs md:text-sm font-medium">
            <ShieldAlert className="h-4 w-4 text-[#F05215]" />
            نطاق ومناطق التوصيل المسموح بها
            {enableZoneRestriction && (
              <Badge className="mr-1 text-[10px] px-1.5 py-0 h-4 bg-emerald-600 text-white hover:bg-emerald-600">
                مُفعّل
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="discounts" className="flex items-center gap-1.5 py-2.5 text-xs md:text-sm">
            <Percent className="h-4 w-4" />
            الخصومات
            {discounts.length > 0 && (
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 h-4">
                {discounts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="simulator" className="flex items-center gap-1.5 py-2.5 text-xs md:text-sm bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
            <Zap className="h-4 w-4" />
            المحاكي والاختبار
          </TabsTrigger>
        </TabsList>

        {/* ========================================================
            TAB 1: SETTINGS (General Calculation Mode)
           ======================================================== */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  طريقة ومنهجية حساب رسوم التوصيل
                </CardTitle>
                <CardDescription>
                  اختر النظام المعتمد لحساب تكلفة التوصيل للعملاء
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Method selector */}
                <div className="space-y-2">
                  <Label className="font-semibold text-sm">نظام وطريقة الحساب الأساسية</Label>
                  <Select 
                    value={formSettings.type} 
                    onValueChange={(value: DeliveryFeeSettings['type']) => 
                      setFormSettings(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger className="h-11 font-medium">
                      <SelectValue placeholder="اختر طريقة الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hybrid" className="py-2">
                        🌟 نظام هجين ذكي (مناطق الخريطة أولاً ثم شرائح المسافة ثم الكيلومتر)
                      </SelectItem>
                      <SelectItem value="geo_zone" className="py-2">
                        🗺️ حسب المناطق الجغرافية على الخريطة (Geo-Zones)
                      </SelectItem>
                      <SelectItem value="zone_based" className="py-2">
                        📏 حسب مناطق وشرائح المسافة (0-3كم، 3-7كم، ...)
                      </SelectItem>
                      <SelectItem value="per_km" className="py-2">
                        🚗 حسب المسافة بالكيلومتر (رسوم أساسية + سعر الكيلو)
                      </SelectItem>
                      <SelectItem value="fixed" className="py-2">
                        🏷️ رسوم ثابتة موحدة لجميع الطلبات
                      </SelectItem>
                      <SelectItem value="restaurant_custom" className="py-2">
                        🏪 حسب الإعدادات المخصصة لكل متجر ومطعم
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Rates inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الرسوم الأساسية (ريال)</Label>
                    <Input
                      type="number"
                      value={formSettings.baseFee}
                      onChange={(e) => setFormSettings(prev => ({ ...prev, baseFee: e.target.value }))}
                      placeholder="500"
                    />
                    <p className="text-[11px] text-muted-foreground">تبدأ بها كل رحلة توصيل</p>
                  </div>

                  <div className="space-y-2">
                    <Label>رسوم لكل كيلومتر إضافي (ريال)</Label>
                    <Input
                      type="number"
                      value={formSettings.perKmFee}
                      onChange={(e) => setFormSettings(prev => ({ ...prev, perKmFee: e.target.value }))}
                      placeholder="150"
                    />
                    <p className="text-[11px] text-muted-foreground">تُضرب في مسافة العميل</p>
                  </div>
                </div>

                {/* Min / Max bounds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للرسوم (ريال)</Label>
                    <Input
                      type="number"
                      value={formSettings.minFee}
                      onChange={(e) => setFormSettings(prev => ({ ...prev, minFee: e.target.value }))}
                      placeholder="400"
                    />
                    <p className="text-[11px] text-muted-foreground">لا تقل الرسوم عن هذا المبلغ</p>
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأقصى للرسوم (ريال)</Label>
                    <Input
                      type="number"
                      value={formSettings.maxFee}
                      onChange={(e) => setFormSettings(prev => ({ ...prev, maxFee: e.target.value }))}
                      placeholder="5000"
                    />
                    <p className="text-[11px] text-muted-foreground">سقف أقصى لحماية العميل</p>
                  </div>
                </div>

                {/* Free Delivery Threshold */}
                <div className="space-y-2 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-emerald-800 dark:text-emerald-300 font-semibold">
                      حد التوصيل المجاني للطلبات الكبيرة (ريال)
                    </Label>
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                      عرض ترويجي
                    </span>
                  </div>
                  <Input
                    type="number"
                    value={formSettings.freeDeliveryThreshold}
                    onChange={(e) => setFormSettings(prev => ({ ...prev, freeDeliveryThreshold: e.target.value }))}
                    placeholder="20000"
                    className="bg-white dark:bg-zinc-900"
                  />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    إذا بلغت قيمة الطلب هذا المبلغ أو أكثر، يحصل العميل على توصيل مجاني تلقائياً. (ضع 0 لتعطيل الميزة)
                  </p>
                </div>

                <Button 
                  onClick={() => saveSettingsMutation.mutate(formSettings)}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full h-11 text-base font-semibold"
                >
                  <Save className="h-4 w-4 ml-2" />
                  {saveSettingsMutation.isPending ? 'جاري حفظ الإعدادات...' : 'حفظ وتطبيق الإعدادات'}
                </Button>
              </CardContent>
            </Card>

            {/* Formula & Explanation Preview */}
            <div className="space-y-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    شرح المعادلة المطبقة حالياً
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed">
                  {formSettings.type === 'hybrid' && (
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground text-sm">النظام الذكي الهجين:</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                        <li>يفحص ما إذا كان موقع العميل يقع داخل <strong>منطقة جغرافية بالخريطة</strong> ويطبق رسومها ومعامل ذروتها.</li>
                        <li>إن لم يكن، يفحص <strong>شريحة المسافة</strong> (0-3كم، 3-7كم، ...) المناسبة.</li>
                        <li>إن لم تنطبق شريحة، يحسب بالمعادلة: <code className="bg-primary/10 px-1 py-0.5 rounded text-primary">{formSettings.baseFee} + (المسافة × {formSettings.perKmFee})</code> ريال.</li>
                        <li>يتم تطبيق القواعد الديناميكية وعروض الخصومات والحد الأدنى والأقصى.</li>
                      </ol>
                    </div>
                  )}

                  {formSettings.type === 'geo_zone' && (
                    <p className="text-muted-foreground">
                      يتم البحث عن المنطقة الجغرافية المحددة بالخريطة التي يقع فيها العميل وتطبيق رسومها المحددة ومعامل الذروة الخاص بها.
                    </p>
                  )}

                  {formSettings.type === 'zone_based' && (
                    <p className="text-muted-foreground">
                      يتم حساب المسافة الخطية للعميل، واختيار شريحة المسافة التي تطابق بعده عن المتجر، وتطبيق الرسوم المحددة في جدول مناطق المسافات.
                    </p>
                  )}

                  {formSettings.type === 'per_km' && (
                    <p className="text-muted-foreground">
                      المعادلة: <strong>{formSettings.baseFee} ريال</strong> (أساسية) + <strong>({formSettings.perKmFee} ريال × المسافة بالكيلومتر)</strong>.
                    </p>
                  )}

                  {formSettings.type === 'fixed' && (
                    <p className="text-muted-foreground">
                      رسوم ثابتة موحدة قدرها <strong>{formSettings.baseFee} ريال</strong> لجميع الطلبات بغض النظر عن المسافة.
                    </p>
                  )}

                  <div className="pt-2 border-t border-primary/20 flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span>• نطاق الرسوم المسموح: {formSettings.minFee} إلى {formSettings.maxFee} ريال.</span>
                    {parseFloat(formSettings.freeDeliveryThreshold) > 0 && (
                      <span className="text-emerald-600 font-medium">
                        • التوصيل مجاني للطلبات فوق {formSettings.freeDeliveryThreshold} ريال.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick actions card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">إجراءات سريعة للتجهيز</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-9"
                    onClick={() => seedDistanceZonesMutation.mutate()}
                    disabled={seedDistanceZonesMutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5 ml-2 text-primary" />
                    تعبئة شرائح المسافة الافتراضية (4 شرائح)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-9"
                    onClick={() => seedGeoZonesMutation.mutate()}
                    disabled={seedGeoZonesMutation.isPending}
                  >
                    <MapIcon className="h-3.5 w-3.5 ml-2 text-emerald-600" />
                    تعبئة مناطق العاصمة صنعاء بالخريطة (4 مناطق)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-9"
                    onClick={() => setActiveTab('simulator')}
                  >
                    <Zap className="h-3.5 w-3.5 ml-2 text-amber-500" />
                    اختبار الحساب الآن عبر المحاكي التفاعلي
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================
            TAB 2: DISTANCE ZONES (مناطق المسافات)
           ======================================================== */}
        <TabsContent value="zones" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  شرائح ومناطق المسافات (Distance Zones)
                </CardTitle>
                <CardDescription>
                  تحديد رسوم التوصيل وفق المسافة بالكيلومتر من المتجر إلى موقع العميل
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {zones.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => seedDistanceZonesMutation.mutate()}
                    disabled={seedDistanceZonesMutation.isPending}
                    className="text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 ml-1.5 text-amber-500" />
                    إضافة الشرائح الافتراضية
                  </Button>
                )}

                <Dialog open={isAddZoneOpen} onOpenChange={setIsAddZoneOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs">
                      <Plus className="h-4 w-4 ml-1.5" />
                      إضافة شريحة مسافة جديدة
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>إضافة شريحة مسافة جديدة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label>اسم الشريحة</Label>
                        <Input
                          value={newZone.name}
                          onChange={(e) => setNewZone(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="مثال: الشريحة القريبة (0 - 3 كم)"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>الوصف (اختياري)</Label>
                        <Input
                          value={newZone.description}
                          onChange={(e) => setNewZone(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="الأحياء المجاورة للمطعم"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>من مسافة (كم)</Label>
                          <Input
                            type="number"
                            value={newZone.minDistance}
                            onChange={(e) => setNewZone(prev => ({ ...prev, minDistance: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>إلى مسافة (كم)</Label>
                          <Input
                            type="number"
                            value={newZone.maxDistance}
                            onChange={(e) => setNewZone(prev => ({ ...prev, maxDistance: e.target.value }))}
                            placeholder="5"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>رسوم التوصيل (ريال)</Label>
                          <Input
                            type="number"
                            value={newZone.deliveryFee}
                            onChange={(e) => setNewZone(prev => ({ ...prev, deliveryFee: e.target.value }))}
                            placeholder="500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>الوقت المقدر</Label>
                          <Input
                            value={newZone.estimatedTime}
                            onChange={(e) => setNewZone(prev => ({ ...prev, estimatedTime: e.target.value }))}
                            placeholder="20-30 دقيقة"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={() => addZoneMutation.mutate(newZone)}
                        disabled={addZoneMutation.isPending || !newZone.name || !newZone.deliveryFee}
                        className="w-full"
                      >
                        {addZoneMutation.isPending ? 'جاري الحفظ...' : 'حفظ شريحة المسافة'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* نافذة تعديل شريحة المسافة */}
                <Dialog open={isEditZoneOpen} onOpenChange={setIsEditZoneOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-primary" />
                        تعديل شريحة المسافة وحفظ التغييرات
                      </DialogTitle>
                    </DialogHeader>

                    {editingZone && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                          <Label>اسم الشريحة</Label>
                          <Input
                            value={editingZone.name}
                            onChange={(e) => setEditingZone(prev => prev ? { ...prev, name: e.target.value } : null)}
                            placeholder="مثال: المنطقة القريبة (0-3 كم)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>الوصف (اختياري)</Label>
                          <Input
                            value={editingZone.description}
                            onChange={(e) => setEditingZone(prev => prev ? { ...prev, description: e.target.value } : null)}
                            placeholder="أحياء وسط المدينة..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>من مسافة (كم)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={editingZone.minDistance}
                              onChange={(e) => setEditingZone(prev => prev ? { ...prev, minDistance: e.target.value } : null)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>إلى مسافة (كم)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={editingZone.maxDistance}
                              onChange={(e) => setEditingZone(prev => prev ? { ...prev, maxDistance: e.target.value } : null)}
                              placeholder="5"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>رسوم التوصيل (ريال)</Label>
                            <Input
                              type="number"
                              value={editingZone.deliveryFee}
                              onChange={(e) => setEditingZone(prev => prev ? { ...prev, deliveryFee: e.target.value } : null)}
                              placeholder="500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>الوقت المقدر</Label>
                            <Input
                              value={editingZone.estimatedTime}
                              onChange={(e) => setEditingZone(prev => prev ? { ...prev, estimatedTime: e.target.value } : null)}
                              placeholder="20-30 دقيقة"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">حالة الشريحة</Label>
                            <p className="text-xs text-muted-foreground">
                              {editingZone.isActive ? 'مفعلة وتدخل في حساب الرسوم لتطبيق العميل' : 'معطلة مؤقتاً'}
                            </p>
                          </div>
                          <Switch
                            checked={editingZone.isActive}
                            onCheckedChange={(checked) => setEditingZone(prev => prev ? { ...prev, isActive: checked } : null)}
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            onClick={() => editingZone && updateZoneMutation.mutate(editingZone)}
                            disabled={updateZoneMutation.isPending || !editingZone.name || !editingZone.deliveryFee}
                            className="flex-1 gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {updateZoneMutation.isPending ? 'جاري حفظ التعديل...' : 'حفظ التعديلات وتطبيقها فوراً'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditZoneOpen(false)}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {zonesLoading ? (
                <div className="p-8 text-center text-muted-foreground">جاري تحميل مناطق المسافات...</div>
              ) : zones.length === 0 ? (
                <div className="p-8 text-center border rounded-lg bg-muted/20 space-y-3">
                  <MapPin className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="font-medium">لم يتم تعريف أي شرائح مسافات بعد</p>
                  <p className="text-xs text-muted-foreground">
                    يمكنك إنشاء شرائح قياسية بنقرة واحدة أو إضافة شريحة مخصصة
                  </p>
                  <Button 
                    size="sm"
                    onClick={() => seedDistanceZonesMutation.mutate()}
                    disabled={seedDistanceZonesMutation.isPending}
                  >
                    إنشاء الشرائح الافتراضية الآن (4 شرائح)
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {zones.map((zone) => (
                    <Card key={zone.id} className="border p-4 hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base">{zone.name}</h4>
                            <Badge 
                              variant={zone.isActive !== false ? 'default' : 'secondary'} 
                              className="text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => toggleZoneActive(zone)}
                              title="انقر لتغيير حالة التفعيل"
                            >
                              {zone.isActive !== false ? 'مفعلة' : 'معطلة'}
                            </Badge>
                          </div>
                          {zone.description && (
                            <p className="text-xs text-muted-foreground">{zone.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditZone(zone)}
                            className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/5 flex items-center gap-1"
                            title="تعديل شريحة المسافة"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>تعديل</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteDistanceZone(zone.id)}
                            className="text-destructive hover:bg-destructive/10 h-8 w-8"
                            title="حذف الشريحة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground block text-[10px]">نطاق المسافة</span>
                          <span className="font-bold text-foreground">
                            {zone.minDistance} - {zone.maxDistance} كم
                          </span>
                        </div>
                        <div className="bg-primary/5 p-2 rounded">
                          <span className="text-muted-foreground block text-[10px]">رسوم التوصيل</span>
                          <span className="font-bold text-primary text-sm">
                            {zone.deliveryFee} ريال
                          </span>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground block text-[10px]">الوقت المتوقع</span>
                          <span className="font-medium text-foreground">
                            {zone.estimatedTime || '—'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 3: GEOGRAPHIC ZONES ON MAPS (المناطق الجغرافية)
           ======================================================== */}
        <TabsContent value="geo-zones" className="space-y-6">
          {/* Map Visualizer Card */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="h-5 w-5 text-primary" />
                  خريطة المناطق الجغرافية التفاعلية
                </CardTitle>
                <CardDescription>
                  استعراض جميع المناطق المحددة وتحديد رسوم التوصيل ومعاملات الذروة لكل نطاق
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {geoZones.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => seedGeoZonesMutation.mutate()}
                    disabled={seedGeoZonesMutation.isPending}
                    className="text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 ml-1.5 text-amber-500" />
                    إضافة مناطق صنعاء الافتراضية
                  </Button>
                )}

                <Dialog open={isAddGeoZoneOpen} onOpenChange={setIsAddGeoZoneOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs">
                      <Plus className="h-4 w-4 ml-1.5" />
                      إضافة منطقة جغرافية بالخريطة
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <MapIcon className="h-5 w-5 text-primary" />
                        رسم وتحديد منطقة جغرافية جديدة بالخريطة
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>اسم المنطقة الجغرافية</Label>
                          <Input
                            value={newGeoZone.name}
                            onChange={(e) => setNewGeoZone(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="مثال: منطقة حدة والسبعين"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>وصف المنطقة (اختياري)</Label>
                          <Input
                            value={newGeoZone.description}
                            onChange={(e) => setNewGeoZone(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="الأحياء المشمولة ضمن النطاق"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>رسوم التوصيل لهذه المنطقة (ريال)</Label>
                          <Input
                            type="number"
                            value={newGeoZone.deliveryFee}
                            onChange={(e) => setNewGeoZone(prev => ({ ...prev, deliveryFee: e.target.value }))}
                            placeholder="1000"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            الرسوم المطبقة عندما يكون عنوان العميل داخل هذه المنطقة
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>معامل زيادة الذروة (Surge Multiplier)</Label>
                          <Input
                            type="number"
                            step="0.05"
                            min="1.0"
                            value={newGeoZone.surgeMultiplier}
                            onChange={(e) => setNewGeoZone(prev => ({ ...prev, surgeMultiplier: e.target.value }))}
                            placeholder="1.00"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            1.00 = عادي | 1.20 = زيادة 20% في الذروة أو للمناطق البعيدة
                          </p>
                        </div>
                      </div>

                      {/* Interactive Map Picker */}
                      <div className="space-y-1.5">
                        <Label className="font-semibold text-sm">حدد نطاق المنطقة على الخريطة:</Label>
                        <GeoZoneMapEditor
                          existingZones={geoZones}
                          onChange={(coords) => setNewGeoZone(prev => ({ ...prev, coordinates: coords }))}
                          height="360px"
                        />
                      </div>

                      <Button
                        onClick={() => addGeoZoneMutation.mutate(newGeoZone)}
                        disabled={addGeoZoneMutation.isPending || !newGeoZone.name || !newGeoZone.coordinates}
                        className="w-full h-11 text-base font-semibold"
                      >
                        {addGeoZoneMutation.isPending ? 'جاري حفظ المنطقة...' : 'حفظ المنطقة الجغرافية'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* نافذة تعديل المنطقة الجغرافية */}
                <Dialog open={isEditGeoZoneOpen} onOpenChange={setIsEditGeoZoneOpen}>
                  <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-primary" />
                        تعديل المنطقة الجغرافية والرسوم وحدود الخريطة
                      </DialogTitle>
                    </DialogHeader>

                    {editingGeoZone && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>اسم المنطقة الجغرافية</Label>
                            <Input
                              value={editingGeoZone.name}
                              onChange={(e) => setEditingGeoZone(prev => prev ? { ...prev, name: e.target.value } : null)}
                              placeholder="مثال: منطقة حدة والسبعين"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>وصف المنطقة (اختياري)</Label>
                            <Input
                              value={editingGeoZone.description}
                              onChange={(e) => setEditingGeoZone(prev => prev ? { ...prev, description: e.target.value } : null)}
                              placeholder="الأحياء المشمولة ضمن النطاق"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>رسوم التوصيل لهذه المنطقة (ريال)</Label>
                            <Input
                              type="number"
                              value={editingGeoZone.deliveryFee}
                              onChange={(e) => setEditingGeoZone(prev => prev ? { ...prev, deliveryFee: e.target.value } : null)}
                              placeholder="1000"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              الرسوم المطبقة عندما يكون عنوان العميل داخل هذه المنطقة
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label>معامل زيادة الذروة (افتراضي: 1.00)</Label>
                            <Input
                              type="number"
                              step="0.05"
                              value={editingGeoZone.surgeMultiplier}
                              onChange={(e) => setEditingGeoZone(prev => prev ? { ...prev, surgeMultiplier: e.target.value } : null)}
                              placeholder="1.00"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              1.00 = رسوم عادية، 1.20 = زيادة 20% في أوقات الذروة
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">حالة المنطقة</Label>
                            <p className="text-xs text-muted-foreground">
                              {editingGeoZone.isActive ? 'مفعلة وتدخل في حساب الرسوم ونطاق التوصيل المسموح به' : 'معطلة مؤقتاً'}
                            </p>
                          </div>
                          <Switch
                            checked={editingGeoZone.isActive}
                            onCheckedChange={(checked) => setEditingGeoZone(prev => prev ? { ...prev, isActive: checked } : null)}
                          />
                        </div>

                        {/* Interactive Map Editor pre-loaded with current zone coordinates */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">تعديل حدود المنطقة على الخريطة</Label>
                            <span className="text-xs text-muted-foreground">
                              يمكنك تحريك المركز أو تغيير نصف القطر أو إعادة رسم المضلع
                            </span>
                          </div>
                          <GeoZoneMapEditor
                            initialCoordinates={editingGeoZone.coordinates}
                            existingZones={geoZones.filter(z => z.id !== editingGeoZone.id)}
                            onChange={(coordsJson) => {
                              setEditingGeoZone(prev => prev ? { ...prev, coordinates: coordsJson } : null);
                            }}
                            height="380px"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            onClick={() => editingGeoZone && updateGeoZoneMutation.mutate(editingGeoZone)}
                            disabled={updateGeoZoneMutation.isPending || !editingGeoZone.name || !editingGeoZone.coordinates}
                            className="flex-1 h-11 text-base font-semibold gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {updateGeoZoneMutation.isPending ? 'جاري حفظ التعديلات...' : 'حفظ تعديلات المنطقة الجغرافية وتطبيقها فوراً'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditGeoZoneOpen(false)}
                            className="h-11 px-5"
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overview Map */}
              <GeoZoneOverviewMap
                zones={geoZones}
                height="400px"
              />

              {/* Zones Cards Grid */}
              <div className="pt-2">
                <h3 className="font-semibold text-sm mb-3">قائمة المناطق الجغرافية المعرفة ({geoZones.length}):</h3>
                {geoZonesLoading ? (
                  <p className="text-sm text-muted-foreground">جاري تحميل المناطق...</p>
                ) : geoZones.length === 0 ? (
                  <div className="text-center p-6 border rounded-lg bg-muted/20">
                    <p className="text-sm text-muted-foreground">لا توجد مناطق جغرافية مسجلة بعد.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-xs"
                      onClick={() => seedGeoZonesMutation.mutate()}
                    >
                      إضافة مناطق صنعاء الافتراضية
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {geoZones.map((zone) => {
                      let typeLabel = 'مضلع حدودي';
                      try {
                        const parsed = JSON.parse(zone.coordinates);
                        if (parsed?.type === 'circle' || parsed?.center) {
                          typeLabel = `دائري (${parsed.radiusKm || 5} كم)`;
                        }
                      } catch (e) {}

                      return (
                        <Card key={zone.id} className="p-4 border hover:border-primary/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm">{zone.name}</h4>
                                <Badge 
                                  variant={zone.isActive !== false ? 'default' : 'secondary'} 
                                  className="text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => toggleGeoZoneActive(zone)}
                                  title="انقر لتغيير حالة التفعيل"
                                >
                                  {zone.isActive !== false ? 'مفعلة' : 'معطلة'}
                                </Badge>
                              </div>
                              {zone.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{zone.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditGeoZone(zone)}
                                className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/5 flex items-center gap-1"
                                title="تعديل المنطقة الجغرافية"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteGeoZone(zone.id)}
                                className="text-destructive hover:bg-destructive/10 h-7 w-7"
                                title="حذف المنطقة"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {typeLabel}
                            </Badge>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-primary">
                                {zone.deliveryFee || 0} ريال
                              </span>
                              {zone.surgeMultiplier && parseFloat(zone.surgeMultiplier) > 1 && (
                                <Badge variant="secondary" className="text-[10px] text-amber-600 bg-amber-50">
                                  ×{zone.surgeMultiplier}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 4: ALLOWED DELIVERY ZONES & RESTRICTIONS (نطاق ومناطق التوصيل المسموح بها)
           ======================================================== */}
        <TabsContent value="zone-restrictions" className="space-y-6">
          {/* Card 1: Main Restriction Settings */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5 text-[#F05215]" />
                  إدارة نطاق ومناطق التوصيل المسموح بها
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  التحكم في حظر الطلبات التي تقع خارج المناطق المعتمدة لمنع استقبالها في لوحة التحكم وتنبيه العميل فوراً
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="border-[#F05215]/40 text-[#C73208] hover:bg-[#F05215]/10 text-xs font-semibold"
                >
                  <Eye className="h-3.5 w-3.5 ml-1.5" />
                  معاينة تنبيه العميل
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveZoneRestrictionMutation.mutate({
                    enableRestriction: enableZoneRestriction,
                    maxDistanceKm: parseFloat(maxDistanceKm) || 25,
                    restrictionMode
                  })}
                  disabled={saveZoneRestrictionMutation.isPending}
                  className="bg-[#F05215] hover:bg-[#C03A0A] text-white text-xs font-semibold"
                >
                  <Save className="h-3.5 w-3.5 ml-1.5" />
                  {saveZoneRestrictionMutation.isPending ? 'جاري الحفظ...' : 'حفظ وتطبيق التغييرات'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-2">
              {/* Master Switch */}
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="font-bold text-base cursor-pointer">
                      تفعيل نظام منع وحظر الطلبات خارج نطاق التوصيل
                    </Label>
                    <Badge variant={enableZoneRestriction ? 'default' : 'outline'} className={enableZoneRestriction ? 'bg-emerald-600 text-white' : ''}>
                      {enableZoneRestriction ? 'نظام الحظر نشط' : 'نظام الحظر معطل'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    عند التفعيل، لن يتمكن أي عميل يقع خارج المناطق المعتمدة من تأكيد الطلب، وستظهر له نافذة التنبيه المنبثقة وزر تغيير الموقع.
                  </p>
                </div>
                <Switch
                  checked={enableZoneRestriction}
                  onCheckedChange={setEnableZoneRestriction}
                  className="data-[state=checked]:bg-[#F05215]"
                />
              </div>

              {/* Mode & Max Distance Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-sm">منهجية وطريقة تحديد النطاق المسموح</Label>
                  <Select
                    value={restrictionMode}
                    onValueChange={setRestrictionMode}
                  >
                    <SelectTrigger className="h-11 font-medium">
                      <SelectValue placeholder="اختر طريقة تقييد النطاق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both" className="py-2.5">
                        🌟 كلاهما معاً (ضمن مناطق الخريطة + أقصى مسافة بالكيلومتر) [موصى به]
                      </SelectItem>
                      <SelectItem value="geo_zones" className="py-2.5">
                        🗺️ حسب المناطق الجغرافية المحددة بالخريطة فقط (Geo-Zones)
                      </SelectItem>
                      <SelectItem value="max_distance" className="py-2.5">
                        📏 حسب أقصى مسافة توصيل بالكيلومتر فقط من موقع المتجر
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {restrictionMode === 'both' && 'يُسمح بالتوصيل فقط إذا كان موقع العميل يقع داخل إحدى مناطق الخريطة ولا يتجاوز أقصى مسافة مسموحة.'}
                    {restrictionMode === 'geo_zones' && 'يجب أن يكون موقع العميل بدقة داخل إحدى المناطق الجغرافية المعتمدة على الخريطة أدناه.'}
                    {restrictionMode === 'max_distance' && 'يُسمح بالطلب لأي موقع لا تتجاوز المسافة المحسوبة إليه الحد الأقصى المحدد بالكيلومتر.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-sm">أقصى مسافة توصيل مسموحة (كم)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      value={maxDistanceKm}
                      onChange={(e) => setMaxDistanceKm(e.target.value)}
                      placeholder="25"
                      className="h-11 pr-3 pl-12 font-bold"
                    />
                    <span className="absolute left-3 top-3 text-xs text-muted-foreground font-semibold">كم</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    المسافة القصوى التي يقبل النظام توصيل الطلبات إليها (افتراضياً 25 كم).
                  </p>
                </div>
              </div>

              {/* Functional Explanation Notice */}
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
                  <Info className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>آلية التنفيذ والحماية في تطبيق العميل:</span>
                </div>
                <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1.5 list-disc list-inside pr-1 leading-relaxed">
                  <li><strong>فحص فوري عند اختيار الموقع:</strong> بمجرد تحديد العميل لموقعه على الخريطة في صفحة السلة، يفحص الخادم إحداثياته فوراً مقابل المناطق المعتمدة.</li>
                  <li><strong>حظر الإرسال إلى لوحة التحكم:</strong> يتم تعطيل زر "تأكيد الطلب" ويُرفض أي طلب قادم من خارج النطاق تلقائياً مع كود <code className="bg-amber-200/50 px-1 py-0.5 rounded font-mono">OUT_OF_DELIVERY_ZONE</code>.</li>
                  <li><strong>رسالة التنبيه المنبثقة:</strong> تظهر النافذة التصميمية المعتمدة (مع الرمز التعبيري الحزين) وزر فوري <span className="font-bold">"تغيير الموقع"</span> للعودة للخريطة واختيار موقع متاح.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Interactive Map with Pin, Distance Scaling & Radius Controls */}
          <Card className="border-2 border-[#F05215]/30 shadow-sm">
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-[#F05215]" />
                  <span>دبوس مركز التوصيل وتكبير/تصغير نطاق المسافة على الخريطة</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  انقر على أي نقطة بالخريطة أو اسحب الدبوس 📍 لتحديد مركز المتجر، وتحكّم في تكبير وتصغير دائرة المسافة المسموحة بالكيلومتر ليتم تطبيقها فوراً على تطبيق العميل
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLocateCurrentPosition}
                  disabled={isLocatingGps}
                  className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold"
                >
                  <LocateFixed className={`h-3.5 w-3.5 ml-1.5 ${isLocatingGps ? 'animate-spin' : ''}`} />
                  {isLocatingGps ? 'جاري التحديد...' : 'موقعي الحالي (GPS)'}
                </Button>

                <Button
                  size="sm"
                  onClick={() => saveZoneRestrictionMutation.mutate({
                    enableRestriction: enableZoneRestriction,
                    maxDistanceKm: parseFloat(maxDistanceKm) || 25,
                    restrictionMode,
                    centerLat: pinLocation.lat,
                    centerLng: pinLocation.lng
                  })}
                  disabled={saveZoneRestrictionMutation.isPending}
                  className="bg-[#F05215] hover:bg-[#C03A0A] text-white text-xs font-semibold"
                >
                  <Save className="h-3.5 w-3.5 ml-1.5" />
                  {saveZoneRestrictionMutation.isPending ? 'جاري الحفظ...' : 'حفظ وتطبيق الدبوس والمسافة'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Quick City Presets */}
              <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-muted/40 rounded-xl border">
                <span className="text-xs font-bold text-muted-foreground ml-2 flex items-center gap-1 shrink-0">
                  <Compass className="h-3.5 w-3.5 text-[#F05215]" />
                  مراكز ومواقع سريعة:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {STORE_PIN_PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPinPreset(preset)}
                      className="h-7 px-2.5 text-[11px] rounded-full hover:border-[#F05215] hover:text-[#F05215] transition-colors"
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Distance Scaling & Fine Tuning Bar */}
              <div className="bg-card p-4 rounded-xl border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <ZoomIn className="h-4 w-4 text-[#F05215]" />
                        <span>تكبير وتصغير مسافة التوصيل المسموح بها</span>
                      </h4>
                      <Badge className="bg-[#F05215] text-white text-xs px-2 py-0.5 font-bold">
                        {maxDistanceKm} كم
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      حرّك شريط التمرير أو استخدم أزرار الزيادة والنقصان لتكبير أو تصغير دائرة التغطية على الخريطة
                    </p>
                  </div>

                  {/* Increment / Decrement Stepper */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/50 p-1 rounded-lg border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdjustDistance(-5)}
                      className="h-8 px-2 text-xs font-bold hover:bg-background"
                      title="تصغير المسافة بـ 5 كم"
                    >
                      -5 كم
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdjustDistance(-1)}
                      className="h-8 px-2.5 text-xs font-bold hover:bg-background"
                      title="تصغير المسافة بـ 1 كم"
                    >
                      -1 كم
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdjustDistance(1)}
                      className="h-8 px-2.5 text-xs font-bold text-[#F05215] hover:bg-background"
                      title="تكبير المسافة بـ 1 كم"
                    >
                      +1 كم
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdjustDistance(5)}
                      className="h-8 px-2 text-xs font-bold text-[#F05215] hover:bg-background"
                      title="تكبير المسافة بـ 5 كم"
                    >
                      +5 كم
                    </Button>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-2 pt-1">
                  <Slider
                    value={[parseFloat(maxDistanceKm) || 25]}
                    min={1}
                    max={50}
                    step={0.5}
                    onValueChange={(val) => setMaxDistanceKm(String(val[0]))}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                    <span>1 كم (نطاق ضيق)</span>
                    <span>15 كم</span>
                    <span className="font-bold text-[#F05215]">25 كم (الافتراضي)</span>
                    <span>35 كم</span>
                    <span>50 كم (أقصى نطاق)</span>
                  </div>
                </div>

                {/* Quick Distance Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground font-medium">مسافات جاهزة:</span>
                  {[3, 5, 8, 10, 15, 20, 25, 30, 40, 50].map((dist) => (
                    <Button
                      key={dist}
                      type="button"
                      variant={parseFloat(maxDistanceKm) === dist ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMaxDistanceKm(String(dist))}
                      className={`h-6 px-2 text-[11px] rounded-md ${
                        parseFloat(maxDistanceKm) === dist ? 'bg-[#F05215] text-white' : ''
                      }`}
                    >
                      {dist} كم
                    </Button>
                  ))}
                </div>

                {/* Live Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-muted/40 rounded-lg border text-right">
                    <span className="text-[11px] text-muted-foreground block">إحداثيات الدبوس (المركز)</span>
                    <span className="font-mono text-xs font-bold text-foreground block mt-0.5">
                      {pinLocation.lat.toFixed(5)}, {pinLocation.lng.toFixed(5)}
                    </span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg border text-right">
                    <span className="text-[11px] text-muted-foreground block">مساحة التغطية المسموحة</span>
                    <span className="font-mono text-xs font-bold text-[#F05215] block mt-0.5">
                      ~{Math.round(Math.PI * Math.pow(parseFloat(maxDistanceKm) || 25, 2)).toLocaleString()} كم²
                    </span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg border text-right">
                    <span className="text-[11px] text-muted-foreground block">أقصى وقت متوقع للوصول</span>
                    <span className="font-mono text-xs font-bold text-foreground block mt-0.5">
                      ~{Math.round((parseFloat(maxDistanceKm) || 25) * 1.8 + 10)} دقيقة
                    </span>
                  </div>
                </div>
              </div>

              {/* The Interactive Map */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Crosshair className="h-3.5 w-3.5 text-[#F05215]" />
                    الخريطة التفاعلية المباشرة:
                  </span>
                  <span>
                    اسحب الدبوس 📍 أو انقر في أي مكان لتغيير مركز التوصيل
                  </span>
                </div>

                <div className="rounded-xl overflow-hidden border shadow-xs">
                  <GeoZoneOverviewMap
                    zones={geoZones}
                    storeLocation={pinLocation}
                    deliveryRadiusKm={parseFloat(maxDistanceKm) || 25}
                    draggableStorePin={true}
                    onStorePinDragEnd={(lat, lng) => setPinLocation({ lat, lng })}
                    onMapClick={(lat, lng) => setPinLocation({ lat, lng })}
                    flyToTarget={mapFlyTarget}
                    height="420px"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/20 border rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#F05215]" />
                    <span>الدبوس البرتقالي: مركز المتجر</span>
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-[#F05215] border-dashed ml-2" />
                    <span>الدائرة المتقطعة: أقصى مسافة ({maxDistanceKm} كم)</span>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => saveZoneRestrictionMutation.mutate({
                      enableRestriction: enableZoneRestriction,
                      maxDistanceKm: parseFloat(maxDistanceKm) || 25,
                      restrictionMode,
                      centerLat: pinLocation.lat,
                      centerLng: pinLocation.lng
                    })}
                    disabled={saveZoneRestrictionMutation.isPending}
                    className="w-full sm:w-auto bg-[#F05215] hover:bg-[#C03A0A] text-white text-xs font-semibold px-5"
                  >
                    <Save className="h-3.5 w-3.5 ml-1.5" />
                    {saveZoneRestrictionMutation.isPending ? 'جاري الحفظ والتطبيق...' : 'حفظ وتطبيق دبوس ونطاق التوصيل في تطبيق العميل'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Interactive Allowed Delivery Zones on Map */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  المناطق الجغرافية المعتمدة للتوصيل ({geoZones.filter(z => z.isActive).length} منطقة نشطة)
                </CardTitle>
                <CardDescription>
                  رسم وتحديد مضلعات ونطاقات التوصيل المسموح بها وحفظها أو حذفها
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {geoZones.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => seedGeoZonesMutation.mutate()}
                    disabled={seedGeoZonesMutation.isPending}
                    className="text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 ml-1.5 text-amber-500" />
                    إضافة مناطق صنعاء الافتراضية
                  </Button>
                )}

                <Button 
                  size="sm" 
                  onClick={() => setIsAddGeoZoneOpen(true)}
                  className="text-xs bg-[#F05215] hover:bg-[#C03A0A] text-white"
                >
                  <Plus className="h-4 w-4 ml-1.5" />
                  رسم منطقة جديدة على الخريطة
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">

              {/* Zones List / Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground">
                    المناطق المعتمدة المسجلة ({geoZones.length}):
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    يتم قبول طلبات العملاء فقط إذا كانوا داخل إحدى هذه المناطق النشطة
                  </span>
                </div>

                {geoZonesLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-6">جاري تحميل المناطق...</p>
                ) : geoZones.length === 0 ? (
                  <div className="text-center p-8 border rounded-xl bg-muted/20 space-y-3">
                    <MapPin className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="font-semibold text-sm">لم يتم تسجيل أي منطقة جغرافية بعد</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      انقر على "رسم منطقة جديدة" لتحديد نطاق مخصص، أو أضف مناطق صنعاء المعتمدة بنقرة واحدة للبدء فوراً.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => seedGeoZonesMutation.mutate()}
                      disabled={seedGeoZonesMutation.isPending}
                      className="bg-primary text-white text-xs font-semibold"
                    >
                      <Sparkles className="h-3.5 w-3.5 ml-1.5" />
                      إضافة مناطق صنعاء الافتراضية الآن
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {geoZones.map((zone) => {
                      let pointCount = 0;
                      try {
                        const parsed = JSON.parse(zone.coordinates || '[]');
                        pointCount = Array.isArray(parsed) ? parsed.length : 0;
                      } catch {
                        pointCount = 0;
                      }

                      return (
                        <Card key={zone.id} className="p-3.5 border hover:border-primary/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm">{zone.name}</h4>
                                <Badge
                                  variant={zone.isActive ? 'default' : 'secondary'}
                                  className={`text-[10px] h-4.5 px-1.5 cursor-pointer hover:opacity-80 transition-opacity ${
                                    zone.isActive ? 'bg-emerald-600 text-white' : ''
                                  }`}
                                  onClick={() => toggleGeoZoneActive(zone)}
                                  title="انقر لتغيير حالة التفعيل"
                                >
                                  {zone.isActive ? 'مسموحة ونشطة' : 'معطلة'}
                                </Badge>
                              </div>
                              {zone.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {zone.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                                <span>رسوم التوصيل: <strong className="text-foreground">{zone.deliveryFee || '0'} ريال</strong></span>
                                <span>نقاط النطاق: <strong>{pointCount}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditGeoZone(zone)}
                                className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/5 flex items-center gap-1"
                                title="تعديل المنطقة الجغرافية"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteGeoZone(zone.id)}
                                className="text-destructive hover:bg-destructive/10 h-7 w-7"
                                title="حذف المنطقة"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 5: DISCOUNTS (الخصومات والعروض)
           ======================================================== */}
        <TabsContent value="discounts" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  خصومات وعروض رسوم التوصيل
                </CardTitle>
                <CardDescription>
                  خصومات بنسبة مئوية أو بمبالغ مقطوعة على رسوم التوصيل
                </CardDescription>
              </div>

              <Dialog open={isAddDiscountOpen} onOpenChange={setIsAddDiscountOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="text-xs">
                    <Plus className="h-4 w-4 ml-1.5" />
                    إضافة عرض أو خصم
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl" className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>إضافة عرض خصم جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>اسم الخصم / العرض</Label>
                      <Input
                        value={newDiscount.name}
                        onChange={(e) => setNewDiscount(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="مثال: خصم 50% على التوصيل أو عرض نهاية الأسبوع"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>نوع الخصم</Label>
                        <Select 
                          value={newDiscount.discountType} 
                          onValueChange={(v: any) => setNewDiscount(prev => ({ ...prev, discountType: v }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                            <SelectItem value="fixed_amount">مبلغ ثابت (ريال)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>قيمة الخصم</Label>
                        <Input
                          type="number"
                          value={newDiscount.discountValue}
                          onChange={(e) => setNewDiscount(prev => ({ ...prev, discountValue: e.target.value }))}
                          placeholder="25"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>الحد الأدنى لقيمة الطلب لتطبيق الخصم (ريال)</Label>
                      <Input
                        type="number"
                        value={newDiscount.minOrderValue || ''}
                        onChange={(e) => setNewDiscount(prev => ({ ...prev, minOrderValue: e.target.value }))}
                        placeholder="5000"
                      />
                    </div>

                    <Button
                      onClick={() => addDiscountMutation.mutate(newDiscount)}
                      disabled={addDiscountMutation.isPending || !newDiscount.name || !newDiscount.discountValue}
                      className="w-full"
                    >
                      {addDiscountMutation.isPending ? 'جاري الحفظ...' : 'حفظ الخصم'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {discountsLoading ? (
                <p className="text-sm text-muted-foreground text-center p-6">جاري تحميل الخصومات...</p>
              ) : discounts.length === 0 ? (
                <div className="p-8 text-center border rounded-lg bg-muted/20 space-y-2">
                  <Percent className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="font-medium">لا توجد خصومات مفعلة حالياً</p>
                  <p className="text-xs text-muted-foreground">
                    يمكنك إضافة خصم مئوي أو خصم مبلغ مقطوع لتشجيع العملاء
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {discounts.map((discount) => (
                    <Card key={discount.id} className="p-4 border flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-sm">{discount.name}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs text-emerald-700 bg-emerald-50">
                            {discount.discountType === 'percentage' 
                              ? `خصم ${discount.discountValue}%` 
                              : `خصم ${discount.discountValue} ريال`}
                          </Badge>
                          {discount.minOrderValue && parseFloat(discount.minOrderValue) > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              للطلبات فوق {discount.minOrderValue} ريال
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDiscount(discount.id)}
                        className="text-destructive hover:bg-destructive/10 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 6: LIVE SIMULATOR & TESTER (محاكي واختبار الرسوم)
           ======================================================== */}
        <TabsContent value="simulator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Simulation Controls */}
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-amber-500" />
                  أدوات المحاكاة والفحص الحي
                </CardTitle>
                <CardDescription>
                  اختبر كيف يحسب الخادم الرسوم لمواقع وسلات طلبات مختلفة بشكل فعلي
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Points */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">مواقع اختبار سريعة بالعاصمة:</Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PRESET_TEST_POINTS.map((pt, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant={testLocation.lat === pt.lat && testLocation.lng === pt.lng ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTestLocation({ lat: pt.lat, lng: pt.lng })}
                        className="justify-start text-xs h-8"
                      >
                        <MapPin className="h-3 w-3 ml-2 shrink-0" />
                        {pt.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Coordinates manual */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">خط العرض (Lat)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={testLocation.lat}
                      onChange={(e) => setTestLocation(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">خط الطول (Lng)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={testLocation.lng}
                      onChange={(e) => setTestLocation(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Subtotal */}
                <div className="space-y-1.5">
                  <Label className="text-xs">قيمة سلة الطلب (ريال)</Label>
                  <Input
                    type="number"
                    value={testSubtotal}
                    onChange={(e) => setTestSubtotal(e.target.value)}
                    placeholder="6000"
                    className="h-9 font-semibold"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    لفحص حد التوصيل المجاني والقواعد والخصومات المعتمدة على قيمة الطلب
                  </p>
                </div>

                <Button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 ml-2 fill-current" />
                  {isSimulating ? 'جاري فحص وحساب الرسوم...' : 'احسب وافحص الرسوم الآن'}
                </Button>
              </CardContent>
            </Card>

            {/* Simulation Results & Map */}
            <div className="lg:col-span-7 space-y-4">
              {/* Map showing test location and existing zones */}
              <Card>
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    انقر على الخريطة لتغيير موقع العميل فوراً:
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {testLocation.lat.toFixed(4)}, {testLocation.lng.toFixed(4)}
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  <GeoZoneOverviewMap
                    zones={geoZones}
                    testLocation={testLocation}
                    storeLocation={{ lat: 15.3694, lng: 44.1910 }}
                    onMapClick={(lat, lng) => setTestLocation({ lat, lng })}
                    height="280px"
                  />
                </CardContent>
              </Card>

              {/* Simulation Output Card */}
              {simulationResult ? (
                <Card className="border-2 border-primary/30 bg-card shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
                      <div>
                        <span className="text-xs text-muted-foreground block">رسوم التوصيل المحسوبة</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-extrabold text-primary">
                            {simulationResult.fee}
                          </span>
                          <span className="text-base font-bold text-primary">ريال</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {simulationResult.isFreeDelivery ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs px-3 py-1">
                            🎉 {simulationResult.freeDeliveryReason || 'توصيل مجاني'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-muted/50 px-2.5 py-1">
                            طريقة الحساب: {simulationResult.calculationMethod}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Diagnostics Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-muted/40 p-2.5 rounded-lg">
                        <span className="text-muted-foreground block text-[10px]">المسافة المقدرة</span>
                        <span className="font-bold text-foreground text-sm">
                          {simulationResult.distance} كم
                        </span>
                      </div>
                      <div className="bg-muted/40 p-2.5 rounded-lg">
                        <span className="text-muted-foreground block text-[10px]">الوقت المتوقع</span>
                        <span className="font-bold text-foreground text-sm">
                          {simulationResult.estimatedTime}
                        </span>
                      </div>
                      <div className="bg-muted/40 p-2.5 rounded-lg">
                        <span className="text-muted-foreground block text-[10px]">المنطقة الجغرافية</span>
                        <span className="font-bold text-foreground text-xs truncate block">
                          {simulationResult.matchedGeoZone?.name || 'خارج المناطق'}
                        </span>
                      </div>
                      <div className="bg-muted/40 p-2.5 rounded-lg">
                        <span className="text-muted-foreground block text-[10px]">شريحة المسافة</span>
                        <span className="font-bold text-foreground text-xs truncate block">
                          {simulationResult.matchedDeliveryZone?.name || 'حسب الكيلومتر'}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown details */}
                    <div className="text-xs space-y-1.5 p-3 bg-muted/20 rounded-lg border">
                      <span className="font-semibold block text-muted-foreground mb-1">تفاصيل ومراحل الحساب:</span>
                      <div className="flex justify-between">
                        <span>الرسوم الأساسية:</span>
                        <span className="font-medium">{simulationResult.feeBreakdown.baseFee} ريال</span>
                      </div>
                      <div className="flex justify-between">
                        <span>رسوم المسافة المقطوعة:</span>
                        <span className="font-medium">{simulationResult.feeBreakdown.distanceFee} ريال</span>
                      </div>
                      {simulationResult.surgeMultiplierApplied && (
                        <div className="flex justify-between text-amber-600 font-medium">
                          <span>معامل زيادة الذروة للمنطقة:</span>
                          <span>×{simulationResult.surgeMultiplierApplied}</span>
                        </div>
                      )}
                      {simulationResult.appliedRule && (
                        <div className="flex justify-between text-primary font-medium">
                          <span>قاعدة ديناميكية مطبقة:</span>
                          <span>{simulationResult.appliedRule.name} ({simulationResult.appliedRule.fee} ريال)</span>
                        </div>
                      )}
                      {simulationResult.appliedDiscount && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>خصم مطبق:</span>
                          <span>{simulationResult.appliedDiscount.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t font-bold text-foreground">
                        <span>المبلغ الإجمالي النهائي:</span>
                        <span>{simulationResult.fee} ريال</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-dashed p-8 text-center text-muted-foreground space-y-2">
                  <Play className="h-8 w-8 mx-auto text-primary/40" />
                  <p className="font-medium text-sm">لم يتم تشغيل فحص بعد</p>
                  <p className="text-xs">
                    انقر على زر "احسب وافحص الرسوم الآن" أو اختر أحد مواقع الاختبار السريعة أعلاه لتجربة الحساب الفعلي
                  </p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* نافذة معاينة تنبيه العميل (خارج نطاق التوصيل) للمشرف */}
      <OutOfDeliveryZoneModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        isPreview={true}
      />
    </div>
  );
}
