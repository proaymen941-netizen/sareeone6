import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  ArrowRight, 
  ArrowLeft, 
  Phone, 
  MessageCircle, 
  Shield, 
  Navigation, 
  ChevronUp, 
  ChevronDown, 
  Share2, 
  Clock, 
  MapPin, 
  Package, 
  CheckCircle2, 
  Star, 
  X, 
  AlertTriangle,
  Receipt,
  Store,
  Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { OrderChatModal } from '@/components/OrderChatModal';
import { safeTriggerPhoneCall, safeOpenWhatsApp } from '@/lib/callUtils';

// SVG Icon for Green Sedan Vehicle (Styled exactly like the video)
const createCarIcon = (heading: number = 0) => {
  const svg = `
    <div style="transform: rotate(${heading}deg); transition: transform 0.4s ease-out; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; position: relative;">
      <!-- Glowing Headlight Beam -->
      <div style="position: absolute; top: -14px; width: 22px; height: 18px; background: radial-gradient(ellipse at bottom, rgba(34,197,94,0.45) 0%, rgba(34,197,94,0) 80%); border-radius: 50% 50% 0 0; pointer-events: none;"></div>
      
      <!-- Car Body -->
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));">
        <!-- Wheels -->
        <rect x="7" y="10" width="4" height="8" rx="2" fill="#1e293b"/>
        <rect x="37" y="10" width="4" height="8" rx="2" fill="#1e293b"/>
        <rect x="7" y="30" width="4" height="8" rx="2" fill="#1e293b"/>
        <rect x="37" y="30" width="4" height="8" rx="2" fill="#1e293b"/>
        
        <!-- Chassis / Body -->
        <rect x="10" y="6" width="28" height="36" rx="8" fill="#10B981" stroke="#059669" stroke-width="1.5"/>
        
        <!-- Front Hood Accent -->
        <path d="M14 10C14 8.89543 14.8954 8 16 8H32C33.1046 8 34 8.89543 34 10V14H14V10Z" fill="#34D399"/>
        
        <!-- Windshield -->
        <path d="M13 15H35L33 21H15L13 15Z" fill="#064E3B" opacity="0.85"/>
        
        <!-- Roof -->
        <rect x="14" y="21" width="20" height="12" rx="2" fill="#10B981"/>
        
        <!-- Rear Window -->
        <path d="M14 33H34L35 37H13L14 33Z" fill="#064E3B" opacity="0.85"/>
        
        <!-- Headlights -->
        <circle cx="14" cy="7" r="2" fill="#FEF08A"/>
        <circle cx="34" cy="7" r="2" fill="#FEF08A"/>
        
        <!-- Taillights -->
        <circle cx="14" cy="41" r="1.5" fill="#EF4444"/>
        <circle cx="34" cy="41" r="1.5" fill="#EF4444"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-vehicle-marker',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
};

// SVG Icon for Pickup Point (Store / Restaurant / Wasalni fromAddress)
const createPickupIcon = (label?: string) => {
  const svg = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="width: 32px; height: 32px; border-radius: 50%; background: #10B981; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(16,185,129,0.4); display: flex; align-items: center; justify-content: center; color: white;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2"/>
          <path d="M12 20v2"/>
          <path d="M20 12h2"/>
          <path d="M2 12h2"/>
        </svg>
      </div>
      ${label ? `<div style="background: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-top: 4px; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; border: 1px solid #e2e8f0;">${label}</div>` : ''}
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-pickup-marker',
    iconSize: [140, 60],
    iconAnchor: [70, 16],
  });
};

// SVG Icon for Destination Point (Hospital / Home / Customer)
const createDestinationIcon = (label?: string) => {
  const svg = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="width: 34px; height: 34px; border-radius: 50%; background: #EF4444; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(239,68,68,0.4); display: flex; align-items: center; justify-content: center; color: white;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      ${label ? `<div style="background: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-top: 4px; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; border: 1px solid #e2e8f0;">${label}</div>` : ''}
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-dest-marker',
    iconSize: [140, 60],
    iconAnchor: [70, 17],
  });
};

// Map controller to smoothly fit bounds or center
function MapController({ 
  driverPos, 
  pickupPos, 
  destPos, 
  recenterTrigger 
}: { 
  driverPos?: [number, number]; 
  pickupPos?: [number, number]; 
  destPos?: [number, number]; 
  recenterTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (driverPos) points.push(driverPos);
    if (pickupPos) points.push(pickupPos);
    if (destPos) points.push(destPos);

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16, animate: true, duration: 1 });
    } else if (driverPos) {
      map.flyTo(driverPos, 16, { animate: true, duration: 0.8 });
    } else if (destPos) {
      map.flyTo(destPos, 15, { animate: true, duration: 0.8 });
    }
  }, [map, recenterTrigger]);

  return null;
}

export interface LiveRideTrackingViewProps {
  order: any;
  driverLocation?: [number, number] | null;
  onBack: () => void;
  onCancelOrder?: () => void;
  canCancel?: boolean;
}

export default function LiveRideTrackingView({
  order,
  driverLocation,
  onBack,
  onCancelOrder,
  canCancel = false
}: LiveRideTrackingViewProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';

  const [chatOpen, setChatOpen] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  // Default coordinate fallbacks
  const defaultCenter: [number, number] = [15.3694, 44.1910]; // Sana'a / Region Center

  // Customer / Destination Coordinates
  const destCoords: [number, number] = useMemo(() => {
    const lat = parseFloat(order.customerLocationLat || order.toLat || '15.3694');
    const lng = parseFloat(order.customerLocationLng || order.toLng || '44.1910');
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return [lat, lng];
    }
    return [15.3694, 44.1910];
  }, [order.customerLocationLat, order.customerLocationLng, order.toLat, order.toLng]);

  // Pickup / Restaurant Coordinates
  const pickupCoords: [number, number] = useMemo(() => {
    const lat = parseFloat(order.pickupLocationLat || order.restaurantLatitude || order.fromLat || '15.3600');
    const lng = parseFloat(order.pickupLocationLng || order.restaurantLongitude || order.fromLng || '44.1800');
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return [lat, lng];
    }
    // Generate slight offset from dest if missing
    return [destCoords[0] - 0.008, destCoords[1] - 0.008];
  }, [order.pickupLocationLat, order.restaurantLatitude, order.fromLat, order.pickupLocationLng, order.restaurantLongitude, order.fromLng, destCoords]);

  // Live Driver Position with interpolation
  const currentDriverPos: [number, number] = useMemo(() => {
    if (driverLocation && !isNaN(driverLocation[0]) && !isNaN(driverLocation[1])) {
      return driverLocation;
    }
    if (order.driverLatitude && order.driverLongitude) {
      const lat = parseFloat(order.driverLatitude);
      const lng = parseFloat(order.driverLongitude);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    // Position driver along 45% of the route between pickup and destination
    return [
      pickupCoords[0] + (destCoords[0] - pickupCoords[0]) * 0.55,
      pickupCoords[1] + (destCoords[1] - pickupCoords[1]) * 0.55
    ];
  }, [driverLocation, order.driverLatitude, order.driverLongitude, pickupCoords, destCoords]);

  // Route Polyline Points (Simulated or actual road path)
  const routePoints: [number, number][] = useMemo(() => {
    const mid1: [number, number] = [
      pickupCoords[0] + (destCoords[0] - pickupCoords[0]) * 0.35 + 0.001,
      pickupCoords[1] + (destCoords[1] - pickupCoords[1]) * 0.25 - 0.0015
    ];
    const mid2: [number, number] = [
      pickupCoords[0] + (destCoords[0] - pickupCoords[0]) * 0.7 + 0.0005,
      pickupCoords[1] + (destCoords[1] - pickupCoords[1]) * 0.75 + 0.001
    ];
    return [pickupCoords, mid1, mid2, destCoords];
  }, [pickupCoords, destCoords]);

  // Calculate vehicle heading angle
  const vehicleHeading = useMemo(() => {
    const dLat = destCoords[0] - currentDriverPos[0];
    const dLng = destCoords[1] - currentDriverPos[1];
    const angleRad = Math.atan2(dLng, dLat);
    return (angleRad * 180) / Math.PI;
  }, [currentDriverPos, destCoords]);

  // 4-Digit Security PIN Code (رمز التعريف الشخصي)
  const pinDigits = useMemo(() => {
    const pinStr = String(order.deliveryPin || order.orderNumber?.slice(-4) || '1921').replace(/\D/g, '');
    const padded = (pinStr + '1921').slice(0, 4);
    return padded.split('');
  }, [order.deliveryPin, order.orderNumber]);

  // Driver details
  const driverName = order.driverName || (language === 'ar' ? 'Kumail naseer' : 'Kumail Naseer');
  const driverRating = order.driverRating || '3.9';
  const vehiclePlate = order.driverVehiclePlate || 'أ س ن 8990';
  const vehicleModel = order.driverVehicleModel || 'Toyota Camry';
  const driverPhone = order.driverPhone || '';

  // Status mapping
  const statusHeadline = useMemo(() => {
    switch (order.status) {
      case 'on_way':
        return language === 'ar' ? 'السائق في الطريق إليك' : 'Driver is on the way to you';
      case 'picked_up':
        return language === 'ar' ? 'السائق استلم طلبك وفي الطريق' : 'Driver picked up your order';
      case 'preparing':
        return language === 'ar' ? 'جاري تحضير طلبك من المتجر' : 'Order is being prepared';
      case 'assigned':
      case 'confirmed':
        return language === 'ar' ? 'السائق متوجه لنقطة الاستلام' : 'Driver heading to pickup point';
      case 'delivered':
        return language === 'ar' ? 'تم تسليم الطلب بنجاح' : 'Order delivered successfully';
      case 'cancelled':
        return language === 'ar' ? 'تم إلغاء الطلب' : 'Order was cancelled';
      default:
        return language === 'ar' ? 'السائق في الطريق إليك' : 'Driver is on the way';
    }
  }, [order.status, language]);

  // Estimated Arrival time formatted
  const formattedEta = useMemo(() => {
    if (order.estimatedTime) return order.estimatedTime;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    return now.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, [order.estimatedTime, language]);

  const handleShareTrip = () => {
    if (navigator.share) {
      navigator.share({
        title: `تتبع رحلة وطلب ${order.orderNumber || ''}`,
        text: `تتبع مباشر لطلبي عبر تطبيق سريع ون: رمز الرحلة ${pinDigits.join('')}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: language === 'ar' ? 'تم نسخ رابط التتبع' : 'Tracking link copied',
        description: language === 'ar' ? 'يمكنك مشاركة الرابط مع عائلتك أو أصدقائك' : 'You can share this link with friends or family'
      });
    }
  };

  const handleCallDriver = () => {
    if (driverPhone) {
      safeTriggerPhoneCall(driverPhone);
    } else {
      toast({
        title: language === 'ar' ? 'رقم السائق غير متوفر' : 'Driver phone unavailable',
        description: language === 'ar' ? 'يمكنك مراسلة السائق عبر الدردشة الفورية' : 'Please use in-app chat'
      });
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-100 flex flex-col select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Full-Screen Interactive Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={currentDriverPos}
          zoom={15}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />

          <MapController
            driverPos={currentDriverPos}
            pickupPos={pickupCoords}
            destPos={destCoords}
            recenterTrigger={recenterCount}
          />

          {/* Glowing Green Route Line */}
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#10B981',
              weight: 6,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
          
          {/* Subtle Outer Polyline Glow */}
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#34D399',
              weight: 12,
              opacity: 0.25,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />

          {/* Pickup Marker */}
          <Marker
            position={pickupCoords}
            icon={createPickupIcon(order.restaurantName || order.pickupAddress || (language === 'ar' ? 'نقطة الاستلام' : 'Pickup Point'))}
          />

          {/* Destination Marker */}
          <Marker
            position={destCoords}
            icon={createDestinationIcon(order.deliveryAddress || (language === 'ar' ? 'موقعك' : 'Your Location'))}
          />

          {/* Animated Green Sedan Vehicle Marker */}
          <Marker
            position={currentDriverPos}
            icon={createCarIcon(vehicleHeading)}
          />
        </MapContainer>
      </div>

      {/* 2. Top Floating Controls */}
      <div className="relative z-10 p-4 pt-6 flex items-center justify-between pointer-events-none">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="pointer-events-auto w-11 h-11 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-95 transition-all"
          title={language === 'ar' ? 'رجوع' : 'Back'}
        >
          {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>

        {/* Top Right Actions: Safety & GPS Recenter */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Shield / Safety Button */}
          <button
            onClick={() => setShowSafetyModal(true)}
            className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 flex items-center justify-center text-red-600 hover:bg-red-50 active:scale-95 transition-all relative"
            title={language === 'ar' ? 'مركز الأمان والدعم' : 'Safety & Support'}
          >
            <Shield className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          </button>

          {/* GPS Recenter Button */}
          <button
            onClick={() => setRecenterCount(prev => prev + 1)}
            className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
            title={language === 'ar' ? 'إعادة التوسيط على السائق' : 'Recenter map'}
          >
            <Navigation className="w-5 h-5 text-emerald-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 pointer-events-none" />

      {/* 3. Floating Bottom Sheet (Exact Careem/Uber Design from the video) */}
      <div className="relative z-20 w-full max-w-lg mx-auto p-3 pb-5 pointer-events-auto">
        <div className="bg-white rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-slate-100 overflow-hidden transition-all duration-300">
          {/* Top Status & ETA Bar */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100/80">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {statusHeadline}
            </h2>

            {/* Yellow / Amber ETA Pill */}
            <div className="bg-[#FEF08A] text-amber-950 font-black text-xs px-3 py-1.5 rounded-xl border border-amber-300/80 shadow-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-800" />
              <span>
                {language === 'ar' ? 'الوقت المقدر للوصول' : 'ETA'} {formattedEta}
              </span>
            </div>
          </div>

          {/* Security PIN Code Boxes (رمز التعريف الشخصي / رمز استلام الطلب) */}
          <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600 max-w-[190px]">
              {language === 'ar' 
                ? 'استخدم رمز التعريف الشخصي لبدء الرحلة' 
                : 'Use PIN code to confirm order delivery'}
            </p>

            {/* 4 Monospace Box Badges */}
            <div className="flex items-center gap-1.5" dir="ltr">
              {pinDigits.map((digit, idx) => (
                <div
                  key={idx}
                  className="w-8 h-9 rounded-lg bg-[#E0F2FE] border border-sky-200 flex items-center justify-center font-black text-base text-slate-900 shadow-2xs"
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>

          {/* Driver & Vehicle Details Profile */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            {/* Driver Avatar + Rating + Name */}
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Driver Photo */}
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 border-2 border-emerald-400/40 p-0.5 shadow-sm overflow-hidden flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                    alt={driverName}
                    className="w-full h-full object-cover rounded-xl"
                    onError={(e) => {
                      (e.target as any).src = 'https://ui-avatars.com/api/?name=Kumail+Naseer&background=10b981&color=fff&bold=true';
                    }}
                  />
                </div>
                {/* Rating Badge */}
                <div className="absolute -bottom-1.5 -right-1 bg-white text-slate-800 font-black text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200 shadow-xs flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span>{driverRating}</span>
                </div>
              </div>

              <div>
                <h3 className="font-black text-sm text-slate-900">{driverName}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {language === 'ar' ? 'سائق موثق ومعتمد' : 'Verified Partner'}
                </p>
              </div>
            </div>

            {/* Vehicle Plate & Model */}
            <div className={`text-${isRTL ? 'left' : 'right'}`}>
              <div className="text-base sm:text-lg font-black text-slate-900 tracking-wider">
                {vehiclePlate}
              </div>
              <div className="text-xs font-bold text-slate-500 mt-0.5">
                {vehicleModel}
              </div>
            </div>
          </div>

          {/* Action Bar (Chat with Driver & Call) */}
          <div className="px-5 pb-4 pt-1 flex items-center gap-2.5">
            {/* Direct Message Button */}
            <button
              onClick={() => setChatOpen(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 active:scale-[0.98] border border-emerald-200 text-emerald-900 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>
                {language === 'ar' ? `رسالة ${driverName}` : `Message ${driverName}`}
              </span>
            </button>

            {/* Direct Call Button */}
            <button
              onClick={handleCallDriver}
              className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 flex items-center justify-center transition-all border border-slate-200 shadow-xs"
              title={language === 'ar' ? 'اتصال بالسائق' : 'Call driver'}
            >
              <Phone className="w-4 h-4 text-slate-700" />
            </button>

            {/* Details Drawer Toggle */}
            <button
              onClick={() => setShowDetailsDrawer(prev => !prev)}
              className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 flex items-center justify-center transition-all border border-slate-200 shadow-xs"
              title={language === 'ar' ? 'تفاصيل الطلب' : 'Order details'}
            >
              {showDetailsDrawer ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable Order Details Drawer */}
          {showDetailsDrawer && (
            <div className="px-5 pt-3 pb-4 bg-slate-50/80 border-t border-slate-100 max-h-[45vh] overflow-y-auto space-y-3 animate-in slide-in-from-bottom duration-200">
              {/* Pickup & Delivery Points */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                {/* Pickup point */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-400 block">{language === 'ar' ? 'نقطة الاستلام' : 'Pickup Location'}</span>
                    <span className="font-black text-slate-800">{order.restaurantName || order.pickupAddress || (language === 'ar' ? 'المتجر الرئيسي' : 'Main Store')}</span>
                  </div>
                </div>

                <div className="h-px bg-slate-100 ml-10 mr-2" />

                {/* Delivery point */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-400 block">{language === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}</span>
                    <span className="font-black text-slate-800">{order.deliveryAddress}</span>
                  </div>
                </div>
              </div>

              {/* Order Items if available */}
              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80">
                  <h4 className="font-black text-xs text-slate-800 mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    {language === 'ar' ? 'عناصر الطلب' : 'Order Items'}
                  </h4>
                  <div className="space-y-1.5">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs font-bold text-slate-700">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-black text-slate-900">{item.price * item.quantity} {t('currency_riyal')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Summary */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex justify-between items-center">
                <span className="text-xs font-black text-slate-600">{language === 'ar' ? 'إجمالي الطلب:' : 'Total Amount:'}</span>
                <span className="text-sm font-black text-emerald-600">{order.total || order.totalAmount || '0'} {t('currency_riyal')}</span>
              </div>

              {/* Share & Cancel Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareTrip}
                  className="flex-1 rounded-xl text-xs font-black border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  <Share2 className="w-3.5 h-3.5 mr-1 ml-1" />
                  {language === 'ar' ? 'مشاركة الرحلة' : 'Share Trip'}
                </Button>

                {canCancel && onCancelOrder && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelOrder}
                    className="flex-1 rounded-xl text-xs font-black border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5 mr-1 ml-1" />
                    {language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Safety & Help Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-white" />
                <h3 className="font-black text-base">{language === 'ar' ? 'مركز الأمان والدعم' : 'Safety & Support'}</h3>
              </div>
              <button onClick={() => setShowSafetyModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs font-bold text-slate-600 leading-relaxed">
                {language === 'ar'
                  ? 'رحلتك وطلبك مراقبان بواسطة فريق دعم سريع ون لضمان سلامتك وراحتك طوال الوقت.'
                  : 'Your trip and delivery are continuously monitored for your security.'}
              </p>

              <button
                onClick={handleShareTrip}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-xs text-slate-800 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-slate-700" />
                <span>{language === 'ar' ? 'مشاركة تفاصيل التتبع الحي' : 'Share Live Tracking Details'}</span>
              </button>

              <button
                onClick={() => safeOpenWhatsApp('967777146387', `طلب مساعدة بخصوص الطلب ${order.orderNumber}`)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center gap-2 border border-emerald-200"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>{language === 'ar' ? 'محادثة دعم سريع ون (واتساب)' : 'WhatsApp Support'}</span>
              </button>

              <button
                onClick={() => safeTriggerPhoneCall('967777146387')}
                className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs flex items-center justify-center gap-2 border border-red-200"
              >
                <Phone className="w-4 h-4 text-red-600" />
                <span>{language === 'ar' ? 'اتصال طوارئ بالدعم المباشر' : 'Emergency Call Support'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Order Chat Modal with Driver */}
      <OrderChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        orderId={order.id || order.orderNumber}
        orderNumber={order.orderNumber || order.id}
        recipientName={driverName}
        recipientPhone={driverPhone}
        currentUserType="customer"
        currentUserId={order.customerId || 'customer_user'}
      />
    </div>
  );
}
