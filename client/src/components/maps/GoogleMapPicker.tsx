import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { MapPin, Navigation, Search, Check, X, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MapComponent from './MapComponent';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 15.3694,
  lng: 44.1910, // صنعاء، اليمن
};

const POPULAR_YEMEN_LOCATIONS = [
  { name: 'حدة (صنعاء)', query: 'حدة، صنعاء', lat: 15.3188, lng: 44.1963 },
  { name: 'السبعين', query: 'ميدان السبعين، صنعاء', lat: 15.3367, lng: 44.2045 },
  { name: 'التحرير', query: 'ميدان التحرير، صنعاء', lat: 15.3533, lng: 44.2078 },
  { name: 'شارع الستين', query: 'شارع الستين، صنعاء', lat: 15.3421, lng: 44.1754 },
  { name: 'شارع الزبيري', query: 'شارع الزبيري، صنعاء', lat: 15.3508, lng: 44.2012 },
  { name: 'بيت بوس', query: 'بيت بوس، صنعاء', lat: 15.2845, lng: 44.2034 },
  { name: 'عدن - المنصورة', query: 'المنصورة، عدن', lat: 12.8600, lng: 44.9950 },
  { name: 'عدن - كريتر', query: 'كريتر، عدن', lat: 12.7750, lng: 45.0350 },
  { name: 'تعز', query: 'تعز، اليمن', lat: 13.5775, lng: 44.0189 },
  { name: 'إب', query: 'إب، اليمن', lat: 13.9753, lng: 44.1708 },
  { name: 'المكلا', query: 'المكلا، حضرموت', lat: 14.5425, lng: 49.1242 },
];

interface LocationData {
  lat: number;
  lng: number;
  address: string;
  area?: string;
  city?: string;
}

interface GoogleMapPickerProps {
  onLocationSelect: (location: LocationData) => void;
  onCancel?: () => void;
  initialLocation?: { lat: number; lng: number };
  isOpen: boolean;
  onClose: () => void;
}

const libraries: ("places")[] = ["places"];

export default function GoogleMapPicker({
  onLocationSelect,
  onCancel,
  initialLocation,
  isOpen,
  onClose
}: GoogleMapPickerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasApiKey = !!apiKey && apiKey !== 'undefined' && apiKey !== '';

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries,
    language: 'ar',
    region: 'YE'
  });

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLocation || { lat: defaultCenter.lat, lng: defaultCenter.lng }
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    initialLocation?.lat || defaultCenter.lat,
    initialLocation?.lng || defaultCenter.lng
  ]);
  const [mapZoom, setMapZoom] = useState(15);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onMapLoad = useCallback((loadedMap: google.maps.Map) => {
    setMap(loadedMap);
  }, []);

  const getAddressFromCoords = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      // 1. Try server geocode reverse endpoint
      const srvRes = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && srvData.display_name) {
          setAddress(srvData.display_name);
          return;
        }
      }

      // 2. Try Google Geocoder if loaded
      if (hasApiKey && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results?.[0]) {
          setAddress(response.results[0].formatted_address);
          return;
        }
      }

      // 3. Fallback to OpenStreetMap Reverse
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar`
      );
      if (res.ok) {
        const data = await res.json();
        setAddress(data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setLoading(false);
    }
  };

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setMarker(newPos);
      setMapCenter([newPos.lat, newPos.lng]);
      getAddressFromCoords(newPos.lat, newPos.lng);
    }
  }, []);

  const handleSearch = async (queryText?: string) => {
    const q = (queryText ?? searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setShowDropdown(false);

    try {
      // 1. Direct coordinate format check (e.g. "15.3694, 44.1910")
      const coordMatch = q.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[3]);
        if (!isNaN(lat) && !isNaN(lng)) {
          const newPos = { lat, lng };
          setMarker(newPos);
          setMapCenter([lat, lng]);
          setMapZoom(16);
          if (map) {
            map.panTo(newPos);
            map.setZoom(16);
          }
          getAddressFromCoords(lat, lng);
          setIsSearching(false);
          return;
        }
      }

      // 2. Query our comprehensive Server Geocoding endpoint
      let foundList: Array<{ display_name: string; lat: string; lon: string }> = [];
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            foundList = data;
          }
        }
      } catch (e) {
        console.warn("Server geocode search error:", e);
      }

      // 3. Fallback to Google Geocoder if available
      if (foundList.length === 0 && window.google?.maps?.Geocoder) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          const gResult = await geocoder.geocode({ address: q, componentRestrictions: { country: 'YE' } });
          if (gResult.results && gResult.results.length > 0) {
            foundList = gResult.results.map((r: any) => ({
              display_name: r.formatted_address,
              lat: r.geometry.location.lat().toString(),
              lon: r.geometry.location.lng().toString()
            }));
          }
        } catch (gErr) {
          // ignore
        }
      }

      // 4. Fallback to Photon
      if (foundList.length === 0) {
        try {
          const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q + ' Yemen')}&lang=default&limit=5`);
          if (photonRes.ok) {
            const pData = await photonRes.json();
            if (pData?.features?.length > 0) {
              foundList = pData.features.map((f: any) => ({
                display_name: [f.properties.name, f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join('، '),
                lat: f.geometry.coordinates[1].toString(),
                lon: f.geometry.coordinates[0].toString()
              }));
            }
          }
        } catch (pErr) {
          // ignore
        }
      }

      if (foundList.length > 0) {
        setSearchResults(foundList);
        const top = foundList[0];
        const lat = parseFloat(top.lat);
        const lng = parseFloat(top.lon);
        const newPos = { lat, lng };

        setMarker(newPos);
        setMapCenter([lat, lng]);
        setMapZoom(16);
        setAddress(top.display_name);

        if (map) {
          map.panTo(newPos);
          map.setZoom(16);
        }

        if (foundList.length > 1) {
          setShowDropdown(true);
        }
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (item: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const newPos = { lat, lng };

    setMarker(newPos);
    setMapCenter([lat, lng]);
    setMapZoom(16);
    setAddress(item.display_name);
    setSearchQuery(item.display_name);
    setShowDropdown(false);

    if (map) {
      map.panTo(newPos);
      map.setZoom(16);
    }
  };

  const handleQuickPlaceSelect = (loc: typeof POPULAR_YEMEN_LOCATIONS[0]) => {
    const newPos = { lat: loc.lat, lng: loc.lng };
    setMarker(newPos);
    setMapCenter([loc.lat, loc.lng]);
    setMapZoom(16);
    setAddress(loc.query);
    setSearchQuery(loc.name);
    setShowDropdown(false);

    if (map) {
      map.panTo(newPos);
      map.setZoom(16);
    }
  };

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMarker(newPos);
          setMapCenter([newPos.lat, newPos.lng]);
          setMapZoom(16);
          getAddressFromCoords(newPos.lat, newPos.lng);
          if (map) {
            map.panTo(newPos);
            map.setZoom(16);
          }
          setLoading(false);
        },
        () => {
          setLoading(false);
          console.log("Geolocation permission denied or error");
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    }
  }, [map]);

  // Initial geocode fetch if address is missing
  useEffect(() => {
    if (isOpen && marker && !address) {
      getAddressFromCoords(marker.lat, marker.lng);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (marker) {
      onLocationSelect({
        lat: marker.lat,
        lng: marker.lng,
        address: address || `${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}`
      });
      onClose();
    }
  };

  const handleLeafletSelect = (lat: number, lng: number, addr: string) => {
    setMarker({ lat, lng });
    setMapCenter([lat, lng]);
    setAddress(addr);
  };

  if (!isOpen) return null;

  // Search Header Component reused in both Leaflet and Google Maps modes
  const renderHeader = (title: string) => (
    <div className="flex flex-col bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 relative z-50">
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 bg-gradient-to-r from-orange-600 to-[#f06424] text-white shadow-sm">
        {/* Title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base leading-tight">{title}</h2>
            <p className="text-[11px] text-orange-100 hidden sm:block">ابحث بالاسم أو حدد النقطة مباشرة على الخريطة</p>
          </div>
        </div>

        {/* Embedded Search Bar */}
        <div className="relative flex-1 max-w-sm sm:max-w-md mx-1 sm:mx-2" ref={searchContainerRef}>
          <div className="flex items-center bg-white rounded-xl shadow-lg border border-orange-200 px-1 py-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="ابحث عن منطقة، شارع، معلم (مثال: حدة، السبعين)..."
              className="w-full py-1 px-3 text-xs sm:text-sm text-gray-900 placeholder-gray-400 bg-transparent border-none focus:outline-none text-right font-medium"
              dir="rtl"
            />
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="bg-[#f06424] hover:bg-orange-700 active:scale-95 text-white px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 shadow-sm text-xs font-bold"
              title="بحث عن موقع"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="hidden sm:inline">بحث</span>
            </button>
          </div>

          {/* Dropdown for search suggestions / results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden z-[9999] max-h-60 overflow-y-auto" dir="rtl">
              <div className="p-2 bg-orange-50 dark:bg-orange-950/40 text-[11px] font-bold text-orange-800 dark:text-orange-300 border-b border-orange-100 dark:border-orange-900/50 flex items-center justify-between">
                <span>نتائج البحث المتاحة ({searchResults.length}):</span>
                <button onClick={() => setShowDropdown(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-right p-2.5 hover:bg-orange-50/80 dark:hover:bg-zinc-800 border-b border-gray-100 dark:border-zinc-800 last:border-b-0 flex items-start gap-2.5 transition-colors group"
                >
                  <MapPin className="h-4 w-4 text-[#f06424] mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-relaxed">
                    {item.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <button 
          onClick={() => {
            if (onCancel) onCancel();
            onClose();
          }} 
          className="p-2 hover:bg-white/20 active:scale-95 rounded-xl transition-all shrink-0 text-white"
          title="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Location Chips */}
      <div className="px-3 py-2 bg-orange-50/60 dark:bg-zinc-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar" dir="rtl">
        <div className="flex items-center gap-1 text-[11px] font-bold text-orange-800 dark:text-orange-400 shrink-0 ml-1">
          <Sparkles className="h-3.5 w-3.5 text-orange-500" />
          <span>أماكن شائعة:</span>
        </div>
        {POPULAR_YEMEN_LOCATIONS.map((loc, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickPlaceSelect(loc)}
            className="text-[11px] font-medium bg-white dark:bg-zinc-900 hover:bg-orange-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-lg border border-orange-200/70 dark:border-zinc-700 transition-colors shrink-0 active:scale-95 shadow-2xs"
          >
            {loc.name}
          </button>
        ))}
      </div>
    </div>
  );

  // Fallback to Leaflet if API Key is missing or error loading
  if (!hasApiKey || loadError) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-2 sm:p-4" dir="rtl">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
          {/* Header with Search */}
          {renderHeader("تحديد الموقع عبر الخريطة")}

          {/* Map */}
          <div className="flex-1 relative bg-slate-100 dark:bg-zinc-950">
            <MapComponent
              center={mapCenter}
              zoom={mapZoom}
              markers={marker ? [{
                position: [marker.lat, marker.lng],
                title: address || "الموقع المختار",
                type: 'destination'
              }] : []}
              onLocationSelect={handleLeafletSelect}
              height="100%"
            />
            
            <button
              type="button"
              className="absolute bottom-6 left-6 w-11 h-11 rounded-full bg-[#f06424] hover:bg-orange-600 text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 border-2 border-white dark:border-zinc-800 z-[1000]"
              onClick={getCurrentLocation}
              disabled={loading}
              title="تحديد موقعي الحالي"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5 -rotate-45" />}
            </button>
          </div>

          {/* Footer Card & Actions */}
          <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex flex-col gap-3">
              {/* Selected Location Box */}
              <div className="flex items-start gap-2.5 bg-orange-50/70 dark:bg-orange-950/30 p-3 rounded-xl border border-orange-200 dark:border-orange-900/50">
                <MapPin className="h-5 w-5 text-[#f06424] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-400">الموقع المختار:</p>
                    {marker && (
                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                        {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-snug font-medium break-words mt-0.5">
                    {loading ? "جاري التحديد..." : address || "انقر على الخريطة أو ابحث لتحديد المكان"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 rounded-xl text-gray-700 dark:text-gray-300 font-bold border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800" 
                  onClick={() => {
                    if (onCancel) onCancel();
                    onClose();
                  }}
                >
                  إلغاء
                </Button>
                <Button 
                  className="flex-1 h-11 rounded-xl gap-2 font-bold bg-[#f06424] hover:bg-orange-600 text-white shadow-md transition-all active:scale-[0.99]" 
                  disabled={!marker || loading}
                  onClick={handleConfirm}
                >
                  <Check className="h-4 w-4" />
                  تأكيد الموقع
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center" dir="rtl">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl border border-gray-100 dark:border-zinc-800">
          <Loader2 className="h-8 w-8 animate-spin text-[#f06424]" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">جاري تحميل الخريطة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
        {/* Header with Search */}
        {renderHeader("تحديد الموقع بدقة عبر الخريطة")}

        {/* Map */}
        <div className="flex-1 relative bg-slate-100 dark:bg-zinc-950">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={marker || initialLocation || defaultCenter}
            zoom={mapZoom}
            onClick={onMapClick}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {marker && <Marker position={marker} />}
          </GoogleMap>

          <button
            type="button"
            className="absolute bottom-6 left-6 w-11 h-11 rounded-full bg-[#f06424] hover:bg-orange-600 text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 border-2 border-white dark:border-zinc-800 z-[1000]"
            onClick={getCurrentLocation}
            disabled={loading}
            title="تحديد موقعي الحالي"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5 -rotate-45" />}
          </button>
        </div>

        {/* Footer Card & Actions */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex flex-col gap-3">
            {/* Selected Location Box */}
            <div className="flex items-start gap-2.5 bg-orange-50/70 dark:bg-orange-950/30 p-3 rounded-xl border border-orange-200 dark:border-orange-900/50">
              <MapPin className="h-5 w-5 text-[#f06424] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-400">الموقع المختار:</p>
                  {marker && (
                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                      {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-snug font-medium break-words mt-0.5">
                  {loading ? "جاري التحديد..." : address || "انقر على الخريطة أو ابحث لتحديد المكان"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 h-11 rounded-xl text-gray-700 dark:text-gray-300 font-bold border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800" 
                onClick={() => {
                  if (onCancel) onCancel();
                  onClose();
                }}
              >
                إلغاء
              </Button>
              <Button 
                className="flex-1 h-11 rounded-xl gap-2 font-bold bg-[#f06424] hover:bg-orange-600 text-white shadow-md transition-all active:scale-[0.99]" 
                disabled={!marker || loading}
                onClick={handleConfirm}
              >
                <Check className="h-4 w-4" />
                تأكيد الموقع
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
