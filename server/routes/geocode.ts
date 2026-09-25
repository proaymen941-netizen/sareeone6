import express from "express";

const router = express.Router();

// Rich regional & global known places database for instantaneous zero-latency matching
const KNOWN_PLACES = [
  // مدن ومناطق يمنية
  { name: "صنعاء", fullName: "مدينة صنعاء، اليمن", lat: 15.3694, lng: 44.1910, country: "اليمن" },
  { name: "حدة", fullName: "حي حدة، مديرية السبعين، صنعاء، اليمن", lat: 15.3188, lng: 44.1963, country: "اليمن" },
  { name: "شارع حدة", fullName: "شارع حدة الرئيسي، صنعاء، اليمن", lat: 15.3214, lng: 44.1945, country: "اليمن" },
  { name: "السبعين", fullName: "ميدان السبعين، صنعاء، اليمن", lat: 15.3367, lng: 44.2045, country: "اليمن" },
  { name: "التحرير", fullName: "ميدان التحرير، وسط صنعاء، اليمن", lat: 15.3533, lng: 44.2078, country: "اليمن" },
  { name: "شارع الزبيري", fullName: "شارع الزبيري، صنعاء، اليمن", lat: 15.3508, lng: 44.2012, country: "اليمن" },
  { name: "شارع الستين", fullName: "شارع الستين الغربي، صنعاء، اليمن", lat: 15.3421, lng: 44.1754, country: "اليمن" },
  { name: "شارع الخمسين", fullName: "شارع الخمسين، صنعاء، اليمن", lat: 15.3056, lng: 44.1989, country: "اليمن" },
  { name: "بيت بوس", fullName: "حي بيت بوس، جنوب صنعاء، اليمن", lat: 15.2845, lng: 44.2034, country: "اليمن" },
  { name: "الأصبحي", fullName: "حي الأصبحي، صنعاء، اليمن", lat: 15.3012, lng: 44.2156, country: "اليمن" },
  { name: "عدن", fullName: "مدينة عدن، اليمن", lat: 12.7855, lng: 45.0187, country: "اليمن" },
  { name: "كريتر", fullName: "مديرية كريتر (صيرة)، عدن، اليمن", lat: 12.7750, lng: 45.0350, country: "اليمن" },
  { name: "المنصورة", fullName: "مديرية المنصورة، عدن، اليمن", lat: 12.8600, lng: 44.9950, country: "اليمن" },
  { name: "تعز", fullName: "مدينة تعز، اليمن", lat: 13.5775, lng: 44.0189, country: "اليمن" },
  { name: "إب", fullName: "مدينة إب اللواء الأخضر، اليمن", lat: 13.9753, lng: 44.1708, country: "اليمن" },
  { name: "المكلا", fullName: "مدينة المكلا، حضرموت، اليمن", lat: 14.5425, lng: 49.1242, country: "اليمن" },
  { name: "الحديدة", fullName: "مدينة الحديدة، اليمن", lat: 14.7978, lng: 42.9545, country: "اليمن" },
  { name: "مأرب", fullName: "مدينة مأرب، اليمن", lat: 15.4628, lng: 45.3253, country: "اليمن" },

  // عواصم ومدن عربية وعالمية بارزة
  { name: "مكة المكرمة", fullName: "مكة المكرمة، المملكة العربية السعودية", lat: 21.3891, lng: 39.8579, country: "السعودية" },
  { name: "المدينة المنورة", fullName: "المدينة المنورة، المملكة العربية السعودية", lat: 24.5247, lng: 39.5692, country: "السعودية" },
  { name: "الرياض", fullName: "مدينة الرياض، عاصمة المملكة العربية السعودية", lat: 24.7136, lng: 46.6753, country: "السعودية" },
  { name: "جدة", fullName: "مدينة جدة، المملكة العربية السعودية", lat: 21.5433, lng: 39.1728, country: "السعودية" },
  { name: "دبي", fullName: "إمارة دبي، الإمارات العربية المتحدة", lat: 25.2048, lng: 55.2708, country: "الإمارات" },
  { name: "أبوظبي", fullName: "مدينة أبوظبي، عاصمة الإمارات العربية المتحدة", lat: 24.4539, lng: 54.3773, country: "الإمارات" },
  { name: "الدوحة", fullName: "مدينة الدوحة، عاصمة قطر", lat: 25.2854, lng: 51.5310, country: "قطر" },
  { name: "الكويت", fullName: "مدينة الكويت، عاصمة الكويت", lat: 29.3759, lng: 47.9774, country: "الكويت" },
  { name: "المنامة", fullName: "مدينة المنامة، عاصمة البحرين", lat: 26.2285, lng: 50.5860, country: "البحرين" },
  { name: "مسقط", fullName: "مدينة مسقط، عاصمة سلطنة عمان", lat: 23.5880, lng: 58.3829, country: "عمان" },
  { name: "صلالة", fullName: "مدينة صلالة، سلطنة عمان", lat: 17.0151, lng: 54.0924, country: "عمان" },
  { name: "القاهرة", fullName: "مدينة القاهرة، جمهورية مصر العربية", lat: 30.0444, lng: 31.2357, country: "مصر" },
  { name: "الإسكندرية", fullName: "مدينة الإسكندرية، مصر", lat: 31.2001, lng: 29.9187, country: "مصر" },
  { name: "عمان", fullName: "مدينة عمّان، عاصمة المملكة الأردنية الهاشمية", lat: 31.9454, lng: 35.9284, country: "الأردن" },
  { name: "دمشق", fullName: "مدينة دمشق، عاصمة سوريا", lat: 33.5138, lng: 36.2765, country: "سوريا" },
  { name: "بيروت", fullName: "مدينة بيروت، عاصمة لبنان", lat: 33.8938, lng: 35.5018, country: "لبنان" },
  { name: "بغداد", fullName: "مدينة بغداد، عاصمة العراق", lat: 33.3152, lng: 44.3661, country: "العراق" },
  { name: "أربيل", fullName: "مدينة أربيل، إقليم كردستان العراق", lat: 36.1901, lng: 44.0091, country: "العراق" },
  { name: "القدس", fullName: "مدينة القدس الشريف، فلسطين", lat: 31.7683, lng: 35.2137, country: "فلسطين" },
  { name: "غزة", fullName: "مدينة غزة، فلسطين", lat: 31.5017, lng: 34.4668, country: "فلسطين" },
  { name: "الخرطوم", fullName: "مدينة الخرطوم، عاصمة السودان", lat: 15.5007, lng: 32.5599, country: "السودان" },
  { name: "طرابلس", fullName: "مدينة طرابلس، عاصمة ليبيا", lat: 32.8872, lng: 13.1913, country: "ليبيا" },
  { name: "تونس", fullName: "مدينة تونس، عاصمة الجمهورية التونسية", lat: 36.8065, lng: 10.1815, country: "تونس" },
  { name: "الجزائر", fullName: "مدينة الجزائر العاصمة، الجمهورية الجزائرية", lat: 36.7538, lng: 3.0588, country: "الجزائر" },
  { name: "الرباط", fullName: "مدينة الرباط، عاصمة المملكة المغربية", lat: 34.0209, lng: -6.8416, country: "المغرب" },
  { name: "الدار البيضاء", fullName: "مدينة الدار البيضاء (كازابلانكا)، المغرب", lat: 33.5731, lng: -7.5898, country: "المغرب" },
  { name: "اسطنبول", fullName: "مدينة اسطنبول، تركيا", lat: 41.0082, lng: 28.9784, country: "تركيا" },
  { name: "أنقرة", fullName: "مدينة أنقرة، عاصمة تركيا", lat: 39.9334, lng: 32.8597, country: "تركيا" },
  { name: "لندن", fullName: "مدينة لندن، عاصمة المملكة المتحدة", lat: 51.5074, lng: -0.1278, country: "بريطانيا" },
  { name: "باريس", fullName: "مدينة باريس، عاصمة فرنسا", lat: 48.8566, lng: 2.3522, country: "فرنسا" },
  { name: "برلين", fullName: "مدينة برلين، عاصمة ألمانيا", lat: 52.5200, lng: 13.4050, country: "ألمانيا" },
  { name: "روما", fullName: "مدينة روما، عاصمة إيطاليا", lat: 41.9028, lng: 12.4964, country: "إيطاليا" },
  { name: "مدريد", fullName: "مدينة مدريد، عاصمة إسبانيا", lat: 40.4168, lng: -3.7038, country: "إسبانيا" },
  { name: "نيويورك", fullName: "مدينة نيويورك، الولايات المتحدة الأمريكية", lat: 40.7128, lng: -74.0060, country: "أمريكا" },
  { name: "واشنطن", fullName: "مدينة واشنطن العاصمة، الولايات المتحدة الأمريكية", lat: 38.9072, lng: -77.0369, country: "أمريكا" },
  { name: "طوكيو", fullName: "مدينة طوكيو، عاصمة اليابان", lat: 35.6762, lng: 139.6503, country: "اليابان" },
  { name: "بكين", fullName: "مدينة بكين، عاصمة الصين", lat: 39.9042, lng: 116.4074, country: "الصين" },
  { name: "موسكو", fullName: "مدينة موسكو، عاصمة روسيا", lat: 55.7558, lng: 37.6173, country: "روسيا" }
];

function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ًٌٍَُِّْ~]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * GET /api/geocode/search?q=... (Worldwide Global Search)
 */
router.get("/search", async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || "").trim();
    if (!rawQuery) {
      return res.json([]);
    }

    // 1. Direct coordinate format matching (e.g. "24.7136, 46.6753" or "40.7128 -74.0060")
    const coordMatch = rawQuery.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return res.json([
          {
            display_name: `إحداثيات محددة (${lat.toFixed(6)}, ${lon.toFixed(6)})`,
            lat: lat.toString(),
            lon: lon.toString(),
            source: "coordinates"
          }
        ]);
      }
    }

    const normQuery = normalizeArabicText(rawQuery);
    const results: Array<{ display_name: string; lat: string; lon: string; source?: string }> = [];
    const seenCoordinates = new Set<string>();

    const addResult = (item: { display_name: string; lat: string | number; lon: string | number; source?: string }) => {
      const key = `${Number(item.lat).toFixed(3)},${Number(item.lon).toFixed(3)}`;
      if (!seenCoordinates.has(key)) {
        seenCoordinates.add(key);
        results.push({
          display_name: item.display_name,
          lat: item.lat.toString(),
          lon: item.lon.toString(),
          source: item.source || "global_db"
        });
      }
    };

    // 2. Search in instant global and regional locations
    for (const place of KNOWN_PLACES) {
      const normPlaceName = normalizeArabicText(place.name);
      const normFullName = normalizeArabicText(place.fullName);
      const normCountry = normalizeArabicText(place.country || "");

      if (
        normPlaceName === normQuery ||
        normPlaceName.includes(normQuery) ||
        normQuery.includes(normPlaceName) ||
        normFullName.includes(normQuery) ||
        (normCountry && normQuery.includes(normCountry))
      ) {
        addResult({
          display_name: place.fullName,
          lat: place.lat,
          lon: place.lng,
          source: "known_db"
        });
      }
    }

    // 3. Search Worldwide using OpenStreetMap Nominatim (No country restriction)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}&accept-language=ar,en&addressdetails=1&limit=8`;
      const osmRes = await fetch(osmUrl, {
        headers: {
          "User-Agent": "SarieOne-Global-App/1.0 (contact@sarieone.app)",
          "Accept-Language": "ar,en"
        },
        signal: controller.signal
      });

      if (osmRes.ok) {
        const osmData: any[] = await osmRes.json();
        if (Array.isArray(osmData)) {
          for (const item of osmData) {
            addResult({
              display_name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              source: "osm_global"
            });
          }
        }
      }
      clearTimeout(timeoutId);
    } catch (osmErr) {
      // Ignore OSM timeout or network issue
    }

    // 4. Search Worldwide using Photon (Komoot Global OpenStreetMap API)
    if (results.length < 6) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawQuery)}&lang=default&limit=8`;
        const photonRes = await fetch(photonUrl, { signal: controller.signal });
        if (photonRes.ok) {
          const photonData: any = await photonRes.json();
          if (photonData?.features && Array.isArray(photonData.features)) {
            for (const feat of photonData.features) {
              const coords = feat.geometry?.coordinates;
              const props = feat.properties;
              if (coords && coords.length >= 2) {
                const titleParts = [props.name, props.street, props.district, props.city, props.state, props.country]
                  .filter(Boolean);
                const title = titleParts.length > 0 ? titleParts.join("، ") : rawQuery;
                addResult({
                  display_name: title,
                  lat: coords[1],
                  lon: coords[0],
                  source: "photon_global"
                });
              }
            }
          }
        }
        clearTimeout(timeoutId);
      } catch (photonErr) {
        // Ignore photon fallback error
      }
    }

    return res.json(results);
  } catch (err) {
    console.error("Global geocoding search error:", err);
    return res.status(500).json({ error: "Global search failed" });
  }
});

/**
 * GET /api/geocode/reverse?lat=...&lng=... (Worldwide Reverse Geocoding)
 */
router.get("/reverse", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat((req.query.lng || req.query.lon) as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // 1. Worldwide OpenStreetMap reverse geocoding
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar,en`;
      const osmRes = await fetch(url, {
        headers: {
          "User-Agent": "SarieOne-Global-App/1.0 (contact@sarieone.app)",
          "Accept-Language": "ar,en"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (osmRes.ok) {
        const data: any = await osmRes.json();
        if (data && data.display_name) {
          return res.json({
            display_name: data.display_name,
            address: data.address,
            lat,
            lng
          });
        }
      }
    } catch (e) {
      // Ignore and fallback
    }

    // 2. Find closest known landmark globally
    let closestPlace = null;
    let minDistance = Infinity;

    for (const place of KNOWN_PLACES) {
      const dLat = (place.lat - lat) * 111;
      const dLng = (place.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      if (distKm < minDistance) {
        minDistance = distKm;
        closestPlace = place;
      }
    }

    if (closestPlace && minDistance < 10) {
      return res.json({
        display_name: `بالقرب من ${closestPlace.fullName}`,
        lat,
        lng
      });
    }

    return res.json({
      display_name: `الموقع المحدد (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      lat,
      lng
    });
  } catch (err) {
    console.error("Reverse geocoding error:", err);
    return res.status(500).json({ error: "Reverse geocoding failed" });
  }
});

export default router;
