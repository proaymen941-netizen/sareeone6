/**
 * Google Maps URL & Coordinates Parser and Resolver
 * Supports all Google Maps link formats (Standard, Shortened, Coordinates, Search, Directions, Mobile Share)
 */

export interface ParsedLocation {
  lat: number;
  lng: number;
  title?: string;
  source: string;
}

export function extractCoordsFromTextOrUrl(input: string): ParsedLocation | null {
  if (!input) return null;
  const str = input.trim();

  // 1. Pure Coordinates e.g. "15.3694, 44.1910" or "15.3694 44.1910"
  const rawCoord = str.match(/^[-+]?([0-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)$/);
  if (rawCoord) {
    const lat = parseFloat(rawCoord[1]);
    const lng = parseFloat(rawCoord[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, source: "coordinates" };
    }
  }

  // 2. DMS coordinates e.g. 15°22'09.8"N 44°11'27.6"E
  const dmsMatch = str.match(/(\d+)°(\d+)'([\d.]+)"([NSEWnsew])\s*,?\s*(\d+)°(\d+)'([\d.]+)"([NSEWnsew])/);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1], 10) + parseInt(dmsMatch[2], 10) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === "S") lat = -lat;
    let lng = parseInt(dmsMatch[5], 10) + parseInt(dmsMatch[6], 10) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === "W") lng = -lng;
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, source: "dms_coordinates" };
    }
  }

  // Extract place title if available in the URL path (e.g. /place/مطعم+الشيباني/...)
  let title: string | undefined;
  const placeTitleMatch = str.match(/\/place\/([^/@?]+)/);
  if (placeTitleMatch) {
    try {
      title = decodeURIComponent(placeTitleMatch[1].replace(/\+/g, " "));
    } catch (e) {
      // ignore
    }
  }

  // 3. Google Maps @lat,lng pattern (e.g. /@15.369444,44.191055,17z)
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, title, source: "google_maps_at" };
    }
  }

  // 4. Query parameters in URL: ?q=lat,lng or &q=lat,lng or query=lat,lng or daddr=lat,lng or ll=lat,lng or center=lat,lng
  const paramMatch = str.match(/[?&](?:q|query|daddr|saddr|ll|destination|center)=(-?\d+\.\d+)[,%20\s]+(-?\d+\.\d+)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, title, source: "google_maps_query" };
    }
  }

  // 5. Google Maps Dir / Search URL with path coordinates: /dir//15.3694,44.1910
  const dirMatch = str.match(/\/(?:dir|search)\/[^/]*\/(-?\d+\.\d+)[,%20\s]+(-?\d+\.\d+)/i);
  if (dirMatch) {
    const lat = parseFloat(dirMatch[1]);
    const lng = parseFloat(dirMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, title, source: "google_maps_dir" };
    }
  }

  // 6. Geo URI: geo:15.3694,44.1910
  const geoMatch = str.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (geoMatch) {
    const lat = parseFloat(geoMatch[1]);
    const lng = parseFloat(geoMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, source: "geo_uri" };
    }
  }

  return null;
}

/**
 * Resolves a Google Maps Short URL (e.g. https://maps.app.goo.gl/xxx or https://goo.gl/maps/xxx)
 * by fetching and following HTTP redirects to extract the real coordinates.
 */
export async function resolveGoogleMapsUrl(url: string): Promise<ParsedLocation | null> {
  const cleanUrl = url.trim();
  
  // 1. Direct regex check first
  const direct = extractCoordsFromTextOrUrl(cleanUrl);
  if (direct) return direct;

  // 2. Check if it looks like a URL
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://") && !cleanUrl.includes("goo.gl/") && !cleanUrl.includes("maps.app.goo.gl")) {
    return null;
  }

  const targetUrl = cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ar,en;q=0.9"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const finalUrl = response.url;
    
    // Check final redirected URL
    const fromFinalUrl = extractCoordsFromTextOrUrl(finalUrl);
    if (fromFinalUrl) {
      return { ...fromFinalUrl, source: "google_maps_shortlink_redirect" };
    }

    // Check HTML content for coordinates and static map meta tags
    const html = await response.text();

    // Check static map or image meta tag center
    const staticMapMatch = html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/i) || 
                           html.match(/center=(-?\d+\.\d+),(-?\d+\.\d+)/i);
    if (staticMapMatch) {
      const lat = parseFloat(staticMapMatch[1]);
      const lng = parseFloat(staticMapMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, source: "google_maps_html_staticmap" };
      }
    }

    // Check window.APP_INITIALIZATION_STATE or raw lat/lng arrays in HTML
    const initMatch = html.match(/\[\[\[\d+,\s*(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/);
    if (initMatch) {
      const lat = parseFloat(initMatch[1]);
      const lng = parseFloat(initMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, source: "google_maps_html_init" };
      }
    }

    // Check any @lat,lng in the whole HTML text
    const htmlAtMatch = html.match(/@(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/);
    if (htmlAtMatch) {
      const lat = parseFloat(htmlAtMatch[1]);
      const lng = parseFloat(htmlAtMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, source: "google_maps_html_at" };
      }
    }

    // Check og:title or title tag for place name
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
    let title: string | undefined;
    if (titleMatch) {
      title = titleMatch[1].replace(/ - Google Maps$/, "").trim();
    }

    // Try extracting any `lat,lng` pair inside script tags
    const scriptCoords = html.match(/"lat":\s*(-?\d+\.\d+),\s*"lng":\s*(-?\d+\.\d+)/) ||
                         html.match(/null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/);
    if (scriptCoords) {
      const lat = parseFloat(scriptCoords[1]);
      const lng = parseFloat(scriptCoords[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, title, source: "google_maps_html_script" };
      }
    }

    return null;
  } catch (err) {
    console.warn("Failed to resolve Google Maps short URL:", err);
    return null;
  }
}
