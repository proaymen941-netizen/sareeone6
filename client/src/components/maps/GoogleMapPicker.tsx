import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Check, X, Loader2, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MapComponent from './MapComponent';

const defaultCenter = {
  lat: 15.3694,
  lng: 44.1910, // صنعاء
};

const POPULAR_GLOBAL_LOCATIONS = [
  { name: 'صنعاء (حدة)', query: 'حي حدة، صنعاء', lat: 15.3188, lng: 44.1963 },
  { name: 'صنعاء (السبعين)', query: 'ميدان السبعين، صنعاء', lat: 15.3367, lng: 44.2045 },
  { name: 'عدن (المنصورة)', query: 'المنصورة، عدن', lat: 12.8600, lng: 44.9950 },
  { name: 'تعز', query: 'مدينة تعز، اليمن', lat: 13.5775, lng: 44.0189 },
  { name: 'مكة المكرمة', query: 'مكة المكرمة، السعودية', lat: 21.3891, lng: 39.8579 },
  { name: 'الرياض', query: 'الرياض، السعودية', lat: 24.7136, lng: 46.6753 },
  { name: 'جدة', query: 'جدة، السعودية', lat: 21.5433, lng: 39.1728 },
  { name: 'دبي', query: 'دبي، الإمارات', lat: 25.2048, lng: 55.2708 },
  { name: 'القاهرة', query: 'القاهرة، مصر', lat: 30.0444, lng: 31.2357 },
  { name: 'عمان', query: 'عمان، الأردن', lat: 31.9454, lng: 35.9284 },
  { name: 'اسطنبول', query: 'اسطنبول، تركيا', lat: 41.0082, lng: 28.9784 },
  { name: 'لندن', query: 'لندن، المملكة المتحدة', lat: 51.5074, lng: -0.1278 },
];

export interface LocationData {
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

export default function GoogleMapPicker({
  onLocationSelect,
  onCancel,
  initialLocation,
  isOpen,
  onClose
}: GoogleMapPickerProps) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLocation || { lat: defaultCenter.lat, lng: defaultCenter.lng }
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    initialLocation?.lat || defaultCenter.lat,
    initialLocation?.lng || defaultCenter.lng
  ]);
  const [mapZoom, setMapZoom] = useState(16);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Update center when initialLocation changes
  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      setMarker({ lat: initialLocation.lat, lng: initialLocation.lng });
      setMapCenter([initialLocation.lat, initialLocation.lng]);
    }
  }, [initialLocation?.lat, initialLocation?.lng]);

  const getAddressFromCoords = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      // 1. Try server geocode reverse endpoint (Worldwide)
      const srvRes = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && srvData.display_name) {
          setAddress(srvData.display_name);
          return;
        }
      }

      // 2. Fallback to OpenStreetMap Reverse
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar,en`
      );
      if (res.ok) {
        const data = await res.json();
        setAddress(data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (error) {
      console.warn("Geocoding reverse error:", error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = async (queryText: string, autoSelectFirst = true) => {
    const q = queryText.trim();
    if (!q) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);

    try {
      // 1. Direct coordinate format check (e.g. "24.7136, 46.6753" or "15.3694 44.1910")
      const coordMatch = q.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[3]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          const newPos = { lat, lng };
          setMarker(newPos);
          setMapCenter([lat, lng]);
          setMapZoom(16);
          getAddressFromCoords(lat, lng);
          setIsSearching(false);
          setShowDropdown(false);
          return;
        }
      }

      // 2. Query Worldwide Server Geocoding endpoint
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

      // 3. Fallback to Photon Worldwide
      if (foundList.length === 0) {
        try {
          const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=default&limit=6`);
          if (photonRes.ok) {
            const pData = await photonRes.json();
            if (pData?.features?.length > 0) {
              foundList = pData.features.map((f: any) => ({
                display_name: [f.properties.name, f.properties.street, f.properties.district, f.properties.city, f.properties.country].filter(Boolean).join('، '),
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
        setShowDropdown(true);

        if (autoSelectFirst) {
          const top = foundList[0];
          const lat = parseFloat(top.lat);
          const lng = parseFloat(top.lon);
          const newPos = { lat, lng };

          setMarker(newPos);
          setMapCenter([lat, lng]);
          setMapZoom(16);
          setAddress(top.display_name);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Search input change handler with instant debounced suggestions
  const handleInputChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(val, false);
      }, 400);
    } else {
      setShowDropdown(false);
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
  };

  const handleQuickPlaceSelect = (loc: typeof POPULAR_GLOBAL_LOCATIONS[0]) => {
    const newPos = { lat: loc.lat, lng: loc.lng };
    setMarker(newPos);
    setMapCenter([loc.lat, loc.lng]);
    setMapZoom(16);
    setAddress(loc.query);
    setSearchQuery(loc.name);
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
          setLoading(false);
        },
        () => {
          setLoading(false);
          console.log("Geolocation permission denied or error");
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    }
  }, []);

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
        
        {/* Header with Search & Quick Chips */}
        <div className="flex flex-col bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 relative z-50">
          <div className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 bg-gradient-to-r from-orange-600 via-[#f06424] to-amber-600 text-white shadow-sm">
            {/* Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base leading-tight">تحديد موقع المتجر بدقة على الخريطة</h2>
                <p className="text-[11px] text-orange-100 hidden sm:block">ابحث في جميع مدن ودول العالم بدقة أو انقر مباشرة على الخريطة</p>
              </div>
            </div>

            {/* Embedded Search Bar with instant Dropdown */}
            <div className="relative flex-1 max-w-sm sm:max-w-md mx-1 sm:mx-2" ref={searchContainerRef}>
              <div className="flex items-center bg-white rounded-xl shadow-lg border border-orange-200 px-1 py-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      executeSearch(searchQuery, true);
                    }
                  }}
                  placeholder="ابحث بالاسم أو العنوان أو الإحداثيات..."
                  className="w-full py-1.5 px-3 text-xs sm:text-sm text-gray-900 placeholder-gray-400 bg-transparent border-none focus:outline-none text-right font-medium"
                  dir="rtl"
                />
                <button
                  type="button"
                  onClick={() => executeSearch(searchQuery, true)}
                  disabled={isSearching}
                  className="bg-[#f06424] hover:bg-orange-700 active:scale-95 text-white px-3.5 py-1.5 rounded-lg transition-all shrink-0 flex items-center gap-1.5 shadow-sm text-xs font-bold"
                  title="بحث دقيق"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">بحث</span>
                </button>
              </div>

              {/* Dropdown for search suggestions / results */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden z-[9999] max-h-64 overflow-y-auto" dir="rtl">
                  <div className="p-2 bg-orange-50 dark:bg-orange-950/40 text-[11px] font-bold text-orange-800 dark:text-orange-300 border-b border-orange-100 dark:border-orange-900/50 flex items-center justify-between">
                    <span>نتائج البحث المباشرة ({searchResults.length}):</span>
                    <button onClick={() => setShowDropdown(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="w-full text-right p-2.5 hover:bg-orange-50/90 dark:hover:bg-zinc-800 border-b border-gray-100 dark:border-zinc-800 last:border-b-0 flex items-start gap-2.5 transition-colors group"
                    >
                      <MapPin className="h-4 w-4 text-[#f06424] mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed">
                          {item.display_name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lon).toFixed(4)}
                        </span>
                      </div>
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
              <span>وجهات سريعة:</span>
            </div>
            {POPULAR_GLOBAL_LOCATIONS.map((loc, idx) => (
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

        {/* Interactive Map Component */}
        <div className="flex-1 relative bg-slate-100 dark:bg-zinc-950">
          <MapComponent
            center={mapCenter}
            zoom={mapZoom}
            markers={marker ? [{
              position: [marker.lat, marker.lng],
              title: address || "موقع المتجر المحدد",
              type: 'destination'
            }] : []}
            onLocationSelect={handleLeafletSelect}
            height="100%"
          />
          
          <button
            type="button"
            className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-[#f06424] hover:bg-orange-600 text-white shadow-2xl flex items-center justify-center transition-transform active:scale-95 border-2 border-white dark:border-zinc-800 z-[1000]"
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
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-400">الموقع المختار للمتجر:</p>
                  {marker && (
                    <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-white/70 dark:bg-zinc-800 px-2 py-0.5 rounded border border-orange-200/50">
                      {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-snug font-medium break-words mt-1">
                  {loading ? "جاري جلب العنوان الدقيق..." : address || "انقر على الخريطة أو ابحث لتثبيت موقع المتجر"}
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
                اعتماد وتثبيت الموقع
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
