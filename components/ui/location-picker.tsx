'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Search, Navigation, LocateFixed, Clock } from 'lucide-react';
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

// ── Highlight matched text ─────────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part)
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
    const coordsCacheRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
    const nearbyFetchedRef = useRef(false);
    const isSelectingCurrentRef = useRef(false);
    const sessionTokenRef = useRef(crypto.randomUUID());
    const listRef = useRef<HTMLDivElement>(null);

    const [isLocating, setIsLocating] = useState(false);
    const hasLocation = !!placeName;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // ── Recent locations ────────────────────────────────────────────────────

    useEffect(() => {
        try {
            const cached = localStorage.getItem('novira_recent_locations_v2');
            if (cached) setRecentLocations(JSON.parse(cached));
        } catch {}
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
        }
    }, [isExpanded]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            abortControllerRef.current?.abort();
        };
    }, []);

    // ── Background coordinate pre-fetch for Mapbox suggestions ─────────────

    const prefetchCoords = useCallback(async (results: PlacePrediction[]) => {
        if (!mapboxToken) return;
        // Pre-fetch top 2 results that don't have coords yet
        const toFetch = results.filter(r => r._mapbox_id && !coordsCacheRef.current.has(r._mapbox_id!)).slice(0, 2);
        toFetch.forEach(async (r) => {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/search/searchbox/v1/retrieve/${r._mapbox_id}?` +
                    new URLSearchParams({ access_token: mapboxToken, session_token: sessionTokenRef.current })
                );
                const data = await res.json();
                const coords = data.features?.[0]?.geometry?.coordinates;
                if (coords) coordsCacheRef.current.set(r._mapbox_id!, { lat: coords[1], lng: coords[0] });
            } catch {}
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
                q: searchQuery, access_token: mapboxToken!, session_token: sessionTokenRef.current,
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

    const handleSearch = mapboxToken ? searchWithMapbox : searchWithPhoton;

    // ── Nearby POIs on open ─────────────────────────────────────────────────

    useEffect(() => {
        if (!isExpanded || !lastPosition || query.length > 0 || !mapboxToken || nearbyFetchedRef.current) return;
        nearbyFetchedRef.current = true;
        (async () => {
            setIsSearching(true);
            try {
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lastPosition.lng},${lastPosition.lat}.json?` +
                    new URLSearchParams({ access_token: mapboxToken!, types: 'poi', limit: '8' });
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
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
            } catch {}
            finally { setIsSearching(false); }
        })();
    }, [isExpanded, lastPosition, query.length, mapboxToken]);

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
            sessionTokenRef.current = crypto.randomUUID();
            setIsExpanded(false); setQuery(''); setPredictions([]);
            return;
        }

        // Mapbox retrieve (fallback when not pre-fetched)
        if (mapboxToken && pred._mapbox_id && !pred._lat) {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/search/searchbox/v1/retrieve/${pred._mapbox_id}?` +
                    new URLSearchParams({ access_token: mapboxToken, session_token: sessionTokenRef.current })
                );
                const data = await res.json();
                const coords = data.features?.[0]?.geometry?.coordinates;
                if (coords) {
                    const loc: LocationData = { place_name: pred.structured_formatting.main_text, place_address: pred.description, place_lat: coords[1], place_lng: coords[0] };
                    onChange(loc); saveToRecent(loc);
                    sessionTokenRef.current = crypto.randomUUID();
                    setIsExpanded(false); setQuery(''); setPredictions([]);
                    return;
                }
            } catch {}
        }

        // Photon / direct coords
        const lat = parseFloat(pred._lat), lng = parseFloat(pred._lon);
        if (isNaN(lat) || isNaN(lng)) { toast.error('Could not get location coordinates'); return; }
        const loc: LocationData = { place_name: pred.structured_formatting.main_text, place_address: pred.description, place_lat: lat, place_lng: lng };
        onChange(loc); saveToRecent(loc);
        setIsExpanded(false); setQuery(''); setPredictions([]);
    }, [mapboxToken, onChange, saveToRecent]);

    // ── Keyboard navigation (desktop PWA / bluetooth keyboard on mobile) ────

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (predictions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => {
                const next = Math.min(i + 1, predictions.length - 1);
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
            handleSelectPlace(predictions[activeIndex]);
        } else if (e.key === 'Escape') {
            setIsExpanded(false); setQuery(''); setPredictions([]);
        }
    }, [predictions, activeIndex, handleSelectPlace]);

    // ── Current location ────────────────────────────────────────────────────

    const handleNativeGeolocation = useCallback(() => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); setIsLocating(false); return; }
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            setLastPosition({ lat: latitude, lng: longitude });
            isSelectingCurrentRef.current = false;
            try {
                if (mapboxToken) {
                    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}`);
                    const data = await res.json();
                    const name = data.features?.[0]?.place_name?.split(',')[0] || 'Current Location';
                    const address = data.features?.[0]?.place_name || 'Nearby';
                    const loc: LocationData = { place_name: name, place_address: address, place_lat: latitude, place_lng: longitude };
                    onChange(loc); saveToRecent(loc);
                } else {
                    const loc: LocationData = { place_name: 'Current Location', place_address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, place_lat: latitude, place_lng: longitude };
                    onChange(loc); saveToRecent(loc);
                }
            } catch {
                const loc: LocationData = { place_name: 'Current Location', place_address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, place_lat: latitude, place_lng: longitude };
                onChange(loc); saveToRecent(loc);
            }
            setIsExpanded(false); setIsLocating(false);
        }, () => {
            toast.error('Location unavailable'); setIsLocating(false);
        }, { enableHighAccuracy: true, timeout: 8000 });
    }, [mapboxToken, onChange, saveToRecent]);

    const handleUseCurrentLocation = () => { setIsLocating(true); handleNativeGeolocation(); };

    // ── Utils ───────────────────────────────────────────────────────────────

    const handleClear = () => { onChange({ place_name: null, place_address: null, place_lat: null, place_lng: null }); setQuery(''); setPredictions([]); };

    const getStaticMapUrl = (lat: number, lng: number) => mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+a855f7(${lng},${lat})/${lng},${lat},14,0/400x200@2x?access_token=${mapboxToken}`
        : `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=400x200&markers=${lat},${lng},red-pushpin`;

    const formatDist = (d: number) => d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;

    // ── Collapsed: location card ────────────────────────────────────────────

    if (!isExpanded) {
        if (hasLocation) {
            return (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Location</p>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                        {placeLat && placeLng && (
                            <div onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${placeLat},${placeLng}`, '_blank')}
                                className="w-full h-[100px] bg-secondary/20 cursor-pointer relative overflow-hidden active:opacity-80 transition-opacity">
                                <img src={getStaticMapUrl(placeLat, placeLng)} alt="Map" className="w-full h-full object-cover opacity-80" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
                                    <Navigation className="w-2.5 h-2.5" /> Directions
                                </div>
                            </div>
                        )}
                        <div className="p-3 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                                    <MapPin className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-emerald-400 break-words line-clamp-2">{placeName}</p>
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
                    id="location-search" name="location-search" ref={(el) => { (el as any); }}
                    autoFocus autoComplete="off" inputMode="search"
                    role="combobox" aria-expanded={predictions.length > 0} aria-haspopup="listbox"
                    aria-activedescendant={activeIndex >= 0 ? `loc-option-${activeIndex}` : undefined}
                    placeholder="Search for a place..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); handleSearch(e.target.value); setActiveIndex(-1); }}
                    onKeyDown={handleKeyDown}
                    className="h-14 pl-12 pr-4 bg-primary/5 border-primary/20 focus-visible:ring-primary/30 rounded-2xl text-base"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    {isSearching
                        ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        : <div className="p-1 rounded-lg bg-primary/10"><Search className="w-4 h-4 text-primary" /></div>
                    }
                </div>
            </div>

            {/* Current location button — large touch target */}
            <button type="button" onClick={handleUseCurrentLocation}
                className="w-full h-14 flex items-center gap-4 px-4 rounded-2xl border border-primary/20 bg-primary/5 active:bg-primary/10 transition-all touch-manipulation">
                <div className={cn('w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 transition-transform', isLocating && 'animate-pulse')}>
                    <LocateFixed className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-primary">{isLocating ? 'Locating…' : 'Use Current Location'}</p>
                    <p className="text-[10px] text-primary/60 font-medium">Detect where you are right now</p>
                </div>
            </button>

            {/* Recent locations */}
            <AnimatePresence>
                {showRecents && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 right-0 top-full mt-2 z-[100] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden ring-1 ring-white/5">
                        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 pt-2.5 pb-1">Recent</p>
                        <div className="max-h-[260px] overflow-y-auto no-scrollbar" ref={listRef}>
                            {recentLocations.map((loc, i) => (
                                <button key={`${loc.place_name}-${i}`} type="button"
                                    id={`loc-option-${i}`} role="option" aria-selected={activeIndex === i}
                                    onClick={() => handleSelectPlace(loc)}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-3.5 transition-colors border-b border-white/5 last:border-b-0 text-left touch-manipulation min-h-[56px]',
                                        activeIndex === i ? 'bg-white/10' : 'active:bg-white/5'
                                    )}>
                                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-base">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{loc.place_name}</p>
                                        {loc.place_address && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{loc.place_address}</p>}
                                    </div>
                                    {loc.visitCount > 1 && (
                                        <span className="text-[9px] font-bold text-primary/50 bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                                            {loc.visitCount}×
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search results */}
            <AnimatePresence>
                {predictions.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 right-0 top-full mt-2 z-[100] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden ring-1 ring-white/5"
                        role="listbox" aria-label="Location suggestions">
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
                        {mapboxToken && (
                            <p className="text-[9px] text-muted-foreground/30 text-right pr-3 py-1 bg-white/[0.02]">
                                Powered by Mapbox
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty state */}
            {query.length >= 2 && !isSearching && predictions.length === 0 && (
                <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No places found. Try a different search.</p>
                </div>
            )}
        </div>
    );
}
