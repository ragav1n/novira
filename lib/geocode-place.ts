// One-shot forward geocoder — turns a free-text place query (e.g. a spoken
// "starbucks downtown") into structured location fields. Mirrors the provider
// preference of components/ui/location-picker.tsx: Google → Mapbox → Photon.
// Unlike the picker's interactive autocomplete, this resolves a single best
// match in one request, for cases where there's no UI to pick from.

export interface GeocodedPlace {
    place_name: string;
    place_address: string;
    place_lat: number;
    place_lng: number;
}

interface GeocodeOptions {
    // User's current position — biases results toward nearby places, which
    // matters a lot for ambiguous spoken names ("the cafe", "trader joes").
    proximity?: { lat: number; lng: number } | null;
    signal?: AbortSignal;
}

async function geocodeGoogle(query: string, key: string, opts: GeocodeOptions): Promise<GeocodedPlace | null> {
    const body: Record<string, unknown> = {
        textQuery: query,
        maxResultCount: 1,
        languageCode: 'en',
    };
    if (opts.proximity) {
        body.locationBias = {
            circle: {
                center: { latitude: opts.proximity.lat, longitude: opts.proximity.lng },
                radius: 50000,
            },
        };
    }
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        signal: opts.signal,
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Places searchText ${res.status}`);
    const data = await res.json();
    const p = data.places?.[0];
    if (!p?.location) return null;
    return {
        place_name: p.displayName?.text || query,
        place_address: p.formattedAddress || '',
        place_lat: p.location.latitude,
        place_lng: p.location.longitude,
    };
}

async function geocodeMapbox(query: string, token: string, opts: GeocodeOptions): Promise<GeocodedPlace | null> {
    const params = new URLSearchParams({
        access_token: token,
        limit: '1',
        language: 'en',
        types: 'poi,place,address',
    });
    if (opts.proximity) params.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`);
    const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`,
        { signal: opts.signal },
    );
    if (!res.ok) throw new Error(`Mapbox geocode ${res.status}`);
    const data = await res.json();
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!coords) return null;
    return {
        place_name: f.text || f.place_name?.split(',')[0]?.trim() || query,
        place_address: f.place_name || '',
        place_lat: coords[1],
        place_lng: coords[0],
    };
}

async function geocodePhoton(query: string, opts: GeocodeOptions): Promise<GeocodedPlace | null> {
    const params = new URLSearchParams({ q: query, limit: '1', lang: 'en' });
    if (opts.proximity) {
        params.set('lat', String(opts.proximity.lat));
        params.set('lon', String(opts.proximity.lng));
    }
    const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: opts.signal });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = await res.json();
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!coords) return null;
    const props = f.properties || {};
    const name: string = props.name || props.street || query;
    const addressParts = [props.street, props.city || props.town || props.village, props.state, props.country]
        .filter((p: unknown): p is string => typeof p === 'string' && p.length > 0);
    return {
        place_name: name,
        place_address: addressParts.join(', '),
        place_lat: coords[1],
        place_lng: coords[0],
    };
}

// Resolves a place query to a single location. Tries each provider in the
// picker's preference order, falling through only on a hard error — a provider
// that responds with no match ends the chain (the query is genuinely ambiguous).
export async function geocodePlace(query: string, opts: GeocodeOptions = {}): Promise<GeocodedPlace | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;

    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (googleKey) {
        try {
            return await geocodeGoogle(trimmed, googleKey, opts);
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') throw err;
            console.warn('[geocode] Google failed, falling back', err);
        }
    }
    if (mapboxToken) {
        try {
            return await geocodeMapbox(trimmed, mapboxToken, opts);
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') throw err;
            console.warn('[geocode] Mapbox failed, falling back', err);
        }
    }
    try {
        return await geocodePhoton(trimmed, opts);
    } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
        console.warn('[geocode] Photon failed', err);
        return null;
    }
}
