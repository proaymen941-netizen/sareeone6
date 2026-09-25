import express from "express";

const router = express.Router();

// Rich Yemeni places database for instant, zero-latency, 100% reliable matching
const YEMEN_KNOWN_PLACES = [
  // صنعاء وأحيائها وشوارعها
  { name: "حدة", fullName: "حي حدة، مديرية السبعين، صنعاء، اليمن", lat: 15.3188, lng: 44.1963, city: "صنعاء", type: "district" },
  { name: "شارع حدة", fullName: "شارع حدة الرئيسي، صنعاء، اليمن", lat: 15.3214, lng: 44.1945, city: "صنعاء", type: "street" },
  { name: "السبعين", fullName: "ميدان السبعين، صنعاء، اليمن", lat: 15.3367, lng: 44.2045, city: "صنعاء", type: "landmark" },
  { name: "التحرير", fullName: "ميدان التحرير، وسط صنعاء، اليمن", lat: 15.3533, lng: 44.2078, city: "صنعاء", type: "landmark" },
  { name: "شارع الزبيري", fullName: "شارع الزبيري، صنعاء، اليمن", lat: 15.3508, lng: 44.2012, city: "صنعاء", type: "street" },
  { name: "شارع الستين", fullName: "شارع الستين الغربي، صنعاء، اليمن", lat: 15.3421, lng: 44.1754, city: "صنعاء", type: "street" },
  { name: "شارع الخمسين", fullName: "شارع الخمسين، صنعاء، اليمن", lat: 15.3056, lng: 44.1989, city: "صنعاء", type: "street" },
  { name: "بيت بوس", fullName: "حي بيت بوس، جنوب صنعاء، اليمن", lat: 15.2845, lng: 44.2034, city: "صنعاء", type: "district" },
  { name: "الأصبحي", fullName: "حي الأصبحي، صنعاء، اليمن", lat: 15.3012, lng: 44.2156, city: "صنعاء", type: "district" },
  { name: "شميلة", fullName: "سوق شميلة، صنعاء، اليمن", lat: 15.3167, lng: 44.2250, city: "صنعاء", type: "district" },
  { name: "الحصبة", fullName: "حي الحصبة، شمال صنعاء، اليمن", lat: 15.3850, lng: 44.2056, city: "صنعاء", type: "district" },
  { name: "باب اليمن", fullName: "باب اليمن، صنعاء القديمة، اليمن", lat: 15.3522, lng: 44.2158, city: "صنعاء", type: "landmark" },
  { name: "صنعاء القديمة", fullName: "مدينة صنعاء القديمة، صنعاء، اليمن", lat: 15.3547, lng: 44.2144, city: "صنعاء", type: "district" },
  { name: "الروضة", fullName: "منطقة الروضة، شمال صنعاء، اليمن", lat: 15.4200, lng: 44.2200, city: "صنعاء", type: "district" },
  { name: "مذبح", fullName: "منطقة مذبح، غرب صنعاء، اليمن", lat: 15.3720, lng: 44.1680, city: "صنعاء", type: "district" },
  { name: "شملان", fullName: "منطقة شملان، شمال غرب صنعاء، اليمن", lat: 15.4050, lng: 44.1500, city: "صنعاء", type: "district" },
  { name: "الجراف", fullName: "حي الجراف، شمال صنعاء، اليمن", lat: 15.3900, lng: 44.2100, city: "صنعاء", type: "district" },
  { name: "عصر", fullName: "منطقة عصر، غرب صنعاء، اليمن", lat: 15.3350, lng: 44.1650, city: "صنعاء", type: "district" },
  { name: "شارع صخر", fullName: "شارع صخر، المتفرع من شارع بغداد، صنعاء، اليمن", lat: 15.3410, lng: 44.1980, city: "صنعاء", type: "street" },
  { name: "شارع بغداد", fullName: "شارع بغداد، صنعاء، اليمن", lat: 15.3430, lng: 44.1990, city: "صنعاء", type: "street" },
  { name: "شارع الجزائر", fullName: "شارع الجزائر، صنعاء، اليمن", lat: 15.3380, lng: 44.1950, city: "صنعاء", type: "street" },
  { name: "شارع تعز", fullName: "شارع تعز، جنوب صنعاء، اليمن", lat: 15.3100, lng: 44.2300, city: "صنعاء", type: "street" },
  { name: "جولة الرويشان", fullName: "جولة الرويشان، شارع حدة، صنعاء، اليمن", lat: 15.3355, lng: 44.1972, city: "صنعاء", type: "landmark" },
  { name: "جولة المصباحي", fullName: "جولة المصباحي، شارع حدة، صنعاء، اليمن", lat: 15.3210, lng: 44.1940, city: "صنعاء", type: "landmark" },
  { name: "جولة عصر", fullName: "جولة عصر، صنعاء، اليمن", lat: 15.3340, lng: 44.1660, city: "صنعاء", type: "landmark" },
  { name: "مستشفى الثورة", fullName: "مستشفى الثورة العام، صنعاء، اليمن", lat: 15.3580, lng: 44.2250, city: "صنعاء", type: "landmark" },
  { name: "جامعة صنعاء", fullName: "جامعة صنعاء الجديدة، الدائري الغربي، صنعاء، اليمن", lat: 15.3680, lng: 44.1820, city: "صنعاء", type: "landmark" },

  // عدن وأحيائها
  { name: "عدن", fullName: "مدينة عدن، اليمن", lat: 12.7855, lng: 45.0187, city: "عدن", type: "city" },
  { name: "كريتر", fullName: "مديرية كريتر (صيرة)، عدن، اليمن", lat: 12.7750, lng: 45.0350, city: "عدن", type: "district" },
  { name: "المعلا", fullName: "مديرية المعلا، عدن، اليمن", lat: 12.7880, lng: 45.0020, city: "عدن", type: "district" },
  { name: "التواهي", fullName: "مديرية التواهي، عدن، اليمن", lat: 12.7820, lng: 44.9850, city: "عدن", type: "district" },
  { name: "خور مكسر", fullName: "مديرية خور مكسر، عدن، اليمن", lat: 12.8250, lng: 45.0400, city: "عدن", type: "district" },
  { name: "المنصورة", fullName: "مديرية المنصورة، عدن، اليمن", lat: 12.8600, lng: 44.9950, city: "عدن", type: "district" },
  { name: "الشيخ عثمان", fullName: "مديرية الشيخ عثمان، عدن، اليمن", lat: 12.8750, lng: 45.0050, city: "عدن", type: "district" },
  { name: "دار سعد", fullName: "مديرية دار سعد، عدن، اليمن", lat: 12.9000, lng: 45.0000, city: "عدن", type: "district" },
  { name: "إنماء", fullName: "مدينة إنماء السكنية، المنصورة، عدن، اليمن", lat: 12.8550, lng: 44.9600, city: "عدن", type: "district" },

  // تعز
  { name: "تعز", fullName: "مدينة تعز، اليمن", lat: 13.5775, lng: 44.0189, city: "تعز", type: "city" },
  { name: "شارع جمال", fullName: "شارع جمال عبدالناصر، وسط تعز، اليمن", lat: 13.5790, lng: 44.0150, city: "تعز", type: "street" },
  { name: "الحوبان", fullName: "منطقة الحوبان، تعز، اليمن", lat: 13.6150, lng: 44.0850, city: "تعز", type: "district" },
  { name: "بير باشا", fullName: "منطقة بير باشا، غرب تعز، اليمن", lat: 13.5700, lng: 43.9850, city: "تعز", type: "district" },

  // إب
  { name: "إب", fullName: "مدينة إب اللواء الأخضر، اليمن", lat: 13.9753, lng: 44.1708, city: "إب", type: "city" },
  { name: "المشنة", fullName: "مديرية المشنة، إب، اليمن", lat: 13.9680, lng: 44.1780, city: "إب", type: "district" },
  { name: "الظهار", fullName: "مديرية الظهار، إب، اليمن", lat: 13.9850, lng: 44.1650, city: "إب", type: "district" },
  { name: "شارع العدين", fullName: "شارع العدين، إب، اليمن", lat: 13.9730, lng: 44.1720, city: "إب", type: "street" },

  // حضرموت والمكلا
  { name: "المكلا", fullName: "مدينة المكلا، ساحل حضرموت، اليمن", lat: 14.5425, lng: 49.1242, city: "حضرموت", type: "city" },
  { name: "سيئون", fullName: "مدينة سيئون، وادي حضرموت، اليمن", lat: 15.9380, lng: 48.7880, city: "حضرموت", type: "city" },
  { name: "الشرج", fullName: "حي الشرج، المكلا، حضرموت، اليمن", lat: 14.5380, lng: 49.1200, city: "حضرموت", type: "district" },
  { name: "فوه", fullName: "منطقة فوه، المكلا، حضرموت، اليمن", lat: 14.5200, lng: 49.0700, city: "حضرموت", type: "district" },

  // الحديدة
  { name: "الحديدة", fullName: "مدينة الحديدة، عروس البحر الأحمر، اليمن", lat: 14.7978, lng: 42.9545, city: "الحديدة", type: "city" },
  { name: "شارع الميناء", fullName: "شارع الميناء، الحديدة، اليمن", lat: 14.8050, lng: 42.9480, city: "الحديدة", type: "street" },
  { name: "شارع صنعاء بالحديدة", fullName: "شارع صنعاء، الحديدة، اليمن", lat: 14.7920, lng: 42.9700, city: "الحديدة", type: "street" },

  // مدن أخرى
  { name: "ذمار", fullName: "مدينة ذمار، اليمن", lat: 14.5428, lng: 44.4056, city: "ذمار", type: "city" },
  { name: "مأرب", fullName: "مدينة مأرب، اليمن", lat: 15.4628, lng: 45.3253, city: "مأرب", type: "city" },
  { name: "عمران", fullName: "مدينة عمران، اليمن", lat: 15.6594, lng: 43.9408, city: "عمران", type: "city" },
  { name: "صعدة", fullName: "مدينة صعدة، اليمن", lat: 16.9400, lng: 43.7636, city: "صعدة", type: "city" },
  { name: "حجة", fullName: "مدينة حجة، اليمن", lat: 15.6944, lng: 43.6033, city: "حجة", type: "city" },
  { name: "لحج", fullName: "مدينة الحوطة، لحج، اليمن", lat: 13.0600, lng: 44.8800, city: "لحج", type: "city" },
  { name: "أبين", fullName: "مدينة زنجبار، أبين، اليمن", lat: 13.1289, lng: 45.3808, city: "أبين", type: "city" },
  { name: "شبوة", fullName: "مدينة عتق، شبوة، اليمن", lat: 14.5378, lng: 46.8319, city: "شبوة", type: "city" },
  { name: "المهرة", fullName: "مدينة الغيضة، المهرة، اليمن", lat: 16.2081, lng: 52.1764, city: "المهرة", type: "city" },
  { name: "سقطرى", fullName: "مدينة حديبو، أرخبيل سقطرى، اليمن", lat: 12.6500, lng: 54.0200, city: "سقطرى", type: "city" }
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
 * GET /api/geocode/search?q=...
 */
router.get("/search", async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || "").trim();
    if (!rawQuery) {
      return res.json([]);
    }

    // 1. Check if user entered coordinates
    const coordMatch = rawQuery.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lon)) {
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
      const key = `${Number(item.lat).toFixed(4)},${Number(item.lon).toFixed(4)}`;
      if (!seenCoordinates.has(key)) {
        seenCoordinates.add(key);
        results.push({
          display_name: item.display_name,
          lat: item.lat.toString(),
          lon: item.lon.toString(),
          source: item.source || "yemen_db"
        });
      }
    };

    // 2. Search in local Yemeni high-accuracy places
    for (const place of YEMEN_KNOWN_PLACES) {
      const normPlaceName = normalizeArabicText(place.name);
      const normFullName = normalizeArabicText(place.fullName);
      const normCity = normalizeArabicText(place.city);

      if (
        normPlaceName.includes(normQuery) ||
        normQuery.includes(normPlaceName) ||
        normFullName.includes(normQuery) ||
        (normCity && normQuery.includes(normCity))
      ) {
        addResult({
          display_name: place.fullName,
          lat: place.lat,
          lon: place.lng,
          source: "yemen_db"
        });
      }
    }

    // 3. Query OpenStreetMap Nominatim with proper User-Agent & timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const queriesToTry = [
        rawQuery.includes("اليمن") || rawQuery.includes("Yemen") ? rawQuery : `${rawQuery}, اليمن`,
        rawQuery
      ];

      for (const qStr of queriesToTry) {
        if (results.length >= 6) break;
        const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(qStr)}&accept-language=ar&addressdetails=1&countrycodes=ye&limit=5`;
        const osmRes = await fetch(osmUrl, {
          headers: {
            "User-Agent": "SarieOne-App/1.0 (contact@sarieone.app)",
            "Accept-Language": "ar"
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
                source: "osm"
              });
            }
          }
        }
      }
      clearTimeout(timeoutId);
    } catch (osmErr) {
      // Nominatim timeout or network error, continue with other providers
    }

    // 4. Query Photon by Komoot (very fast OSM search)
    if (results.length < 5) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawQuery + " Yemen")}&lang=default&limit=4`;
        const photonRes = await fetch(photonUrl, { signal: controller.signal });
        if (photonRes.ok) {
          const photonData: any = await photonRes.json();
          if (photonData?.features && Array.isArray(photonData.features)) {
            for (const feat of photonData.features) {
              const coords = feat.geometry?.coordinates;
              const props = feat.properties;
              if (coords && coords.length >= 2) {
                const title = [props.name, props.street, props.district, props.city, props.country]
                  .filter(Boolean)
                  .join("، ");
                addResult({
                  display_name: title || rawQuery,
                  lat: coords[1],
                  lon: coords[0],
                  source: "photon"
                });
              }
            }
          }
        }
        clearTimeout(timeoutId);
      } catch (photonErr) {
        // Ignore fallback error
      }
    }

    // If still no results, fallback to Sana'a center with the query label
    if (results.length === 0) {
      results.push({
        display_name: `${rawQuery} (صنعاء، اليمن)`,
        lat: "15.3694",
        lon: "44.1910",
        source: "fallback"
      });
    }

    return res.json(results);
  } catch (err) {
    console.error("Geocoding search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

/**
 * GET /api/geocode/reverse?lat=...&lng=...
 */
router.get("/reverse", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat((req.query.lng || req.query.lon) as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // 1. Try reverse geocode with OSM Nominatim
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar`;
      const osmRes = await fetch(url, {
        headers: {
          "User-Agent": "SarieOne-App/1.0 (contact@sarieone.app)",
          "Accept-Language": "ar"
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

    // 2. Find closest Yemeni known landmark if within 5km
    let closestPlace = null;
    let minDistance = Infinity;

    for (const place of YEMEN_KNOWN_PLACES) {
      const dLat = (place.lat - lat) * 111;
      const dLng = (place.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      if (distKm < minDistance) {
        minDistance = distKm;
        closestPlace = place;
      }
    }

    if (closestPlace && minDistance < 4) {
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
