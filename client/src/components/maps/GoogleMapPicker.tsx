import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { MapPin, Navigation, Search, Check, X, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
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
    initialLocation || null
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
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
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

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const getAddressFromCoords = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      if (hasApiKey && window.google) {
        const geocoder = new window.google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results[0]) {
          setAddress(response.results[0].formatted_address);
          return;
        }
      }

      // Reverse geocoding via Nominatim
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
      getAddressFromCoords(newPos.lat, newPos.lng);
    }
  }, []);

  const onPlaceSelected = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setMarker(newPos);
        setMapCenter([newPos.lat, newPos.lng]);
        setAddress(place.formatted_address || '');
        if (map) {
          map.panTo(newPos);
          map.setZoom(17);
        }
      }
    }
  };

  const handleSearch = async (queryText?: string) => {
    const q = (queryText ?? searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setShowDropdown(false);

    try {
      // 1. Check if user typed coordinates like "15.3694, 44.1910"
      const coordMatch = q.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[3]);
        if (!isNaN(lat) && !isNaN(lng)) {
          const newPos = { lat, lng };
          setMarker(newPos);
          setMapCenter([lat, lng]);
          setMapZoom(16);
          getAddressFromCoords(lat, lng);
          setIsSearching(false);
          return;
        }
      }

      // 2. OpenStreetMap Nominatim search
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&accept-language=ar&addressdetails=1&limit=5`
      );
      if (res.ok) {
        const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
        if (data && data.length > 0) {
          setSearchResults(data);
          const top = data[0];
          const lat = parseFloat(top.lat);
          const lng = parseFloat(top.lon);
          setMarker({ lat, lng });
          setMapCenter([lat, lng]);
          setMapZoom(16);
          setAddress(top.display_name);

          if (data.length > 1) {
            setShowDropdown(true);
          }
        } else {
          // Retry appending Yemen or general query if not found
          const fallbackRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ' اليمن')}&accept-language=ar&addressdetails=1&limit=5`
          );
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData && fallbackData.length > 0) {
              setSearchResults(fallbackData);
              const top = fallbackData[0];
              const lat = parseFloat(top.lat);
              const lng = parseFloat(top.lon);
              setMarker({ lat, lng });
              setMapCenter([lat, lng]);
              setMapZoom(16);
              setAddress(top.display_name);
              if (fallbackData.length > 1) {
                setShowDropdown(true);
              }
              setIsSearching(false);
              return;
            }
          }
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
    setMarker({ lat, lng });
    setMapCenter([lat, lng]);
    setMapZoom(16);
    setAddress(item.display_name);
    setSearchQuery(item.display_name);
    setShowDropdown(false);
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
            map.setZoom(17);
          }
          setLoading(false);
        },
        () => {
          setLoading(false);
          console.log("Geolocation permission denied or error");
        },
        { enableHighAccuracy: true }
      );
    }
  }, [map, hasApiKey]);

  // Request location automatically when opened if no initial location
  useEffect(() => {
    if (isOpen && !marker && !initialLocation) {
      getCurrentLocation();
    }
  }, [isOpen, marker, initialLocation, getCurrentLocation]);

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
    <div className="p-3 sm:p-4 border-b flex items-center justify-between bg-[#f06424] text-white gap-2 sm:gap-4 relative z-50">
      {/* Title */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <MapPin className="h-5 w-5 text-white" />
        <h2 className="font-bold text-sm sm:text-base whitespace-nowrap">{title}</h2>
      </div>

      {/* Embedded Search Bar (matching screenshot) */}
      <div className="relative flex-1 max-w-xs sm:max-w-md mx-1 sm:mx-2" ref={searchContainerRef}>
        <div className="flex items-center bg-white rounded-xl shadow-md border border-white/50 px-1 py-0.5">
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
            placeholder="أبحث هنا"
            className="w-full py-1.5 px-3 text-xs sm:text-sm text-gray-900 placeholder-gray-400 bg-transparent border-none focus:outline-none text-right font-medium"
            dir="rtl"
          />
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="bg-[#f06424] hover:bg-orange-600 active:scale-95 text-white p-2 rounded-lg transition-all shrink-0 flex items-center justify-center shadow-sm"
            title="بحث عن موقع"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>

        {/* Dropdown for search suggestions / results */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[9999] max-h-56 overflow-y-auto" dir="rtl">
            <div className="p-1.5 bg-orange-50 text-[11px] font-bold text-orange-800 border-b border-orange-100 flex items-center justify-between">
              <span>نتائج البحث ({searchResults.length}):</span>
              <button onClick={() => setShowDropdown(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-right p-2.5 hover:bg-orange-50/80 border-b border-gray-100 last:border-b-0 flex items-start gap-2 transition-colors group"
              >
                <MapPin className="h-4 w-4 text-[#f06424] mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-800 line-clamp-2 leading-relaxed">
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
        className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0 text-white"
        title="إغلاق"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
    </div>
  );

  // Fallback to Leaflet if API Key is missing or error loading
  if (!hasApiKey || loadError) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
          {/* Header with Search */}
          {renderHeader("تحديد الموقع (نظام بديل)")}

          {!hasApiKey && (
            <div className="bg-[#fef9ee] p-3 flex items-center gap-3 text-[#92400e] text-xs sm:text-sm border-b border-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <p>مفتاح خرائط جوجل غير متوفر. تم تفعيل نظام الخرائط المفتوحة (Leaflet) كبديل لضمان استمرارية الخدمة.</p>
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative bg-slate-100">
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
              className="absolute bottom-6 left-6 w-11 h-11 rounded-full bg-[#5c2409] hover:bg-[#431804] text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 border-2 border-white z-[1000]"
              onClick={getCurrentLocation}
              disabled={loading}
              title="تحديد موقعي الحالي"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5 -rotate-45" />}
            </button>
          </div>

          {/* Footer Card & Actions */}
          <div className="p-3 sm:p-4 border-t bg-white">
            <div className="flex flex-col gap-3">
              {/* Selected Location Box (Matching screenshot blue card) */}
              <div className="flex items-start gap-2.5 bg-[#eff6ff] p-3 rounded-xl border border-[#dbeafe]">
                <MapPin className="h-5 w-5 text-[#2563eb] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#2563eb] mb-0.5">الموقع المختار:</p>
                  <p className="text-xs sm:text-sm text-gray-700 leading-snug font-medium break-words">
                    {loading ? "جاري التحديد..." : address || "انقر على الخريطة لتحديد الموقع"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 rounded-xl text-gray-700 font-bold border-gray-300 hover:bg-gray-100" 
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
        <div className="bg-white p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-[#f06424]" />
          <p className="text-sm font-bold text-gray-700">جاري تحميل الخريطة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        {/* Header with Search */}
        {renderHeader("تحديد الموقع بدقة")}

        {/* Map */}
        <div className="flex-1 relative bg-slate-100">
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
            className="absolute bottom-6 left-6 w-11 h-11 rounded-full bg-[#5c2409] hover:bg-[#431804] text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 border-2 border-white z-[1000]"
            onClick={getCurrentLocation}
            disabled={loading}
            title="تحديد موقعي الحالي"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5 -rotate-45" />}
          </button>
        </div>

        {/* Footer Card & Actions */}
        <div className="p-3 sm:p-4 border-t bg-white">
          <div className="flex flex-col gap-3">
            {/* Selected Location Box */}
            <div className="flex items-start gap-2.5 bg-[#eff6ff] p-3 rounded-xl border border-[#dbeafe]">
              <MapPin className="h-5 w-5 text-[#2563eb] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#2563eb] mb-0.5">الموقع المختار:</p>
                <p className="text-xs sm:text-sm text-gray-700 leading-snug font-medium break-words">
                  {loading ? "جاري التحديد..." : address || "انقر على الخريطة لتحديد الموقع"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 h-11 rounded-xl text-gray-700 font-bold border-gray-300 hover:bg-gray-100" 
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

