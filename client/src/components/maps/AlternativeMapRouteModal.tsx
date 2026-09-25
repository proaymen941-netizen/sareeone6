import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Phone, 
  Store, 
  User, 
  Compass, 
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  LocateFixed
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { extractCoordinates } from '@/lib/mapUtils';

// Fix Leaflet Default Icon URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const driverIcon = new L.DivIcon({
  className: 'custom-driver-icon',
  html: `
    <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: rgba(16, 185, 129, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 34px; height: 34px; border-radius: 50%; background: #10b981; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
        🛵
      </div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

const customerIcon = new L.DivIcon({
  className: 'custom-customer-icon',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(239, 68, 68, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 36px; height: 36px; border-radius: 50%; background: #ef4444; border: 3px solid white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
        👤
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const storeIcon = new L.DivIcon({
  className: 'custom-store-icon',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: #f59e0b; border: 3px solid white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
        🏪
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

// Helper to create directional arrow icon
function createArrowIcon(angle: number) {
  return new L.DivIcon({
    className: 'guidance-arrow-icon',
    html: `
      <div style="transform: rotate(${angle}deg); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L19 19L12 15L5 19L12 2Z" fill="#ea580c" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Map bounds controller
function MapAutoController({ 
  bounds, 
  center 
}: { 
  bounds: L.LatLngBounds | null; 
  center: [number, number] | null; 
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (center) {
      map.setView(center, 15);
    }
  }, [map, bounds, center]);

  return null;
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

// Calculate distance in KM
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface AlternativeMapRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationLat?: number | string | null;
  destinationLng?: number | string | null;
  destinationAddress?: string | null;
  destinationName?: string;
  destinationType?: 'customer' | 'restaurant' | 'store' | 'general';
  destinationPhone?: string;
  orderNumber?: string;
  driverCurrentLocation?: [number, number] | null;
}

export default function AlternativeMapRouteModal({
  isOpen,
  onClose,
  destinationLat,
  destinationLng,
  destinationAddress,
  destinationName,
  destinationType = 'customer',
  destinationPhone,
  orderNumber,
  driverCurrentLocation: propDriverLocation,
}: AlternativeMapRouteModalProps) {
  // Live GPS tracking for driver
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(
    propDriverLocation || null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [mapCenterOverride, setMapCenterOverride] = useState<[number, number] | null>(null);

  // Extract valid destination coordinates
  const resolvedCoords = extractCoordinates(destinationLat, destinationLng, destinationAddress);
  const destCoords: [number, number] = resolvedCoords
    ? [resolvedCoords.lat, resolvedCoords.lng]
    : [15.3694, 44.1910]; // Default Sana'a

  // Real-time GPS watch
  useEffect(() => {
    if (!isOpen) return;

    if (!navigator.geolocation) {
      if (!driverLocation) {
        setDriverLocation([15.3540, 44.1820]); // Fallback Sana'a
      }
      return;
    }

    setIsLocating(true);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLocation([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        if (!driverLocation) {
          setDriverLocation([15.3540, 44.1820]);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate route and arrows
  const effectiveDriverLoc: [number, number] = driverLocation || [15.3540, 44.1820];
  const routePositions: [number, number][] = [effectiveDriverLoc, destCoords];

  // Calculate distance & bearing
  const distanceKm = calculateDistanceKm(
    effectiveDriverLoc[0],
    effectiveDriverLoc[1],
    destCoords[0],
    destCoords[1]
  );
  const bearingAngle = calculateBearing(
    effectiveDriverLoc[0],
    effectiveDriverLoc[1],
    destCoords[0],
    destCoords[1]
  );

  // Estimated driving time (approx 30km/h in city)
  const etaMinutes = Math.max(2, Math.round((distanceKm / 28) * 60));

  // Compute intermediate guidance arrows along the route (25%, 50%, 75%)
  const arrowPoints: Array<{ pos: [number, number]; angle: number }> = [
    {
      pos: [
        effectiveDriverLoc[0] + (destCoords[0] - effectiveDriverLoc[0]) * 0.28,
        effectiveDriverLoc[1] + (destCoords[1] - effectiveDriverLoc[1]) * 0.28,
      ],
      angle: bearingAngle,
    },
    {
      pos: [
        effectiveDriverLoc[0] + (destCoords[0] - effectiveDriverLoc[0]) * 0.58,
        effectiveDriverLoc[1] + (destCoords[1] - effectiveDriverLoc[1]) * 0.58,
      ],
      angle: bearingAngle,
    },
    {
      pos: [
        effectiveDriverLoc[0] + (destCoords[0] - effectiveDriverLoc[0]) * 0.82,
        effectiveDriverLoc[1] + (destCoords[1] - effectiveDriverLoc[1]) * 0.82,
      ],
      angle: bearingAngle,
    },
  ];

  const bounds = L.latLngBounds([effectiveDriverLoc, destCoords]);

  // Recenter on driver
  const handleRecenterDriver = () => {
    if (driverLocation) {
      setMapCenterOverride(driverLocation);
    } else {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setDriverLocation(loc);
        setMapCenterOverride(loc);
      });
    }
  };

  const isCustomer = destinationType === 'customer';
  const targetLabel = isCustomer
    ? destinationName || 'العميل'
    : destinationName || 'المتجر / المطعم';

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-2 sm:p-4 select-none"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl h-[92vh] max-h-[820px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        
        {/* ── 1. Header (Matching Uploaded Image - Orange Bar with Pin & Close) ── */}
        <div className="bg-[#ea580c] px-4 py-3 sm:py-3.5 text-white flex items-center justify-between shrink-0 shadow-md">
          {/* Close button on the left (RTL) */}
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0 text-white"
            title="إغلاق"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Title with Pin icon on the right (RTL) */}
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base sm:text-lg tracking-tight">
              تحديد الموقع (نظام بديل)
            </h2>
            <div className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
          </div>
        </div>

        {/* ── 2. Warning / Info Banner (Matching Uploaded Image Exactly) ── */}
        <div className="bg-[#fef9ee] px-4 py-2.5 flex items-center gap-3 text-[#92400e] text-xs sm:text-sm border-b border-amber-200 shrink-0">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="font-medium leading-relaxed">
            مفتاح خرائط جوجل غير متوفر. تم تفعيل نظام الخرائط المفتوحة (Leaflet) كبديل لضمان استمرارية الخدمة.
          </p>
        </div>

        {/* ── 3. Live Guidance Compass Ribbon ── */}
        <div className="bg-orange-50 px-4 py-1.5 border-b border-orange-200 flex items-center justify-between text-xs text-orange-950 font-bold shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-orange-900">
              إرشاد الملاحة النشط: اتجه نحو <strong>{targetLabel}</strong> باتجاه الأسهم البرتقالية ↗️
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <span className="bg-white border border-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-mono font-black">
              {distanceKm.toFixed(2)} كم
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              ~{etaMinutes} دقيقة
            </span>
          </div>
        </div>

        {/* ── 4. Map Container (Leaflet) ── */}
        <div className="flex-1 relative bg-slate-100 min-h-[300px]">
          <MapContainer
            center={effectiveDriverLoc}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapAutoController bounds={bounds} center={mapCenterOverride} />

            {/* Route Polyline connecting Driver to Target */}
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#ea580c',
                weight: 5,
                opacity: 0.9,
                dashArray: '10, 10',
              }}
            />

            {/* Directional Guidance Arrows along the polyline */}
            {arrowPoints.map((arrow, idx) => (
              <Marker
                key={`arrow-${idx}`}
                position={arrow.pos}
                icon={createArrowIcon(arrow.angle)}
                interactive={false}
              />
            ))}

            {/* Driver Marker */}
            <Marker position={effectiveDriverLoc} icon={driverIcon}>
              <Popup>
                <div className="text-center p-1 text-xs" dir="rtl">
                  <p className="font-bold text-emerald-700">موقعك الحالي (كابتن التوصيل)</p>
                  <p className="text-gray-500 text-[10px]">يتم التتبع المباشر بنظام GPS</p>
                </div>
              </Popup>
            </Marker>

            {/* Destination Marker (Customer or Store) */}
            <Marker 
              position={destCoords} 
              icon={isCustomer ? customerIcon : storeIcon}
            >
              <Popup>
                <div className="text-right p-1 text-xs font-sans min-w-[190px]" dir="rtl">
                  <p className="font-bold text-gray-900 border-b pb-1 mb-1 flex items-center justify-between">
                    <span>{isCustomer ? '👤 موقع العميل' : '🏪 موقع المتجر'}</span>
                    {orderNumber && <span className="text-[10px] text-orange-600">#{orderNumber}</span>}
                  </p>
                  <p className="font-bold text-sm text-orange-700 mb-1">{targetLabel}</p>
                  <p className="text-gray-600 text-[11px] mb-1 leading-relaxed">
                    📍 {destinationAddress || 'العنوان المسجل في الطلب'}
                  </p>
                  <p className="text-emerald-700 font-bold text-[11px]">
                    📏 يبعد عنك: {distanceKm.toFixed(2)} كم (~{etaMinutes} دقيقة)
                  </p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>

          {/* Brown Location Button at Bottom Left (Matching Screenshot Exactly) */}
          <button
            type="button"
            className="absolute bottom-5 left-5 w-11 h-11 rounded-full bg-[#5c2409] hover:bg-[#431804] text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 border-2 border-white z-[1000]"
            onClick={handleRecenterDriver}
            title="تحديد موقعي الحالي"
          >
            {isLocating ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Navigation className="h-5 w-5 -rotate-45" />
            )}
          </button>
        </div>

        {/* ── 5. Bottom Card (Matching Uploaded Screenshot's Blue Card & Buttons) ── */}
        <div className="p-3 sm:p-4 border-t bg-white shrink-0">
          <div className="flex flex-col gap-3">
            {/* Blue Info Box matching screenshot */}
            <div className="flex items-start gap-2.5 bg-[#eff6ff] p-3 rounded-xl border border-[#dbeafe]">
              <MapPin className="h-5 w-5 text-[#2563eb] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#2563eb] mb-0.5">
                  الموقع المختار: {targetLabel} {orderNumber ? `(طلب #${orderNumber})` : ''}
                </p>
                <p className="text-xs sm:text-sm text-gray-700 leading-snug font-medium break-words">
                  {destinationAddress || 'تم تحديد الموقع عبر الإحداثيات المسجلة في النظام'}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 font-mono">
                  <span>الإحداثيات: {destCoords[0].toFixed(5)}, {destCoords[1].toFixed(5)}</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-sans font-bold">المسافة: {distanceKm.toFixed(2)} كم</span>
                </div>
              </div>

              {destinationPhone && (
                <a
                  href={`tel:${destinationPhone}`}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm"
                  title="اتصال هاتفي"
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">اتصال</span>
                </a>
              )}
            </div>

            {/* Action Buttons matching screenshot */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={onClose}
                className="flex-1 bg-[#ff7a00] hover:bg-[#ea580c] text-white font-bold h-11 text-sm sm:text-base rounded-xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                تأكيد الموقع والمسار
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100 font-bold h-11 text-sm sm:text-base rounded-xl"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
