import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Phone, Package, Store, ExternalLink } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { extractCoordinates, openInGoogleMaps, getGoogleMapsUrl } from '@/lib/mapUtils';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const driverIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#10b981" stroke="white" stroke-width="2"/>
      <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2.5" fill="none"/>
    </svg>
  `),
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const destinationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#ef4444" stroke="white" stroke-width="2"/>
      <path d="M12 7v5l3 3" stroke="white" stroke-width="2" fill="none"/>
    </svg>
  `),
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const restaurantIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#f59e0b" stroke="white" stroke-width="2"/>
      <path d="M8 6v12M12 6v6M16 6v2" stroke="white" stroke-width="2" fill="none"/>
    </svg>
  `),
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

export interface Order {
  id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  customerLocationLat?: string | number | null;
  customerLocationLng?: string | number | null;
  restaurantLat?: string | number | null;
  restaurantLng?: string | number | null;
  restaurantLatitude?: string | number | null;
  restaurantLongitude?: string | number | null;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  fromAddress?: string;
  toAddress?: string;
  fromLat?: string | number | null;
  fromLng?: string | number | null;
  toLat?: string | number | null;
  toLng?: string | number | null;
  status: string;
  totalAmount?: string;
  isWasalni?: boolean;
}

export interface DriverMapViewProps {
  orders: Order[];
  driverLocation?: [number, number] | null;
  height?: string;
  onNavigate?: (order: Order) => void;
  onCall?: (phone: string) => void;
}

// Component to auto-fit bounds
function AutoFitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, bounds]);
  
  return null;
}

// Hook to track driver location
function useDriverLocation() {
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation([position.coords.latitude, position.coords.longitude]);
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5000,
      }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);
  
  return { location, error };
}

export default function DriverMapView({
  orders,
  driverLocation: propDriverLocation,
  height = '500px',
  onNavigate,
  onCall,
}: DriverMapViewProps) {
  const { location: autoDriverLocation } = useDriverLocation();
  const driverLocation = propDriverLocation || autoDriverLocation;
  
  // Default center (Sanaa, Yemen)
  const defaultCenter: [number, number] = [15.3694, 44.1910];
  const mapCenter = driverLocation || defaultCenter;
  
  // Calculate route and bounds
  const allPoints: [number, number][] = [];
  if (driverLocation) allPoints.push(driverLocation);
  
  // Prepare processed orders with resolved coordinates
  const processedOrders = orders.map((order) => {
    const customerCoords = extractCoordinates(
      order.customerLocationLat ?? order.toLat,
      order.customerLocationLng ?? order.toLng,
      order.deliveryAddress ?? order.toAddress
    );

    const pickupCoords = extractCoordinates(
      order.restaurantLat ?? order.restaurantLatitude ?? order.fromLat,
      order.restaurantLng ?? order.restaurantLongitude ?? order.fromLng,
      order.restaurantAddress ?? order.fromAddress
    );

    if (pickupCoords) {
      allPoints.push([pickupCoords.lat, pickupCoords.lng]);
    }
    if (customerCoords) {
      allPoints.push([customerCoords.lat, customerCoords.lng]);
    }

    return {
      ...order,
      resolvedCustomerCoords: customerCoords,
      resolvedPickupCoords: pickupCoords,
      resolvedCustomerAddress: order.deliveryAddress || order.toAddress || 'عنوان العميل',
      resolvedPickupAddress: order.restaurantAddress || order.fromAddress || 'موقع الاستلام',
      resolvedPickupName: order.restaurantName || (order.isWasalni ? 'موقع الاستلام (وصل لي)' : 'المتجر'),
    };
  });
  
  const bounds = allPoints.length > 0 ? L.latLngBounds(allPoints) : null;
  
  // Calculate route segments: Driver -> Pickup -> Customer
  const routePoints: [number, number][] = [];
  if (driverLocation) {
    routePoints.push(driverLocation);
  }
  processedOrders.forEach((o) => {
    if (o.resolvedPickupCoords && (o.status === 'ready' || o.status === 'assigned' || o.status === 'accepted' || o.status === 'pending')) {
      routePoints.push([o.resolvedPickupCoords.lat, o.resolvedPickupCoords.lng]);
    }
    if (o.resolvedCustomerCoords) {
      routePoints.push([o.resolvedCustomerCoords.lat, o.resolvedCustomerCoords.lng]);
    }
  });
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  };
  
  return (
    <div className="space-y-4" dir="rtl">
      <div
        style={{
          height,
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {bounds && <AutoFitBounds bounds={bounds} />}
          
          {/* Driver location */}
          {driverLocation && (
            <Marker position={driverLocation} icon={driverIcon}>
              <Popup>
                <div className="text-center p-1" dir="rtl">
                  <p className="font-bold text-green-600 text-sm">موقعك الحالي (السائق)</p>
                  <p className="text-xs text-gray-500">يتم التتبع بواسطة نظام GPS</p>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Route polyline */}
          {routePoints.length > 1 && (
            <Polyline
              positions={routePoints}
              color="#2563eb"
              weight={4}
              opacity={0.8}
              dashArray="8, 8"
            />
          )}
          
          {/* Render markers for each order */}
          {processedOrders.map((order) => {
            const elements = [];

            // 1. Pickup/Restaurant Marker
            if (order.resolvedPickupCoords) {
              const pos: [number, number] = [order.resolvedPickupCoords.lat, order.resolvedPickupCoords.lng];
              const dist = driverLocation
                ? calculateDistance(driverLocation[0], driverLocation[1], pos[0], pos[1])
                : null;

              elements.push(
                <Marker key={`pickup-${order.id}`} position={pos} icon={restaurantIcon}>
                  <Popup>
                    <div className="min-w-[220px] text-right font-sans p-1" dir="rtl">
                      <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-2">
                        <span className="font-bold text-amber-700 flex items-center gap-1 text-sm">
                          <Store className="h-4 w-4" />
                          {order.isWasalni ? 'موقع الاستلام (وصل لي)' : 'المتجر / المطعم'}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          #{order.orderNumber || order.id.slice(-6)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-800 font-semibold mb-1">
                        {order.resolvedPickupName}
                      </p>
                      <p className="text-xs text-gray-600 mb-1 leading-relaxed">
                        📍 {order.resolvedPickupAddress}
                      </p>

                      {dist !== null && (
                        <p className="text-xs text-blue-600 font-medium mb-2">
                          📏 المسافة من موقعك: <strong>{dist.toFixed(2)} كم</strong>
                        </p>
                      )}

                      <div className="mt-2 pt-2 border-t flex flex-col gap-1.5">
                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-xs text-amber-900 font-mono">
                          🌐 الإحداثيات: {order.resolvedPickupCoords?.lat.toFixed(5)}, {order.resolvedPickupCoords?.lng.toFixed(5)}
                        </div>
                        <p className="text-[11px] text-gray-500 text-center">
                          ✅ يتم التتبع عبر خريطة Leaflet المفتوحة داخل التطبيق
                        </p>

                        {order.restaurantPhone && (
                          <a
                            href={`tel:${order.restaurantPhone}`}
                            className="w-full flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium py-1 px-2 rounded-lg transition-colors text-center"
                          >
                            <Phone size={12} />
                            اتصال بالمتجر
                          </a>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            }

            // 2. Customer Destination Marker
            if (order.resolvedCustomerCoords) {
              const pos: [number, number] = [order.resolvedCustomerCoords.lat, order.resolvedCustomerCoords.lng];
              const dist = driverLocation
                ? calculateDistance(driverLocation[0], driverLocation[1], pos[0], pos[1])
                : null;

              elements.push(
                <Marker key={`customer-${order.id}`} position={pos} icon={destinationIcon}>
                  <Popup>
                    <div className="min-w-[220px] text-right font-sans p-1" dir="rtl">
                      <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-2">
                        <span className="font-bold text-red-600 flex items-center gap-1 text-sm">
                          <MapPin className="h-4 w-4" />
                          {order.isWasalni ? 'عنوان العميل (وصل لي)' : 'عنوان توصيل العميل'}
                        </span>
                        <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">
                          #{order.orderNumber || order.id.slice(-6)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-900 font-bold mb-1">
                        👤 {order.customerName}
                      </p>
                      {order.customerPhone && (
                        <p className="text-xs text-gray-600 mb-1" dir="ltr">
                          📞 {order.customerPhone}
                        </p>
                      )}
                      <p className="text-xs text-gray-700 mb-1.5 leading-relaxed bg-gray-50 p-1.5 rounded border">
                        📍 {order.resolvedCustomerAddress}
                      </p>

                      {dist !== null && (
                        <p className="text-xs text-emerald-700 font-medium mb-2">
                          📏 المسافة من موقعك: <strong>{dist.toFixed(2)} كم</strong>
                        </p>
                      )}

                      <div className="mt-2 pt-2 border-t flex flex-col gap-1.5">
                        <div className="bg-red-50 p-2 rounded-lg border border-red-200 text-xs text-red-900 font-mono">
                          🌐 إحداثيات العميل: {order.resolvedCustomerCoords?.lat.toFixed(5)}, {order.resolvedCustomerCoords?.lng.toFixed(5)}
                        </div>
                        <p className="text-[11px] text-gray-500 text-center">
                          ✅ يتم التتبع بدقة عالية عبر خريطة Leaflet المفتوحة داخل التطبيق
                        </p>

                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-2 rounded-lg transition-colors text-center shadow-xs"
                          >
                            <Phone size={12} />
                            اتصال بالعميل
                          </a>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            }

            return elements;
          })}
        </MapContainer>
      </div>
      
      {/* Map legend */}
      <div className="bg-white rounded-xl p-3 shadow-xs border border-gray-100">
        <div className="flex items-center justify-around text-xs font-semibold text-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"></div>
            <span>موقعك (السائق)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-xs"></div>
            <span>المتجر / الاستلام</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-xs"></div>
            <span>عنوان العميل (التوصيل)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 bg-blue-600 border-dashed"></div>
            <span>مسار التوجيه</span>
          </div>
        </div>
      </div>
    </div>
  );
}
