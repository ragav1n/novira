'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Search, Navigation, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

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
}

export function LocationPicker({ placeName, placeAddress, placeLat, placeLng, onChange }: LocationPickerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const hasLocation = !!placeName;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isExpanded]);

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
                const response = await fetch(
                    `https://photon.komoot.io/api/?` +
                    new URLSearchParams({
                        q: searchQuery,
                        limit: '5',
                        lang: 'en',
                    })
                );

                if (!response.ok) throw new Error('Search failed');
                const data = await response.json();

                setPredictions((data.features || []).map((f: any) => {
                    const props = f.properties || {};
                    const coords = f.geometry?.coordinates || [];
                    const name = props.name || props.street || 'Unknown';
                    const parts = [props.city || props.town || props.village, props.state, props.country].filter(Boolean);

                    return {
                        place_id: String(props.osm_id || Math.random()),
                        description: [name, ...parts].join(', '),
                        structured_formatting: {
                            main_text: name,
                            secondary_text: parts.join(', '),
                        },
                        _lat: String(coords[1]),
                        _lon: String(coords[0]),
                    };
                }));
            } catch {
                setPredictions([]);
            } finally {
                setIsSearching(false);
            }
        }, 400);
    }, []);

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
            const url = `https://api.mapbox.com/search/searchbox/v1/suggest?` +
                new URLSearchParams({
                    q: searchQuery,
                    access_token: mapboxToken!,
                    session_token: sessionTokenRef.current,
                    limit: '5',
                    language: 'en',
                    proximity: 'ip', // bias results to user's location
                });

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
                        secondary_text: s.full_address || s.place_formatted || s.address || '',
                    },
                    _lat: '', // will be fetched on select via /retrieve
                    _lon: '',
                    _mapbox_id: s.mapbox_id,
                })));
                setIsSearching(false);
            } catch (err) {
                console.warn('[LocationPicker] Mapbox error → Photon fallback:', err);
                searchWithPhoton(searchQuery);
            }
        }, 300);
    }, [mapboxToken, searchWithPhoton]);

    // Pick the right search function
    const handleSearch = mapboxToken ? searchWithMapbox : searchWithPhoton;

    const handleSelectPlace = async (prediction: PlacePrediction) => {
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
        onChange({
            place_name: prediction.structured_formatting.main_text,
            place_address: prediction.description,
            place_lat: parseFloat(prediction._lat),
            place_lng: parseFloat(prediction._lon),
        });
        setQuery('');
        setPredictions([]);
        setIsExpanded(false);
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

    // ─── Expanded: search input + results ───
    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Search Location</label>
                <button
                    type="button"
                    onClick={() => { setIsExpanded(false); setQuery(''); setPredictions([]); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                    Cancel
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search for a place..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        handleSearch(e.target.value);
                    }}
                    className="pl-10 h-12 bg-secondary/10 border-white/10 rounded-xl"
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                )}
            </div>

            {/* Search Results - In-flow with scroll to prevent overflow */}
            {predictions.length > 0 && (
                <div className="mt-2 rounded-2xl border border-white/10 bg-card/50 overflow-hidden shadow-sm">
                    <div className="max-h-[220px] overflow-y-auto no-scrollbar">
                        {predictions.map((prediction) => (
                            <button
                                key={prediction.place_id}
                                type="button"
                                onClick={() => handleSelectPlace(prediction)}
                                className="w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 text-left"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 mt-0.5">
                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold break-words line-clamp-2">
                                        {prediction.structured_formatting.main_text}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground break-words line-clamp-2 mt-0.5">
                                        {prediction.structured_formatting.secondary_text}
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
                </div>
            )}

            {/* Empty state */}
            {query.length >= 2 && !isSearching && predictions.length === 0 && (
                <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No places found. Try a different search.</p>
                </div>
            )}
        </div>
    );
}
