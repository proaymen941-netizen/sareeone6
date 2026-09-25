import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom pin icon with high visibility
const defaultPinIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 24 32" fill="none">
      <path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37258 18.6274 0 12 0Z" fill="#f06424"/>
      <circle cx="12" cy="11" r="5" fill="white"/>
      <circle cx="12" cy="11" r="2.5" fill="#f06424"/>
    </svg>
  `),
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -42]
});

// Custom driver icon
const driverIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" fill="#10b981" stroke="white"/>
      <path d="M5 13l4 4L19 7" stroke="white" stroke-width="3" fill="none"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

// Custom destination icon
const destinationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 24 32" fill="none">
      <path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37258 18.6274 0 12 0Z" fill="#ef4444"/>
      <circle cx="12" cy="11" r="4.5" fill="white"/>
    </svg>
  `),
  iconSize: [38, 48],
  iconAnchor: [19, 48],
  popupAnchor: [0, -44]
});

interface MapComponentProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    title: string;
    type?: 'driver' | 'destination' | 'default';
    popup?: string;
  }>;
  driverPosition?: [number, number];
  showDriverRadius?: boolean;
  onLocationSelect?: (lat: number, lng: number, address: string) => void;
  height?: string;
}

// Component to handle map events and automatic size calculation
function MapEvents({ onLocationSelect }: { onLocationSelect?: MapComponentProps['onLocationSelect'] }) {
  const map = useMap();
  
  useEffect(() => {
    // Invalidate map size so Leaflet renders all tiles immediately inside modals
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 200);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    if (onLocationSelect) {
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        try {
          // 1. Try our backend reverse geocoder
          const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) {
              onLocationSelect(lat, lng, data.display_name);
              return;
            }
          }
        } catch (error) {
          console.warn('Backend reverse geocode failed, trying OSM fallback:', error);
        }

        // 2. OSM direct fallback
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar,en`
          );
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            const address = osmData.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            onLocationSelect(lat, lng, address);
            return;
          }
        } catch (osmErr) {
          // ignore
        }

        onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      });
    }
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.off('click');
    };
  }, [map, onLocationSelect]);
  
  return null;
}

// Component to update map view with smooth animation
function UpdateMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, { duration: 0.7 });
      map.invalidateSize();
    }
  }, [map, center[0], center[1], zoom]);
  
  return null;
}

export default function MapComponent({
  center,
  zoom = 15,
  markers = [],
  driverPosition,
  showDriverRadius = false,
  onLocationSelect,
  height = '100%'
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div style={{ height, width: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        
        <UpdateMapView center={center} zoom={zoom} />
        <MapEvents onLocationSelect={onLocationSelect} />
        
        {/* Driver position with radius */}
        {driverPosition && (
          <>
            <Marker position={driverPosition} icon={driverIcon}>
              <Popup>موقع السائق الحالي</Popup>
            </Marker>
            {showDriverRadius && (
              <Circle
                center={driverPosition}
                radius={1000} // 1km radius
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.1,
                }}
              />
            )}
          </>
        )}
        
        {/* Markers */}
        {markers.map((marker, index) => {
          const icon = marker.type === 'driver' 
            ? driverIcon 
            : marker.type === 'destination' 
            ? destinationIcon 
            : defaultPinIcon;
          
          return (
            <Marker key={index} position={marker.position} icon={icon}>
              <Popup>
                <div className="text-right p-1 font-sans" dir="rtl">
                  <strong className="block text-xs font-bold text-gray-900">{marker.title}</strong>
                  {marker.popup && <p className="text-[11px] text-gray-600 mt-1">{marker.popup}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
