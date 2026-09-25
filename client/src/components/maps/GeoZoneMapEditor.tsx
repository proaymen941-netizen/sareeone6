import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  CircleDot, 
  Pentagon, 
  RotateCcw, 
  Trash2, 
  Check, 
  Sparkles,
  Layers,
  Crosshair
} from 'lucide-react';

// Fix leaflet icon default assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Marker icon for center
const centerPinIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" stroke-width="2">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="3" fill="#ffffff"/>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

// Vertex pin icon for polygon vertices
const vertexPinIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2">
      <circle cx="12" cy="12" r="8"/>
    </svg>
  `),
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

export interface ExistingZone {
  id: string;
  name: string;
  description?: string | null;
  coordinates: string;
  deliveryFee?: string | null;
  surgeMultiplier?: string | null;
  isActive?: boolean;
}

interface GeoZoneMapEditorProps {
  initialCoordinates?: string;
  existingZones?: ExistingZone[];
  onChange: (coordinatesJson: string) => void;
  height?: string;
}

// Map event listener
function MapClickHandler({ 
  mode, 
  onAddPoint, 
  onSetCenter 
}: { 
  mode: 'circle' | 'polygon';
  onAddPoint: (lat: number, lng: number) => void;
  onSetCenter: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (mode === 'circle') {
        onSetCenter(e.latlng.lat, e.latlng.lng);
      } else {
        onAddPoint(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, mode, onAddPoint, onSetCenter]);

  return null;
}

// Controller to pan map when requested
function MapViewController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 13, { duration: 0.8 });
    }
  }, [map, target]);
  return null;
}

const PRESET_LOCATIONS = [
  { name: 'صنعاء - حدة والسبعين', lat: 15.3180, lng: 44.1950, radius: 4.5 },
  { name: 'صنعاء - التحرير وباب اليمن', lat: 15.3550, lng: 44.2080, radius: 3.5 },
  { name: 'صنعاء - مذبح وشارع الستين', lat: 15.3780, lng: 44.1700, radius: 4.0 },
  { name: 'صنعاء - الحصبة والمطار', lat: 15.4100, lng: 44.2150, radius: 5.0 },
  { name: 'عدن - كريتر والمعلا', lat: 12.7850, lng: 45.0350, radius: 4.0 },
  { name: 'عدن - المنصورة والشيخ عثمان', lat: 12.8600, lng: 44.9850, radius: 5.0 },
];

const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function GeoZoneMapEditor({
  initialCoordinates,
  existingZones = [],
  onChange,
  height = '420px'
}: GeoZoneMapEditorProps) {
  const [mode, setMode] = useState<'circle' | 'polygon'>('circle');
  const [center, setCenter] = useState<[number, number]>([15.3550, 44.2080]); // صنعاء كمركز افتراضي
  const [radiusKm, setRadiusKm] = useState<number>(4);
  const [polygonPoints, setPolygonPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  // Parse initial coordinates if provided
  useEffect(() => {
    if (initialCoordinates) {
      try {
        const parsed = JSON.parse(initialCoordinates);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          setMode('polygon');
          setPolygonPoints(parsed);
          setCenter([parsed[0].lat, parsed[0].lng]);
          setFlyTarget([parsed[0].lat, parsed[0].lng]);
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.type === 'circle' || parsed.center) {
            setMode('circle');
            const c = parsed.center || { lat: parsed.lat, lng: parsed.lng };
            if (c.lat && c.lng) {
              setCenter([c.lat, c.lng]);
              setFlyTarget([c.lat, c.lng]);
            }
            if (parsed.radiusKm) setRadiusKm(Number(parsed.radiusKm));
            else if (parsed.radius) setRadiusKm(Number(parsed.radius) / 1000);
          } else if (Array.isArray(parsed.polygon)) {
            setMode('polygon');
            setPolygonPoints(parsed.polygon);
          }
        }
      } catch (e) {
        console.warn('Could not parse initial coordinates:', e);
      }
    }
  }, [initialCoordinates]);

  // Sync with parent when state changes
  useEffect(() => {
    if (mode === 'circle') {
      const circleData = {
        type: 'circle',
        center: { lat: Number(center[0].toFixed(6)), lng: Number(center[1].toFixed(6)) },
        radiusKm: radiusKm
      };
      onChange(JSON.stringify(circleData));
    } else {
      if (polygonPoints.length >= 3) {
        onChange(JSON.stringify(polygonPoints));
      } else {
        onChange(JSON.stringify([]));
      }
    }
  }, [mode, center, radiusKm, polygonPoints, onChange]);

  const handleAddPoint = (lat: number, lng: number) => {
    setPolygonPoints(prev => [...prev, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }]);
  };

  const handleSetCenter = (lat: number, lng: number) => {
    setCenter([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
  };

  const handleUndoPoint = () => {
    setPolygonPoints(prev => prev.slice(0, -1));
  };

  const handleClearPoints = () => {
    setPolygonPoints([]);
  };

  const applyPreset = (preset: typeof PRESET_LOCATIONS[0]) => {
    setCenter([preset.lat, preset.lng]);
    setRadiusKm(preset.radius);
    setMode('circle');
    setFlyTarget([preset.lat, preset.lng]);
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border">
        {/* Mode Selector */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={mode === 'circle' ? 'default' : 'outline'}
            onClick={() => setMode('circle')}
            className="flex items-center gap-1.5 text-xs h-8"
          >
            <CircleDot className="h-3.5 w-3.5" />
            نطاق دائري (نصف قطر)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'polygon' ? 'default' : 'outline'}
            onClick={() => setMode('polygon')}
            className="flex items-center gap-1.5 text-xs h-8"
          >
            <Pentagon className="h-3.5 w-3.5" />
            مضلع جغرافي (نقاط حدودية)
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full">
          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            أماكن سريعة:
          </span>
          {PRESET_LOCATIONS.slice(0, 4).map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset)}
              className="text-xs bg-background hover:bg-muted px-2 py-1 rounded border whitespace-nowrap transition-colors"
            >
              {preset.name.replace('صنعاء - ', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Specific Mode Controls */}
      {mode === 'circle' ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-primary flex items-center gap-1.5">
                <Crosshair className="h-4 w-4" />
                مركز النطاق: {center[0].toFixed(4)}, {center[1].toFixed(4)}
              </span>
              <span className="font-bold text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                نصف القطر: {radiusKm} كم (المحيط: {(radiusKm * 2).toFixed(1)} كم)
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">0.5 كم</span>
              <Slider
                value={[radiusKm]}
                min={0.5}
                max={25}
                step={0.5}
                onValueChange={(val) => setRadiusKm(val[0])}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">25 كم</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 انقر في أي مكان على الخريطة لتغيير مركز المنطقة الدائرية مباشرة.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                عدد نقاط حدود المنطقة: {polygonPoints.length} نقطة
              </span>
              {polygonPoints.length < 3 ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  انقر على الخريطة لإضافة 3 نقاط على الأقل لتشكيل المنطقة الحدودية.
                </p>
              ) : (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  ✅ تم رسم المضلع بنجاح ({polygonPoints.length} رؤوس).
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleUndoPoint}
                disabled={polygonPoints.length === 0}
                className="text-xs h-7 px-2"
              >
                <RotateCcw className="h-3 w-3 ml-1" />
                تراجع
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleClearPoints}
                disabled={polygonPoints.length === 0}
                className="text-xs h-7 px-2"
              >
                <Trash2 className="h-3 w-3 ml-1" />
                مسح
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaflet Map */}
      <div 
        style={{ height }} 
        className="w-full rounded-lg overflow-hidden border shadow-sm relative z-0"
      >
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewController target={flyTarget} />
          <MapClickHandler
            mode={mode}
            onAddPoint={handleAddPoint}
            onSetCenter={handleSetCenter}
          />

          {/* Render Existing Zones for context */}
          {existingZones.map((ez, idx) => {
            try {
              const data = JSON.parse(ez.coordinates);
              const color = ZONE_COLORS[idx % ZONE_COLORS.length];

              if (data && (data.type === 'circle' || data.center)) {
                const c = data.center || { lat: data.lat, lng: data.lng };
                const r = (data.radiusKm || 5) * 1000;
                return (
                  <Circle
                    key={ez.id}
                    center={[c.lat, c.lng]}
                    radius={r}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.15,
                      dashArray: '4, 4'
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-right" dir="rtl">
                        <strong className="block font-bold text-sm">{ez.name}</strong>
                        {ez.description && <p className="text-xs text-gray-600">{ez.description}</p>}
                        <div className="mt-1 text-xs text-primary font-semibold">
                          الرسوم: {ez.deliveryFee || 0} ريال
                        </div>
                      </div>
                    </Popup>
                  </Circle>
                );
              } else if (Array.isArray(data) && data.length >= 3) {
                const positions: [number, number][] = data.map(p => [p.lat, p.lng]);
                return (
                  <Polygon
                    key={ez.id}
                    positions={positions}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.15,
                      dashArray: '4, 4'
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-right" dir="rtl">
                        <strong className="block font-bold text-sm">{ez.name}</strong>
                        {ez.description && <p className="text-xs text-gray-600">{ez.description}</p>}
                        <div className="mt-1 text-xs text-primary font-semibold">
                          الرسوم: {ez.deliveryFee || 0} ريال
                        </div>
                      </div>
                    </Popup>
                  </Polygon>
                );
              }
            } catch (e) {
              return null;
            }
            return null;
          })}

          {/* Active Circle under creation/edit */}
          {mode === 'circle' && (
            <>
              <Marker position={center} icon={centerPinIcon}>
                <Popup>
                  <div className="text-right font-medium text-xs">
                    مركز المنطقة المحددة حالياً
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={center}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#2563eb',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.25,
                  weight: 2
                }}
              />
            </>
          )}

          {/* Active Polygon under creation/edit */}
          {mode === 'polygon' && (
            <>
              {polygonPoints.map((p, idx) => (
                <Marker key={idx} position={[p.lat, p.lng]} icon={vertexPinIcon}>
                  <Popup>
                    <span className="text-xs">نقطة #{idx + 1}</span>
                  </Popup>
                </Marker>
              ))}
              {polygonPoints.length >= 3 && (
                <Polygon
                  positions={polygonPoints.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: '#f59e0b',
                    fillColor: '#fbbf24',
                    fillOpacity: 0.3,
                    weight: 3
                  }}
                />
              )}
            </>
          )}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>🗺️ خريطة تفاعلية OpenStreetMap</span>
        <span>المناطق المحفوظة مسبقاً معروضة كخطوط متقطعة على الخريطة</span>
      </div>
    </div>
  );
}
