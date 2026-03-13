'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Search, Navigation, Loader2, LocateFixed } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getDistance } from '@/lib/location';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from '@/utils/haptics';

interface LocationData {
    place_name: string | null;
    place_address: string | null;
    place_lat: number | null;
    place_lng: number | null;
}

interface LocationPickerProps {
    placeName: string | null;
    placeAddress: string | null;
    placeLat: number | null;
    placeLng: number | null;
    onChange: (location: LocationData) => void;
}

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
    _lat: string;
    _lon: string;
    _is_nearby?: boolean;
    _distance?: number;
}

import { motion, AnimatePresence } from 'framer-motion';

export function LocationPicker({ placeName, placeAddress, placeLat, placeLng, onChange }: LocationPickerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
    const [lastPosition, setLastPosition] = useState<{ lat: number, lng: number } | null>(null);
    const [debounceRef] = useState<{ current: ReturnType<typeof setTimeout> | null }>({ current: null });
    const [isLocating, setIsLocating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const geolocateControlRef = useRef<mapboxgl.GeolocateControl | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const isSelectingCurrentRef = useRef(false);

    const hasLocation = !!placeName;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isExpanded]);

    // Load recent locations on mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem('novira_recent_locations');
            if (cached) setRecentLocations(JSON.parse(cached));
        } catch {}
    }, []);


    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Photon search (free, no API key — also used as fallback when Mapbox fails)
    const searchWithPhoton = useCallback((searchQuery: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (searchQuery.trim().length < 2) {
            setPredictions([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        debounceRef.current = setTimeout(async () => {
            try {
                const params: any = {
                    q: searchQuery,
                    limit: '5',
                    lang: 'en',
                };
                if (lastPosition) {
                    params.lat = lastPosition.lat;
                    params.lon = lastPosition.lng;
                }

                const response = await fetch(
                    `https://photon.komoot.io/api/?` + new URLSearchParams(params)
                );

                if (!response.ok) throw new Error('Search failed');
                const data = await response.json();

                setPredictions((data.features || []).map((f: any) => {
                    const props = f.properties || {};
                    const coords = f.geometry?.coordinates || [];
                    const name = props.name || props.street || 'Unknown';
                    const parts = [props.city || props.town || props.village, props.state, props.country].filter(Boolean);
                    const lat = coords[1];
                    const lon = coords[0];
                    const dist = lastPosition ? getDistance(lastPosition.lat, lastPosition.lng, lat, lon) : undefined;

                    return {
                        place_id: String(props.osm_id || Math.random()),
                        description: [name, ...parts].join(', '),
                        structured_formatting: {
                            main_text: name,
                            secondary_text: parts.join(', '),
                        },
                        _lat: String(lat),
                        _lon: String(lon),
                        _distance: dist,
                    };
                }).sort((a: any, b: any) => {
                    const aNearby = (a._distance || 999) < 15;
                    const bNearby = (b._distance || 999) < 15;
                    if (aNearby && !bNearby) return -1;
                    if (!aNearby && bNearby) return 1;
                    return (a._distance || 999) - (b._distance || 999);
                }));
            } catch {
                setPredictions([]);
            } finally {
                setIsSearching(false);
            }
        }, 400);
    }, [lastPosition]);

    // Mapbox Search Box API (better POI search with fuzzy matching)
    const sessionTokenRef = useRef(crypto.randomUUID());

    const searchWithMapbox = useCallback((searchQuery: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (searchQuery.trim().length < 2) {
            setPredictions([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        debounceRef.current = setTimeout(async () => {
            const queryParams: Record<string, string> = {
                q: searchQuery,
                access_token: mapboxToken!,
                session_token: sessionTokenRef.current,
                limit: '5',
                language: 'en',
                types: 'poi,place,address'
            };
            if (lastPosition) {
                queryParams.proximity = `${lastPosition.lng},${lastPosition.lat}`;
            }

            const url = `https://api.mapbox.com/search/searchbox/v1/suggest?` + new URLSearchParams(queryParams);

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    console.warn('[LocationPicker] Mapbox returned', response.status, '→ falling back to Photon');
                    searchWithPhoton(searchQuery);
                    return;
                }

                const data = await response.json();

                setPredictions((data.suggestions || []).map((s: any) => ({
                    place_id: s.mapbox_id,
                    description: s.full_address || s.address || s.place_formatted || s.name,
                    structured_formatting: {
                        main_text: s.name || s.place_formatted || 'Unknown',
                        secondary_text: (s.full_address || s.address || s.place_formatted || '').split(',').map((p: string) => p.trim()).filter((p: string) => p !== s.name).slice(0, 2).join(', '),
                    },
                    _lat: '', // will be fetched on select via /retrieve
                    _lon: '',
                    _mapbox_id: s.mapbox_id,
                    _is_nearby: s.distance !== undefined && s.distance < 15000, // Tag as nearby if within 15km
                    _distance: s.distance ? s.distance / 1000 : undefined, // Mapbox returns meters
                })).sort((a: any, b: any) => {
                    // Prioritize nearby results, then distance
                    if (a._is_nearby && !b._is_nearby) return -1;
                    if (!a._is_nearby && b._is_nearby) return 1;
                    return (a._distance || 999) - (b._distance || 999);
                }));
                setIsSearching(false);
            } catch (err) {
                console.warn('[LocationPicker] Mapbox error → Photon fallback:', err);
                searchWithPhoton(searchQuery);
            }
        }, 300);
    }, [mapboxToken, searchWithPhoton]);

    // Pick the right search function
    const handleSearch = mapboxToken ? searchWithMapbox : searchWithPhoton;

    const handleSelectPlace = async (prediction: PlacePrediction | LocationData) => {
        // Handle direct LocationData (from Recent)
        if ('place_name' in prediction) {
            onChange(prediction as LocationData);
            setIsExpanded(false);
            setQuery('');
            return;
        }

        // Mapbox Search Box results need a /retrieve call to get coordinates
        if (mapboxToken && (prediction as any)._mapbox_id && !prediction._lat) {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/search/searchbox/v1/retrieve/${(prediction as any)._mapbox_id}?` +
                    new URLSearchParams({
                        access_token: mapboxToken,
                        session_token: sessionTokenRef.current,
                    })
                );
                const data = await res.json();
                const feature = data.features?.[0];

                if (feature?.geometry?.coordinates) {
                    onChange({
                        place_name: prediction.structured_formatting.main_text,
                        place_address: prediction.description,
                        place_lat: feature.geometry.coordinates[1],
                        place_lng: feature.geometry.coordinates[0],
                    });
                    // Reset session token after successful retrieve (Mapbox billing)
                    sessionTokenRef.current = crypto.randomUUID();
                    setQuery('');
                    setPredictions([]);
                    setIsExpanded(false);
                    return;
                }
            } catch (err) {
                console.warn('[LocationPicker] Retrieve failed:', err);
            }
        }

        // Direct coords (Photon results or fallback)
        const finalLoc = {
            place_name: (prediction as PlacePrediction).structured_formatting.main_text,
            place_address: (prediction as PlacePrediction).description,
            place_lat: parseFloat((prediction as PlacePrediction)._lat),
            place_lng: parseFloat((prediction as PlacePrediction)._lon),
        };

        onChange(finalLoc);
        
        // Add to recent
        setRecentLocations(prev => {
            const next = [finalLoc, ...prev.filter(l => l.place_name !== finalLoc.place_name)].slice(0, 5);
            localStorage.setItem('novira_recent_locations', JSON.stringify(next));
            return next;
        });

        setQuery('');
        setPredictions([]);
        setIsExpanded(false);
    };

    // Initialize hidden map for GeolocateControl
    useEffect(() => {
        if (isExpanded && mapboxToken && mapContainerRef.current && !mapRef.current) {
            mapboxgl.accessToken = mapboxToken;
            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [0, 0],
                zoom: 1,
                interactive: false,
                attributionControl: false,
            });

            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true
                },
                trackUserLocation: false,
                showUserHeading: false
            });

            map.addControl(geolocate);
            geolocateControlRef.current = geolocate;

            geolocate.on('geolocate', async (e: any) => {
                const { latitude, longitude, accuracy } = e.coords;
                setLastPosition({ lat: latitude, lng: longitude });
                console.log(`[LocationPicker] New fix: ${latitude}, ${longitude} (acc: ${accuracy}m)`);
                
                // ONLY select/close if user explicitly requested current location
                if (isSelectingCurrentRef.current) {
                    try {
                        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}`;
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        const name = data.features?.[0]?.place_name?.split(',')[0] || 'Current Location';
                        const address = data.features?.[0]?.place_name || 'Nearby';

                        onChange({
                            place_name: name,
                            place_address: address,
                            place_lat: latitude,
                            place_lng: longitude,
                        });
                        setIsExpanded(false);
                    } catch (err) {
                        console.warn('Reverse geocoding failed:', err);
                        onChange({
                            place_name: 'Current Location',
                            place_address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                            place_lat: latitude,
                            place_lng: longitude,
                        });
                        setIsExpanded(false);
                    } finally {
                        setIsLocating(false);
                        isSelectingCurrentRef.current = false;
                    }
                }
            });

            // Trigger geolocate ONLY after map is ready for biasing
            map.on('load', () => {
                isSelectingCurrentRef.current = false;
                geolocate.trigger();
            });

            geolocate.on('error', (err: any) => {
                console.error('Mapbox Geolocate error:', err);
                // Fallback to native if mapbox fails
                handleNativeGeolocationFallback();
            });

            mapRef.current = map;
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [isExpanded, mapboxToken]);

    const handleNativeGeolocationFallback = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation not supported');
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            setLastPosition({ lat: latitude, lng: longitude });
            setIsLocating(false);
        }, (err) => {
            console.error('Native geolocation error:', err);
            toast.error('Location unavailable');
            setIsLocating(false);
        }, { enableHighAccuracy: true, timeout: 5000 });
    };

    const handleUseCurrentLocation = async () => {
        setIsLocating(true);
        isSelectingCurrentRef.current = true;
        if (geolocateControlRef.current) {
            geolocateControlRef.current.trigger();
        } else {
            handleNativeGeolocationFallback();
        }
    };

    const handleClear = () => {
        onChange({
            place_name: null,
            place_address: null,
            place_lat: null,
            place_lng: null,
        });
        setQuery('');
        setPredictions([]);
    };

    const handleOpenMaps = () => {
        if (placeLat && placeLng) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${placeLat},${placeLng}`,
                '_blank'
            );
        }
    };

    // Static map thumbnail
    const getStaticMapUrl = (lat: number, lng: number) => {
        if (mapboxToken) {
            // Mapbox dark-themed static map with a pin
            return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+a855f7(${lng},${lat})/${lng},${lat},14,0/400x200@2x?access_token=${mapboxToken}`;
        }
        return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=400x200&markers=${lat},${lng},red-pushpin`;
    };

    // Proactive Nearby Fetch
    useEffect(() => {
        if (isExpanded && lastPosition && query.length === 0) {
            const fetchNearby = async () => {
                setIsSearching(true);
                try {
                    // Use Geocoding v5 for reliable reverse-POI discovery (more stable than searchbox for empty queries)
                    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lastPosition.lng},${lastPosition.lat}.json?` +
                        new URLSearchParams({
                            access_token: mapboxToken!,
                            types: 'poi',
                            limit: '5',
                        });
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        setPredictions((data.features || []).map((f: any) => {
                            const name = f.text || f.place_name?.split(',')[0] || 'Unknown';
                            const address = f.place_name || '';
                            const secondary = address.replace(name, '').trim().replace(/^,/, '').trim();
                            const dist = getDistance(lastPosition.lat, lastPosition.lng, f.geometry.coordinates[1], f.geometry.coordinates[0]);
                            
                            return {
                                place_id: f.id,
                                description: address,
                                structured_formatting: {
                                    main_text: name,
                                    secondary_text: secondary,
                                },
                                _lat: String(f.geometry.coordinates[1]),
                                _lon: String(f.geometry.coordinates[0]),
                                _is_nearby: true,
                                _distance: dist,
                            };
                        }).sort((a: any, b: any) => (a._distance || 0) - (b._distance || 0)));
                    }
                } catch (err) {
                    console.warn('Nearby fetch failed:', err);
                } finally {
                    setIsSearching(false);
                }
            };
            fetchNearby();
        }
    }, [isExpanded, lastPosition, query.length, mapboxToken]);

    // ─── Collapsed: show location card or "Add Location" button ───
    if (!isExpanded) {
        if (hasLocation) {
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Location</label>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                        {/* Map Thumbnail */}
                        {placeLat && placeLng && (
                            <div
                                onClick={handleOpenMaps}
                                className="w-full h-[100px] bg-secondary/20 cursor-pointer relative group overflow-hidden"
                            >
                                <img
                                    src={getStaticMapUrl(placeLat, placeLng)}
                                    alt="Map"
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
                                    <Navigation className="w-2.5 h-2.5" />
                                    Directions
                                </div>
                            </div>
                        )}

                        {/* Place Info */}
                        <div className="p-3 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                                    <MapPin className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-emerald-400 break-words line-clamp-2">{placeName}</p>
                                    {placeAddress && (
                                        <p className="text-[10px] text-muted-foreground break-words line-clamp-2 mt-0.5">{placeAddress}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                                className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-rose-400 transition-colors shrink-0 -mt-1"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/10 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                    <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-primary/80 transition-colors">
                    Add Location
                </span>
            </button>
        );
    }

    return (
        <div className={cn(
            "space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 relative",
            predictions.length > 0 ? "z-[50]" : "z-0"
        )}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Search Location</label>
                <button
                    type="button"
                    onClick={() => {
                        setIsExpanded(false);
                        setQuery('');
                        setPredictions([]);
                    }}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Cancel
                </button>
            </div>

            <div className="relative">
                <Input
                    autoFocus
                    placeholder="Search for a place..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        handleSearch(e.target.value);
                    }}
                    className="h-14 pl-12 pr-4 bg-primary/5 border-primary/20 focus-visible:ring-primary/30 rounded-2xl text-base"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                        <div className="p-1 rounded-lg bg-primary/10">
                            <Search className="w-4 h-4 text-primary" />
                        </div>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="w-full h-14 mt-2 flex items-center gap-4 px-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all group"
            >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <LocateFixed className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-primary">Use Current Location</p>
                    <p className="text-[10px] text-primary/60 font-medium">Detect where you are right now</p>
                </div>
            </button>

            {/* Search Results - Absolute Overlay to prevent CLS */}
            <AnimatePresence>
                {predictions.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute left-0 right-0 top-full mt-2 z-[100] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden ring-1 ring-white/5"
                    >
                        <div className="max-h-[220px] overflow-y-auto no-scrollbar">
                            {predictions.map((prediction) => (
                                <button
                                    key={prediction.place_id}
                                    type="button"
                                    onClick={() => handleSelectPlace(prediction)}
                                    className="w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 text-left"
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5",
                                        (prediction as any)._is_nearby ? "bg-emerald-500/10 border-emerald-500/20" : "bg-primary/10 border-primary/20"
                                    )}>
                                        <MapPin className={cn("w-3.5 h-3.5", (prediction as any)._is_nearby ? "text-emerald-500" : "text-primary")} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold break-words line-clamp-2">
                                            {prediction.structured_formatting.main_text}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground break-words line-clamp-2 mt-0.5 flex items-center justify-between gap-1">
                                            <span className="flex items-center gap-1">
                                                {(prediction as any)._is_nearby && <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-1 rounded-sm">Nearby</span>}
                                                {prediction.structured_formatting.secondary_text}
                                            </span>
                                            {prediction._distance !== undefined && (
                                                <span className="text-[10px] text-primary/60 font-medium shrink-0">
                                                    {prediction._distance < 1 
                                                        ? `${Math.round(prediction._distance * 1000)}m` 
                                                        : `${prediction._distance.toFixed(1)}km`}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {mapboxToken && (
                            <p className="text-[9px] text-muted-foreground/40 text-right pr-2 py-1 bg-white/5">
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
            {/* Hidden Map for GeolocateControl */}
            <div ref={mapContainerRef} className="hidden" aria-hidden="true" />
        </div>
    );
}
