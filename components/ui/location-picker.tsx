'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, X, Search, Navigation, LocateFixed, Globe, Crosshair } from 'lucide-react';
import { getDistance } from '@/lib/location';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from '@/utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { ImpactStyle } from '@capacitor/haptics';

// ── Types ──────────────────────────────────────────────────────────────────

interface LocationData {
    place_name: string | null;
    place_address: string | null;
    place_lat: number | null;
    place_lng: number | null;
}

interface RecentLocation extends LocationData {
    visitCount: number;
    lastVisited: number;
}

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: { main_text: string; secondary_text: string };
    _lat: string;
    _lon: string;
    _is_nearby?: boolean;
    _distance?: number;
    _mapbox_id?: string;
    _maki?: string;
    _source?: 'google' | 'mapbox' | 'photon';
}

interface LocationPickerProps {
    placeName: string | null;
    placeAddress: string | null;
    placeLat: number | null;
    placeLng: number | null;
    onChange: (location: LocationData) => void;
}

// ── Maki → emoji map (no extra bundle, works perfectly on mobile) ───────────

const MAKI_EMOJI: Record<string, string> = {
    restaurant: '🍽️', cafe: '☕', bar: '🍺', 'fast-food': '🍔',
    bakery: '🥐', 'ice-cream': '🍦', grocery: '🛒', supermarket: '🛒',
    shop: '🛍️', 'shopping-mall': '🏬', clothing: '👗', pharmacy: '💊',
    hospital: '🏥', dentist: '🦷', bank: '🏦', atm: '🏧',
    'gas-station': '⛽', parking: '🅿️', airport: '✈️', train: '🚂',
    'train-station': '🚉', bus: '🚌', ferry: '⛴️', taxi: '🚕',
    hotel: '🏨', lodging: '🏨', school: '🏫', university: '🎓',
    library: '📚', museum: '🏛️', park: '🌳', garden: '🌷',
    cinema: '🎬', theater: '🎭', gym: '💪', spa: '💆',
    stadium: '🏟️', golf: '⛳', swimming: '🏊', bowling: '🎳',
    laundry: '👔', post: '📮', police: '👮', 'fire-station': '🚒',
    'place-of-worship': '🕌', cemetery: '🪦', zoo: '🦁',
    'amusement-park': '🎡', landmark: '🗽', monument: '🏛️',
};

const getMakiEmoji = (maki?: string): string => {
    if (!maki) return '';
    return MAKI_EMOJI[maki] || '';
};

// ── REST reverse-geocoding ────────────────────────────────────────────────

async function reverseGeocodeRest(
    lat: number,
    lng: number,
    googleKey?: string,
    mapboxKey?: string,
): Promise<{ name: string; address: string } | null> {
    if (googleKey) {
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`,
            );
            if (res.ok) {
                const data = await res.json();
                const r = data.results?.[0];
                if (r) {
                    return {
                        name: r.address_components?.[0]?.long_name || (r.formatted_address?.split(',')[0]?.trim() ?? 'Current Location'),
                        address: r.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                    };
                }
            }
        } catch { /* fall through */ }
    }
    if (mapboxKey) {
        try {
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
                new URLSearchParams({ access_token: mapboxKey, limit: '1', types: 'poi,address,place,neighborhood' }),
            );
            if (res.ok) {
                const data = await res.json();
                const f = data.features?.[0];
                if (f) {
                    return {
                        name: f.text || f.place_name?.split(',')[0]?.trim() || 'Current Location',
                        address: f.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                    };
                }
            }
        } catch { /* fall through */ }
    }
    return null;
}

// ── Highlight matched text ─────────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    // Split with capturing group → odd indices are the matched portions
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                i % 2 === 1
                    ? <span key={i} className="font-extrabold text-foreground">{part}</span>
                    : <span key={i}>{part}</span>
            )}
        </>
    );
}

// ── Component ──────────────────────────────────────────────────────────────

export function LocationPicker({ placeName, placeAddress, placeLat, placeLng, onChange }: LocationPickerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
    const [lastPosition, setLastPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [activeIndex, setActiveIndex] = useState(-1);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const searchCacheRef = useRef<Map<string, PlacePrediction[]>>(new Map());
    const searchCacheKeysRef = useRef<string[]>([]); // FIFO order for eviction
    const coordsCacheRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
    const coordsCacheKeysRef = useRef<string[]>([]); // FIFO order for eviction
    const nearbyFetchedRef = useRef(false);
    const isSelectingCurrentRef = useRef(false);
    const sessionTokenRef = useRef({ token: crypto.randomUUID(), createdAt: Date.now() });
    const googleSessionTokenRef = useRef<any>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const getSessionToken = useCallback(() => {
        // Rotate session token after 30 minutes per Mapbox billing guidelines
        if (Date.now() - sessionTokenRef.current.createdAt > 30 * 60 * 1000) {
            sessionTokenRef.current = { token: crypto.randomUUID(), createdAt: Date.now() };
        }
        return sessionTokenRef.current.token;
    }, []);

    const [isLocating, setIsLocating] = useState(false);
    const [isLoadingNearby, setIsLoadingNearby] = useState(false);
    const [dropPinMode, setDropPinMode] = useState(false);
    const [dropPinLabel, setDropPinLabel] = useState<string | null>(null);
    const dropPinMapRef = useRef<mapboxgl.Map | null>(null);
    const dropPinGeocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasLocation = !!placeName;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

    // ── Recent locations ────────────────────────────────────────────────────

    useEffect(() => {
        try {
            const cached = localStorage.getItem('novira_recent_locations_v2');
            if (cached) setRecentLocations(JSON.parse(cached));
        } catch (e) {
            console.warn('[LocationPicker] Failed to load recent locations:', e);
        }
    }, []);

    const saveToRecent = useCallback((loc: LocationData) => {
        setRecentLocations(prev => {
            const existing = prev.find(r => r.place_name === loc.place_name);
            const updated: RecentLocation = {
                ...loc,
                visitCount: (existing?.visitCount || 0) + 1,
                lastVisited: Date.now(),
            };
            const filtered = prev.filter(r => r.place_name !== loc.place_name);
            // Sort by visit frequency, then recency — keep top 10
            const next = [updated, ...filtered]
                .sort((a, b) => b.visitCount - a.visitCount || b.lastVisited - a.lastVisited)
                .slice(0, 10);
            localStorage.setItem('novira_recent_locations_v2', JSON.stringify(next));
            return next;
        });
    }, []);

    // ── Position acquisition ────────────────────────────────────────────────

    const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    useEffect(() => { lastPositionRef.current = lastPosition; }, [lastPosition]);

    useEffect(() => {
        if (!isExpanded || lastPosition) return;
        navigator.geolocation?.getCurrentPosition(
            pos => setLastPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
        );
    }, [isExpanded, lastPosition]);

    useEffect(() => {
        if (!isExpanded) {
            nearbyFetchedRef.current = false;
            setActiveIndex(-1);
            setIsLoadingNearby(false);
            // Abandon the Google session token if user closes without selecting
            googleSessionTokenRef.current = null;
        }
    }, [isExpanded]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            abortControllerRef.current?.abort();
        };
    }, []);

    // Reset drop pin mode when picker collapses
    useEffect(() => {
        if (!isExpanded) {
            setDropPinMode(false);
            setDropPinLabel(null);
        }
    }, [isExpanded]);

    // Callback ref — fires with the real DOM node the moment React mounts/unmounts.
    // Uses bundled Mapbox GL (no script load) + REST reverse geocoding for speed.
    const dropPinMapInit = useCallback((node: HTMLDivElement | null) => {
        if (!node) {
            if (dropPinGeocodeRef.current) clearTimeout(dropPinGeocodeRef.current);
            toast.dismiss('drop-pin-location');
            dropPinMapRef.current?.remove();
            dropPinMapRef.current = null;
            return;
        }
        if (!mapboxToken) return;

        const center = lastPositionRef.current
            ? { lat: lastPositionRef.current.lat, lng: lastPositionRef.current.lng }
            : { lat: 20, lng: 0 };
        const initialZoom = lastPositionRef.current ? 15 : 3;

        const debounceReverseGeocode = (lat: number, lng: number) => {
            if (dropPinGeocodeRef.current) clearTimeout(dropPinGeocodeRef.current);
            dropPinGeocodeRef.current = setTimeout(async () => {
                const r = await reverseGeocodeRest(lat, lng, googleMapsKey, mapboxToken);
                if (r) {
                    setDropPinLabel(r.address);
                    toast('📍 ' + r.name, { id: 'drop-pin-location' });
                }
            }, 500);
        };

        mapboxgl.accessToken = mapboxToken;
        const map = new mapboxgl.Map({
            container: node,
            style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: [center.lng, center.lat],
            zoom: initialZoom,
            attributionControl: false,
        });
        dropPinMapRef.current = map;
        map.on('load', () => {
            const c = map.getCenter();
            debounceReverseGeocode(c.lat, c.lng);
            if (lastPositionRef.current) {
                const coords: [number, number] = [lastPositionRef.current.lng, lastPositionRef.current.lat];
                map.addSource('user-loc', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} } });
                map.addLayer({ id: 'user-loc-pulse', type: 'circle', source: 'user-loc', paint: { 'circle-radius': 14, 'circle-color': '#a78bfa', 'circle-opacity': 0.15 } });
                map.addLayer({ id: 'user-loc-dot', type: 'circle', source: 'user-loc', paint: { 'circle-radius': 6, 'circle-color': '#a78bfa', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });
            }
        });
        map.on('moveend', () => { const c = map.getCenter(); debounceReverseGeocode(c.lat, c.lng); });
    }, [googleMapsKey, mapboxToken]);

    const handleDropPinRecenter = useCallback(() => {
        if (!lastPosition || !dropPinMapRef.current) return;
        dropPinMapRef.current.flyTo({ center: [lastPosition.lng, lastPosition.lat], zoom: 15 });
    }, [lastPosition]);

    // queryRef — kept in sync so effects can read latest query without stale closures
    const queryRef = useRef(query);
    useEffect(() => { queryRef.current = query; }, [query]);

    // ── Background coordinate pre-fetch for Mapbox suggestions ─────────────

    const prefetchCoords = useCallback(async (results: PlacePrediction[]) => {
        if (!mapboxToken) return;
        // Pre-fetch top 5 results that don't have coords yet
        const toFetch = results.filter(r => r._mapbox_id && !coordsCacheRef.current.has(r._mapbox_id!)).slice(0, 5);
        toFetch.forEach(async (r) => {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/search/searchbox/v1/retrieve/${r._mapbox_id}?` +
                    new URLSearchParams({ access_token: mapboxToken, session_token: getSessionToken() })
                );
                const data = await res.json();
                const coords = data.features?.[0]?.geometry?.coordinates;
                if (coords) {
                    const key = r._mapbox_id!;
                    if (coordsCacheKeysRef.current.length >= 100) {
                        const evicted = coordsCacheKeysRef.current.shift()!;
                        coordsCacheRef.current.delete(evicted);
                    }
                    coordsCacheKeysRef.current.push(key);
                    coordsCacheRef.current.set(key, { lat: coords[1], lng: coords[0] });
                }
            } catch (e) {
                console.warn('[LocationPicker] Coord prefetch failed:', e);
            }
        });
    }, [mapboxToken]);

    // ── Search ──────────────────────────────────────────────────────────────

    const searchWithPhoton = useCallback((searchQuery: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (searchQuery.trim().length < 2) { setPredictions([]); setIsSearching(false); return; }

        const cacheKey = `photon:${searchQuery}:${lastPosition?.lat?.toFixed(2)},${lastPosition?.lng?.toFixed(2)}`;
        if (searchCacheRef.current.has(cacheKey)) {
            setPredictions(searchCacheRef.current.get(cacheKey)!);
            setActiveIndex(-1);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();
            try {
                const params: Record<string, string> = { q: searchQuery, limit: '8', lang: 'en' };
                if (lastPosition) { params.lat = String(lastPosition.lat); params.lon = String(lastPosition.lng); }
                const response = await fetch(`https://photon.komoot.io/api/?` + new URLSearchParams(params), { signal: abortControllerRef.current.signal });
                if (!response.ok) throw new Error('Search failed');
                const data = await response.json();
                const results = (data.features || []).map((f: any) => {
                    const props = f.properties || {};
                    const coords = f.geometry?.coordinates || [];
                    const name = props.name || props.street || 'Unknown';
                    const parts = [props.city || props.town || props.village, props.state, props.country].filter(Boolean);
                    const lat = coords[1], lon = coords[0];
                    const dist = lastPosition ? getDistance(lastPosition.lat, lastPosition.lng, lat, lon) : undefined;
                    return {
                        place_id: String(props.osm_id || Math.random()),
                        description: [name, ...parts].join(', '),
                        structured_formatting: { main_text: name, secondary_text: parts.join(', ') },
                        _lat: String(lat), _lon: String(lon), _distance: dist,
                        _is_nearby: dist !== undefined && dist < 15,
                    };
                }).sort((a: any, b: any) => (a._distance || 999) - (b._distance || 999));
                if (searchCacheKeysRef.current.length >= 50) {
                    const evicted = searchCacheKeysRef.current.shift()!;
                    searchCacheRef.current.delete(evicted);
                }
                searchCacheKeysRef.current.push(cacheKey);
                searchCacheRef.current.set(cacheKey, results);
                setPredictions(results);
                setActiveIndex(-1);
            } catch (err: any) {
                if (err?.name !== 'AbortError') setPredictions([]);
            } finally {
                if (!abortControllerRef.current?.signal.aborted) setIsSearching(false);
            }
        }, 400);
    }, [lastPosition]);

    const searchWithMapbox = useCallback((searchQuery: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (searchQuery.trim().length < 2) { setPredictions([]); setIsSearching(false); return; }

        const cacheKey = `mapbox:${searchQuery}:${lastPosition?.lat?.toFixed(2)},${lastPosition?.lng?.toFixed(2)}`;
        if (searchCacheRef.current.has(cacheKey)) {
            const cached = searchCacheRef.current.get(cacheKey)!;
            setPredictions(cached);
            setActiveIndex(-1);
            prefetchCoords(cached);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();
            const queryParams: Record<string, string> = {
                q: searchQuery, access_token: mapboxToken!, session_token: getSessionToken(),
                limit: '8', language: 'en', types: 'poi,place,address',
            };
            if (lastPosition) queryParams.proximity = `${lastPosition.lng},${lastPosition.lat}`;
            try {
                const response = await fetch(
                    `https://api.mapbox.com/search/searchbox/v1/suggest?` + new URLSearchParams(queryParams),
                    { signal: abortControllerRef.current.signal }
                );
                if (!response.ok) { searchWithPhoton(searchQuery); return; }
                const data = await response.json();
                const results = (data.suggestions || []).map((s: any) => ({
                    place_id: s.mapbox_id,
                    description: s.full_address || s.address || s.place_formatted || s.name,
                    structured_formatting: {
                        main_text: s.name || s.place_formatted || 'Unknown',
                        secondary_text: (s.full_address || s.address || s.place_formatted || '')
                            .split(',').map((p: string) => p.trim()).filter((p: string) => p !== s.name).slice(0, 2).join(', '),
                    },
                    _lat: '', _lon: '', _mapbox_id: s.mapbox_id,
                    _maki: s.maki,
                    _is_nearby: s.distance !== undefined && s.distance < 15000,
                    _distance: s.distance ? s.distance / 1000 : undefined,
                })).sort((a: any, b: any) => (a._distance || 999) - (b._distance || 999));
                if (searchCacheKeysRef.current.length >= 50) {
                    const evicted = searchCacheKeysRef.current.shift()!;
                    searchCacheRef.current.delete(evicted);
                }
                searchCacheKeysRef.current.push(cacheKey);
                searchCacheRef.current.set(cacheKey, results);
                setPredictions(results);
                setActiveIndex(-1);
                prefetchCoords(results);
                setIsSearching(false);
            } catch (err: any) {
                if (err?.name !== 'AbortError') { searchWithPhoton(searchQuery); }
            }
        }, 300);
    }, [mapboxToken, searchWithPhoton, prefetchCoords, lastPosition]);

    const searchWithGoogle = useCallback((searchQuery: string) => {
        if (!googleMapsKey) { searchWithMapbox(searchQuery); return; }
        if (searchQuery.trim().length < 2) { setPredictions([]); setIsSearching(false); return; }

        const pos = lastPositionRef.current;
        const cacheKey = `google:${searchQuery}:${pos?.lat?.toFixed(2)},${pos?.lng?.toFixed(2)}`;
        if (searchCacheRef.current.has(cacheKey)) {
            setPredictions(searchCacheRef.current.get(cacheKey)!);
            setActiveIndex(-1);
            return;
        }

        setIsSearching(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                // Rotate session token per search session
                if (!googleSessionTokenRef.current) {
                    googleSessionTokenRef.current = crypto.randomUUID();
                }
                const body: Record<string, unknown> = {
                    input: searchQuery,
                    sessionToken: googleSessionTokenRef.current,
                };
                const currentPos = lastPositionRef.current;
                if (currentPos) {
                    // origin enables distanceMeters in the response
                    body.origin = { latitude: currentPos.lat, longitude: currentPos.lng };
                    body.locationBias = {
                        circle: { center: { latitude: currentPos.lat, longitude: currentPos.lng }, radius: 10000 }
                    };
                }
                const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': googleMapsKey,
                        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.distanceMeters',
                    },
                    body: JSON.stringify(body),
                });
                if (!response.ok) throw new Error(`Places API ${response.status}`);
                const data = await response.json();
                const results: PlacePrediction[] = (data.suggestions || []).map((s: any) => {
                    const p = s.placePrediction;
                    return {
                        place_id: p.placeId,
                        description: p.text?.text || '',
                        structured_formatting: {
                            main_text: p.structuredFormat?.mainText?.text || p.text?.text || '',
                            secondary_text: p.structuredFormat?.secondaryText?.text || '',
                        },
                        _lat: '', _lon: '',
                        _distance: p.distanceMeters != null ? p.distanceMeters / 1000 : undefined,
                        _source: 'google' as const,
                    };
                }).sort((a: PlacePrediction, b: PlacePrediction) =>
                    (a._distance ?? Infinity) - (b._distance ?? Infinity)
                );
                if (searchCacheKeysRef.current.length >= 50) {
                    const evicted = searchCacheKeysRef.current.shift()!;
                    searchCacheRef.current.delete(evicted);
                }
                searchCacheKeysRef.current.push(cacheKey);
                searchCacheRef.current.set(cacheKey, results);
                setPredictions(results);
                setActiveIndex(-1);
                setIsSearching(false);
            } catch (e) {
                console.warn('[LocationPicker] Google Places API (New) failed, falling back to Photon:', e);
                searchWithPhoton(searchQuery);
                setIsSearching(false);
            }
        }, 300);
    }, [googleMapsKey, searchWithPhoton]);

    const handleSearch = googleMapsKey ? searchWithGoogle : mapboxToken ? searchWithMapbox : searchWithPhoton;
    const handleSearchRef = useRef(handleSearch);
    useEffect(() => { handleSearchRef.current = handleSearch; });

    // Re-trigger search when position resolves while user already has a query
    // (fixes stale-closure bias: user typed before geolocation returned)
    useEffect(() => {
        if (!lastPosition || queryRef.current.length < 2) return;
        if (predictions.length > 0 && predictions.every(p => p._distance === undefined)) {
            handleSearchRef.current(queryRef.current);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastPosition]);

    // ── Nearby POIs on open ─────────────────────────────────────────────────

    useEffect(() => {
        if (!isExpanded || !lastPosition || query.length > 0 || nearbyFetchedRef.current) return;
        if (!googleMapsKey && !mapboxToken) return;
        nearbyFetchedRef.current = true;

        const ac = new AbortController();
        (async () => {
            setIsLoadingNearby(true);
            // Google Places API (New) — REST, no SDK load
            if (googleMapsKey) {
                try {
                    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
                        method: 'POST',
                        signal: ac.signal,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': googleMapsKey,
                            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
                        },
                        body: JSON.stringify({
                            locationRestriction: {
                                circle: {
                                    center: { latitude: lastPosition.lat, longitude: lastPosition.lng },
                                    radius: 500,
                                },
                            },
                            maxResultCount: 8,
                            languageCode: 'en',
                        }),
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (ac.signal.aborted) return;
                        const results: PlacePrediction[] = (data.places || []).map((p: any) => {
                            const lat = p.location?.latitude;
                            const lng = p.location?.longitude;
                            const dist = (lat != null && lng != null)
                                ? getDistance(lastPosition.lat, lastPosition.lng, lat, lng)
                                : 0;
                            return {
                                place_id: p.id,
                                description: p.formattedAddress || p.displayName?.text || '',
                                structured_formatting: {
                                    main_text: p.displayName?.text || 'Unknown',
                                    secondary_text: p.formattedAddress || '',
                                },
                                _lat: lat != null ? String(lat) : '',
                                _lon: lng != null ? String(lng) : '',
                                _is_nearby: true,
                                _distance: dist,
                                _source: 'google' as const,
                            };
                        }).sort((a: PlacePrediction, b: PlacePrediction) => (a._distance || 0) - (b._distance || 0));
                        setPredictions(results);
                        setIsLoadingNearby(false);
                        return;
                    }
                    console.warn('[LocationPicker] Google nearby search non-OK:', response.status);
                } catch (e: unknown) {
                    if ((e as { name?: string })?.name === 'AbortError') return;
                    console.warn('[LocationPicker] Google nearby search failed:', e);
                }
            }
            if (mapboxToken) {
                try {
                    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lastPosition.lng},${lastPosition.lat}.json?` +
                        new URLSearchParams({ access_token: mapboxToken, types: 'poi', limit: '8' });
                    const response = await fetch(url, { signal: ac.signal });
                    if (response.ok) {
                        const data = await response.json();
                        if (ac.signal.aborted) return;
                        setPredictions((data.features || []).map((f: any) => {
                            const name = f.text || f.place_name?.split(',')[0] || 'Unknown';
                            const address = f.place_name || '';
                            const secondary = address.replace(name, '').replace(/^,\s*/, '').trim();
                            const dist = getDistance(lastPosition.lat, lastPosition.lng, f.geometry.coordinates[1], f.geometry.coordinates[0]);
                            return {
                                place_id: f.id, description: address,
                                structured_formatting: { main_text: name, secondary_text: secondary },
                                _lat: String(f.geometry.coordinates[1]), _lon: String(f.geometry.coordinates[0]),
                                _is_nearby: true, _distance: dist, _maki: f.properties?.maki,
                            };
                        }).sort((a: any, b: any) => (a._distance || 0) - (b._distance || 0)));
                    }
                } catch (e: unknown) {
                    if ((e as { name?: string })?.name === 'AbortError') return;
                    console.warn('[LocationPicker] Nearby POI fetch failed:', e);
                }
            }
            if (!ac.signal.aborted) setIsLoadingNearby(false);
        })();
        return () => ac.abort();
    }, [isExpanded, lastPosition, query.length, googleMapsKey, mapboxToken]);

    // ── Selection ───────────────────────────────────────────────────────────

    const handleSelectPlace = useCallback(async (prediction: PlacePrediction | RecentLocation) => {
        toast.haptic(ImpactStyle.Light);

        // Recent location tap
        if ('visitCount' in prediction) {
            const item = prediction as RecentLocation;
            onChange({ place_name: item.place_name, place_address: item.place_address, place_lat: item.place_lat, place_lng: item.place_lng });
            saveToRecent(item);
            setIsExpanded(false); setQuery(''); setPredictions([]);
            return;
        }

        const pred = prediction as PlacePrediction;

        // Check pre-fetched coords cache first (eliminates retrieve latency)
        if (pred._mapbox_id && coordsCacheRef.current.has(pred._mapbox_id)) {
            const { lat, lng } = coordsCacheRef.current.get(pred._mapbox_id)!;
            const loc: LocationData = { place_name: pred.structured_formatting.main_text, place_address: pred.description, place_lat: lat, place_lng: lng };
            onChange(loc); saveToRecent(loc);
            sessionTokenRef.current = { token: crypto.randomUUID(), createdAt: Date.now() };
            setIsExpanded(false); setQuery(''); setPredictions([]);
            return;
        }

        // Google place details (Places API New — single fetch, no JS SDK needed)
        if (pred._source === 'google' && googleMapsKey && !pred._lat) {
            try {
                const sessionToken = typeof googleSessionTokenRef.current === 'string'
                    ? googleSessionTokenRef.current : null;
                googleSessionTokenRef.current = null; // rotate — closes the billing session
                const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(pred.place_id)}`);
                if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
                const response = await fetch(url.toString(), {
                    headers: {
                        'X-Goog-Api-Key': googleMapsKey,
                        'X-Goog-FieldMask': 'location,displayName,formattedAddress',
                    },
                });
                if (response.ok) {
                    const detail = await response.json();
                    if (detail.location) {
                        const loc: LocationData = {
                            place_name: detail.displayName?.text || pred.structured_formatting.main_text,
                            place_address: detail.formattedAddress || pred.description,
                            place_lat: detail.location.latitude,
                            place_lng: detail.location.longitude,
                        };
                        onChange(loc); saveToRecent(loc);
                        setIsExpanded(false); setQuery(''); setPredictions([]);
                        return;
                    }
                }
            } catch (e) {
                console.warn('[LocationPicker] Google place details failed:', e);
            }
        }

        // Mapbox retrieve (fallback when not pre-fetched)
        if (mapboxToken && pred._mapbox_id && !pred._lat) {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/search/searchbox/v1/retrieve/${pred._mapbox_id}?` +
                    new URLSearchParams({ access_token: mapboxToken, session_token: getSessionToken() })
                );
                const data = await res.json();
                const coords = data.features?.[0]?.geometry?.coordinates;
                if (coords) {
                    const loc: LocationData = { place_name: pred.structured_formatting.main_text, place_address: pred.description, place_lat: coords[1], place_lng: coords[0] };
                    onChange(loc); saveToRecent(loc);
                    sessionTokenRef.current = { token: crypto.randomUUID(), createdAt: Date.now() };
                    setIsExpanded(false); setQuery(''); setPredictions([]);
                    return;
                }
            } catch (e) {
                console.warn('[LocationPicker] Mapbox retrieve failed:', e);
            }
        }

        // Direct coords (Photon result, or Google result already enriched with geometry)
        const lat = parseFloat(pred._lat), lng = parseFloat(pred._lon);
        if (isNaN(lat) || isNaN(lng)) { toast.error('Could not get location coordinates'); return; }
        if (pred._source === 'google') googleSessionTokenRef.current = null; // close billing session
        const loc: LocationData = { place_name: pred.structured_formatting.main_text, place_address: pred.description, place_lat: lat, place_lng: lng };
        onChange(loc); saveToRecent(loc);
        setIsExpanded(false); setQuery(''); setPredictions([]);
    }, [googleMapsKey, mapboxToken, onChange, saveToRecent]);

    // ── Keyboard navigation (desktop PWA / bluetooth keyboard on mobile) ────

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const isShowingRecents = query.length === 0 && recentLocations.length > 0 && predictions.length === 0;
        const activeList = predictions.length > 0 ? predictions : isShowingRecents ? recentLocations : [];
        if (activeList.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => {
                const next = Math.min(i + 1, activeList.length - 1);
                listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
                return next;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => {
                const next = Math.max(i - 1, 0);
                listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
                return next;
            });
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelectPlace(activeList[activeIndex]);
        } else if (e.key === 'Escape') {
            setIsExpanded(false); setQuery(''); setPredictions([]);
        }
    }, [predictions, recentLocations, activeIndex, handleSelectPlace, query.length]);

    // ── Current location ────────────────────────────────────────────────────

    const handleNativeGeolocation = useCallback(() => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); setIsLocating(false); return; }
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            setLastPosition({ lat: latitude, lng: longitude });
            isSelectingCurrentRef.current = false;
            const fallback: LocationData = {
                place_name: 'Current Location',
                place_address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                place_lat: latitude, place_lng: longitude,
            };
            const r = await reverseGeocodeRest(latitude, longitude, googleMapsKey, mapboxToken);
            const loc: LocationData = r
                ? { place_name: r.name, place_address: r.address, place_lat: latitude, place_lng: longitude }
                : fallback;
            onChange(loc);
            saveToRecent(loc);
            setIsExpanded(false);
            setIsLocating(false);
        }, (err) => {
            const msg = err.code === err.PERMISSION_DENIED
                ? 'Location permission denied. Enable in device settings.'
                : err.code === err.TIMEOUT
                    ? 'Location request timed out. Try again.'
                    : 'Unable to get your location.';
            toast.error(msg);
            setIsLocating(false);
        }, { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 });
    }, [googleMapsKey, mapboxToken, onChange, saveToRecent]);

    const handleUseCurrentLocation = () => { setIsLocating(true); handleNativeGeolocation(); };

    // ── Utils ───────────────────────────────────────────────────────────────

    const handleClear = () => { onChange({ place_name: null, place_address: null, place_lat: null, place_lng: null }); setQuery(''); setPredictions([]); };

    const getStaticMapUrl = (lat: number, lng: number) => {
        if (mapboxToken) return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+a855f7(${lng},${lat})/${lng},${lat},14,0/400x200@2x?access_token=${mapboxToken}`;
        if (googleMapsKey) return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x200&markers=color:purple%7C${lat},${lng}&key=${googleMapsKey}`;
        return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=400x200&markers=${lat},${lng},red-pushpin`;
    };

    const formatDist = (d: number) => d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;

    // ── Collapsed: location card ────────────────────────────────────────────

    if (!isExpanded) {
        if (hasLocation) {
            const isOnline = placeName === 'Online';
            return (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Location</p>
                    <div className={cn(
                        "rounded-2xl border overflow-hidden",
                        isOnline ? "border-blue-500/20 bg-blue-500/5" : "border-emerald-500/20 bg-emerald-500/5"
                    )}>
                        {!isOnline && placeLat && placeLng && (
                            <div onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${placeLat},${placeLng}`, '_blank')}
                                className="w-full h-[100px] bg-secondary/20 cursor-pointer relative overflow-hidden active:opacity-80 transition-opacity">
                                <Image src={getStaticMapUrl(placeLat, placeLng)} alt="Map" fill className="object-cover opacity-80" sizes="400px" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
                                    <Navigation className="w-2.5 h-2.5" /> Directions
                                </div>
                            </div>
                        )}
                        <div className="p-3 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5",
                                    isOnline ? "bg-blue-500/20 border-blue-500/20" : "bg-emerald-500/20 border-emerald-500/20"
                                )}>
                                    {isOnline
                                        ? <Globe className="w-4 h-4 text-blue-400" />
                                        : <MapPin className="w-4 h-4 text-emerald-500" />
                                    }
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={cn("text-sm font-bold break-words line-clamp-2", isOnline ? "text-blue-400" : "text-emerald-400")}>{placeName}</p>
                                    {placeAddress && <p className="text-[10px] text-muted-foreground break-words line-clamp-2 mt-0.5">{placeAddress}</p>}
                                </div>
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleClear(); }}
                                className="p-2 rounded-full active:bg-white/10 text-muted-foreground active:text-rose-400 transition-colors shrink-0 -mt-1 touch-manipulation">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <button type="button" onClick={() => setIsExpanded(true)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/10 border border-white/5 active:border-primary/30 active:bg-primary/5 transition-all touch-manipulation">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Add Location</span>
            </button>
        );
    }

    // ── Expanded: search UI ─────────────────────────────────────────────────

    const showRecents = query.length === 0 && recentLocations.length > 0 && predictions.length === 0;

    return (
        <div className={cn('space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 relative', predictions.length > 0 || showRecents ? 'z-[50]' : 'z-0')}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <label htmlFor="location-search" className="text-sm font-medium">Search Location</label>
                <button type="button"
                    onClick={() => { setIsExpanded(false); setQuery(''); setPredictions([]); }}
                    className="text-[11px] font-medium text-muted-foreground active:text-foreground transition-colors px-2 py-1 touch-manipulation">
                    Cancel
                </button>
            </div>

            {/* Search input */}
            <div className="relative">
                <Input
                    id="location-search" name="location-search"
                    autoFocus autoComplete="off" inputMode="search"
                    role="combobox" aria-expanded={predictions.length > 0 || showRecents} aria-haspopup="listbox"
                    aria-controls="loc-listbox"
                    aria-activedescendant={activeIndex >= 0 ? `loc-option-${activeIndex}` : undefined}
                    placeholder="Search for a place..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); handleSearch(e.target.value); setActiveIndex(-1); }}
                    onKeyDown={handleKeyDown}
                    className="h-14 pl-12 pr-4 bg-primary/5 border-primary/20 focus-visible:ring-primary/30 rounded-2xl text-base"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    {isSearching && query.length > 0
                        ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        : <div className="p-1 rounded-lg bg-primary/10"><Search className="w-4 h-4 text-primary" /></div>
                    }
                </div>
            </div>

            {/* Quick-select buttons */}
            <div className={cn("grid gap-2", mapboxToken ? "grid-cols-3" : "grid-cols-2")}>
                <button type="button" onClick={handleUseCurrentLocation}
                    className="h-[72px] flex flex-col items-center justify-center gap-2 px-2 rounded-2xl border border-primary/20 bg-primary/5 active:bg-primary/10 transition-all touch-manipulation">
                    <div className={cn('w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0', isLocating && 'animate-pulse')}>
                        <LocateFixed className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-[10px] font-bold text-primary text-center leading-tight">
                        {isLocating ? 'Locating…' : 'My Location'}
                    </p>
                </button>
                <button type="button" onClick={() => {
                    onChange({ place_name: 'Online', place_address: null, place_lat: null, place_lng: null });
                    setIsExpanded(false); setQuery(''); setPredictions([]);
                }}
                    className="h-[72px] flex flex-col items-center justify-center gap-2 px-2 rounded-2xl border border-blue-500/20 bg-blue-500/5 active:bg-blue-500/10 transition-all touch-manipulation">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-[10px] font-bold text-blue-400 text-center leading-tight">Online</p>
                </button>
                {mapboxToken && (
                    <button type="button"
                        onClick={() => { setDropPinMode(v => !v); setDropPinLabel(null); }}
                        disabled={!lastPosition && !dropPinMode}
                        className={cn(
                            "h-[72px] flex flex-col items-center justify-center gap-2 px-2 rounded-2xl border transition-all touch-manipulation",
                            dropPinMode
                                ? "border-rose-500/40 bg-rose-500/10 active:bg-rose-500/15"
                                : "border-rose-500/20 bg-rose-500/5 active:bg-rose-500/10",
                            !lastPosition && !dropPinMode && "opacity-50 cursor-not-allowed"
                        )}>
                        <div className={cn("w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0", dropPinMode && "ring-1 ring-rose-500/40")}>
                            <Crosshair className="w-4 h-4 text-rose-400" />
                        </div>
                        <p className="text-[10px] font-bold text-rose-400 text-center leading-tight">
                            {dropPinMode ? 'Cancel' : !lastPosition ? 'Locating…' : 'Drop Pin'}
                        </p>
                    </button>
                )}
            </div>

            {/* Drop-pin mini map — rendered outside AnimatePresence so mapboxgl gets a real container */}
            {dropPinMode && mapboxToken && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl border border-rose-500/20 overflow-hidden">
                    <div className="relative">
                        {/* Map container — callback ref fires with real node so mapboxgl gets proper dimensions */}
                        <div ref={dropPinMapInit} className="w-full h-[240px]" />
                        {/* Recenter button */}
                        {lastPosition && (
                            <button
                                type="button"
                                onClick={handleDropPinRecenter}
                                className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center active:bg-white/10 transition-colors touch-manipulation shadow-lg"
                                title="Go to my location">
                                <LocateFixed className="w-4 h-4 text-violet-300" />
                            </button>
                        )}
                        {/* Centered pin overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="relative -translate-y-3">
                                <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-10 drop-shadow-lg">
                                    <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 24 16 24S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#f43f5e" />
                                    <circle cx="16" cy="16" r="7" fill="white" fillOpacity="0.9" />
                                </svg>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0.5 h-2 bg-rose-500/60 rounded-full" />
                            </div>
                        </div>
                        {/* Location label */}
                        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                            <div className="bg-black/70 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 min-h-[36px] flex flex-col justify-center">
                                {dropPinLabel ? (
                                    <>
                                        <p className="text-[11px] font-semibold text-white line-clamp-1">{dropPinLabel.split(',')[0]}</p>
                                        <p className="text-[10px] text-white/50 line-clamp-1 mt-0.5">{dropPinLabel.split(',').slice(1).join(',').trim()}</p>
                                    </>
                                ) : (
                                    <p className="text-[11px] text-white/30 animate-pulse">Finding location…</p>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Confirm button */}
                    <button type="button"
                        onClick={() => {
                            if (!dropPinMapRef.current) return;
                            const c = dropPinMapRef.current.getCenter();
                            const lat = c.lat;
                            const lng = c.lng;
                            const loc: LocationData = {
                                place_name: dropPinLabel?.split(',')[0]?.trim() ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                                place_address: dropPinLabel ?? null,
                                place_lat: lat,
                                place_lng: lng,
                            };
                            onChange(loc);
                            saveToRecent(loc);
                            toast.dismiss('drop-pin-location');
                            setDropPinMode(false);
                            setIsExpanded(false);
                            setQuery('');
                            setPredictions([]);
                        }}
                        disabled={!dropPinLabel}
                        className="w-full h-12 flex items-center justify-center gap-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-400 font-bold text-sm disabled:opacity-40 active:bg-rose-500/20 transition-colors touch-manipulation">
                        <MapPin className="w-4 h-4" />
                        Use this location
                    </button>
                </motion.div>
            )}

            {/* Nearby loading shimmer */}
            {!dropPinMode && isLoadingNearby && query.length === 0 && (
                <p className="text-[10px] text-primary/40 text-center py-1 animate-pulse">Finding nearby places…</p>
            )}

            {/* Recent locations */}
            <AnimatePresence>
                {!dropPinMode && showRecents && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        id="loc-listbox" role="listbox" aria-label="Recent locations"
                        className="absolute left-0 right-0 top-full mt-2 z-[100] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden ring-1 ring-white/5">
                        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 pt-2.5 pb-1">Recent</p>
                        <div className="max-h-[260px] overflow-y-auto no-scrollbar" ref={listRef}>
                            {recentLocations.map((loc, i) => {
                                const dist = lastPosition && loc.place_lat && loc.place_lng
                                    ? getDistance(lastPosition.lat, lastPosition.lng, loc.place_lat, loc.place_lng)
                                    : undefined;
                                return (
                                    <button key={`${loc.place_name}-${i}`} type="button"
                                        id={`loc-option-${i}`} role="option" aria-selected={activeIndex === i}
                                        onClick={() => handleSelectPlace(loc)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-3.5 transition-colors border-b border-white/5 last:border-b-0 text-left touch-manipulation min-h-[56px]',
                                            activeIndex === i ? 'bg-white/10' : 'active:bg-white/5'
                                        )}>
                                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                            <MapPin className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold line-clamp-1">{loc.place_name}</p>
                                            {loc.place_address && (
                                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 truncate">{loc.place_address}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                            {dist !== undefined && (
                                                <span className="text-[10px] text-primary/60 font-semibold">{formatDist(dist)}</span>
                                            )}
                                            {loc.visitCount > 1 && (
                                                <span className="text-[9px] font-bold text-primary/50 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                    {loc.visitCount}×
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search results */}
            <AnimatePresence>
                {!dropPinMode && predictions.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        id="loc-listbox" role="listbox" aria-label="Location suggestions"
                        className="absolute left-0 right-0 top-full mt-2 z-[100] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden ring-1 ring-white/5">
                        <div className="max-h-[280px] overflow-y-auto no-scrollbar" ref={listRef}>
                            {predictions.map((prediction, i) => {
                                const emoji = getMakiEmoji(prediction._maki);
                                const isActive = activeIndex === i;
                                return (
                                    <button key={prediction.place_id} type="button"
                                        id={`loc-option-${i}`} role="option" aria-selected={isActive}
                                        onClick={() => handleSelectPlace(prediction)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-3.5 transition-colors border-b border-white/5 last:border-b-0 text-left touch-manipulation min-h-[56px]',
                                            isActive ? 'bg-white/10' : 'active:bg-white/5'
                                        )}>
                                        {/* Category icon */}
                                        <div className={cn(
                                            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 border text-base',
                                            prediction._is_nearby ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-primary/10 border-primary/20'
                                        )}>
                                            {emoji
                                                ? <span className="text-base leading-none">{emoji}</span>
                                                : <MapPin className={cn('w-4 h-4', prediction._is_nearby ? 'text-emerald-500' : 'text-primary')} />
                                            }
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold break-words line-clamp-1">
                                                <HighlightedText text={prediction.structured_formatting.main_text} query={query} />
                                            </p>
                                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 flex items-center gap-1">
                                                {prediction._is_nearby && (
                                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-1 rounded-sm shrink-0">Near</span>
                                                )}
                                                <span className="truncate">{prediction.structured_formatting.secondary_text}</span>
                                            </p>
                                        </div>

                                        {prediction._distance !== undefined && (
                                            <span className="text-[10px] text-primary/60 font-semibold shrink-0 ml-1">
                                                {formatDist(prediction._distance)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {googleMapsKey && (
                            <p className="text-[9px] text-muted-foreground/30 text-right pr-3 py-1 bg-white/[0.02]">
                                Powered by Google
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty state */}
            {!dropPinMode && query.length >= 2 && !isSearching && predictions.length === 0 && (
                <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No places found. Try a different search.</p>
                </div>
            )}
        </div>
    );
}
