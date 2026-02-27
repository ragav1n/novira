'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, MapPin, Navigation, Zap, Flame, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, getIconSvgForCategory } from '@/lib/categories';

interface Transaction {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    created_at: string;
    user_id: string;
    place_name?: string;
    place_address?: string;
    place_lat?: number;
    place_lng?: number;
    currency?: string;
    profile?: {
        full_name: string;
        avatar_url?: string;
    };
}

interface ExpenseMapViewProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    formatCurrency: (amount: number, currency?: string) => string;
}

export function ExpenseMapView({ isOpen, onClose, transactions, formatCurrency }: ExpenseMapViewProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [viewMode, setViewMode] = useState<'pins' | 'heatmap'>('pins');
    const [showTrails, setShowTrails] = useState(false);
    const [show3D, setShow3D] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // Filter transactions that have location data
    const geoTransactions = useMemo(
        () => transactions.filter(tx => tx.place_lat && tx.place_lng),
        [transactions]
    );

    // Get unique categories with locations
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        geoTransactions.forEach(tx => cats.add(tx.category));
        return Array.from(cats);
    }, [geoTransactions]);

    // Initialize selected categories on open
    useEffect(() => {
        if (isOpen && availableCategories.length > 0 && selectedCategories.size === 0) {
            setSelectedCategories(new Set(availableCategories));
        }
    }, [isOpen, availableCategories]);

    const filteredTransactions = useMemo(() => {
        return geoTransactions.filter(tx => selectedCategories.has(tx.category));
    }, [geoTransactions, selectedCategories]);

    const toggleCategory = (cat: string) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(cat)) {
            if (newSet.size > 1) { // Don't allow clearing all
                newSet.delete(cat);
            }
        } else {
            newSet.add(cat);
        }
        setSelectedCategories(newSet);
    };

    useEffect(() => {
        if (!isOpen || !mapContainerRef.current || !mapboxToken || geoTransactions.length === 0) return;

        // Small delay to ensure the container is rendered
        const timer = setTimeout(() => {
            if (!mapContainerRef.current) return;

            mapboxgl.accessToken = mapboxToken;

            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [geoTransactions[0].place_lng!, geoTransactions[0].place_lat!],
                zoom: 12,
                attributionControl: false,
            });

            map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

            mapRef.current = map;

            map.on('load', () => {
                setIsInitialLoad(false);
                // Ensure initial pitch is set if 3D is already on (though usually off at start)
                if (show3D) map.setPitch(60);

                // Add sources for Heatmap and Trails
                map.addSource('expenses', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });

                // Add Heatmap Layer
                map.addLayer({
                    id: 'expense-heat',
                    type: 'heatmap',
                    source: 'expenses',
                    maxzoom: 15,
                    paint: {
                        'heatmap-weight': ['interpolate', ['linear'], ['get', 'amount'], 0, 0, 1000, 1],
                        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                        'heatmap-color': [
                            'interpolate', ['linear'], ['heatmap-density'],
                            0, 'rgba(0, 255, 255, 0)',
                            0.2, 'rgba(0, 255, 255, 0.2)',
                            0.4, 'rgba(0, 255, 255, 0.4)',
                            0.6, 'rgba(0, 255, 255, 0.7)',
                            0.8, 'rgba(0, 255, 255, 0.9)',
                            1, 'rgba(0, 255, 255, 1)'
                        ],
                        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 40],
                        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 1, 15, 0]
                    },
                    layout: { visibility: 'none' }
                });

                // Add 3D Source (for towers) - initialized empty
                map.addSource('towers', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });

                // Add Trails Layer (Glowing Line)
                map.addSource('trails', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });

                // Trace background line (blur)
                map.addLayer({
                    id: 'trail-blur',
                    type: 'line',
                    source: 'trails',
                    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
                    paint: {
                        'line-color': '#00ffff',
                        'line-width': 8,
                        'line-blur': 8,
                        'line-opacity': 0.5
                    }
                });

                // Core sharp line
                map.addLayer({
                    id: 'trail-core',
                    type: 'line',
                    source: 'trails',
                    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
                    paint: {
                        'line-color': '#00ffff',
                        'line-width': 2,
                        'line-opacity': 0.8
                    }
                });

                map.addLayer({
                    id: 'expense-3d',
                    type: 'fill-extrusion',
                    source: 'towers',
                    layout: { visibility: 'none' },
                    paint: {
                        'fill-extrusion-color': [
                            'match',
                            ['get', 'category'],
                            'food', CATEGORY_COLORS.food,
                            'groceries', CATEGORY_COLORS.groceries,
                            'fashion', CATEGORY_COLORS.fashion,
                            'transport', CATEGORY_COLORS.transport,
                            'bills', CATEGORY_COLORS.bills,
                            'shopping', CATEGORY_COLORS.shopping,
                            'healthcare', CATEGORY_COLORS.healthcare,
                            'entertainment', CATEGORY_COLORS.entertainment,
                            'rent', CATEGORY_COLORS.rent,
                            'education', CATEGORY_COLORS.education,
                            CATEGORY_COLORS.others
                        ],
                        'fill-extrusion-height': [
                            'interpolate', ['linear'], ['get', 'amount'],
                            0, 0,
                            100, 30,
                            1000, 200,
                            5000, 800,
                            10000, 1500,
                            50000, 3000
                        ],
                        'fill-extrusion-base': 0,
                        'fill-extrusion-opacity': 0.8
                    }
                });

                // Directional arrows
                map.addLayer({
                    id: 'trail-arrows',
                    type: 'symbol',
                    source: 'trails',
                    layout: {
                        'symbol-placement': 'line',
                        'symbol-spacing': 70,
                        'text-field': '▶',
                        'text-size': 12,
                        'text-keep-upright': false,
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                        'visibility': 'none'
                    },
                    paint: {
                        'text-color': '#00ffff',
                        'text-halo-color': 'rgba(0, 255, 255, 0.8)',
                        'text-halo-width': 1
                    }
                });
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
            setSelectedTx(null);
            setIsInitialLoad(true);
        };
    }, [isOpen, mapboxToken]);

    // 1. Source and Marker Management
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isInitialLoad) return;

        // Update Sources
        const features = filteredTransactions.map(tx => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [tx.place_lng!, tx.place_lat!]
            },
            properties: { id: tx.id, amount: tx.amount, category: tx.category }
        }));

        (map.getSource('expenses') as mapboxgl.GeoJSONSource)?.setData({
            type: 'FeatureCollection',
            features
        });

        // 1. Group by Location first
        const locationGroups = new Map<string, {
            lat: number,
            lng: number,
            transactions: Transaction[],
            latestTx: Transaction,
            totalAmount: number,
            categories: Map<string, number>
        }>();

        filteredTransactions.forEach(tx => {
            const key = `${tx.place_lat?.toFixed(4)},${tx.place_lng?.toFixed(4)}`;
            if (!locationGroups.has(key)) {
                locationGroups.set(key, {
                    lat: tx.place_lat!,
                    lng: tx.place_lng!,
                    transactions: [],
                    latestTx: tx,
                    totalAmount: 0,
                    categories: new Map()
                });
            }
            const group = locationGroups.get(key)!;
            group.transactions.push(tx);
            group.totalAmount += tx.amount;
            group.categories.set(tx.category, (group.categories.get(tx.category) || 0) + tx.amount);
            
            if (new Date(tx.date) > new Date(group.latestTx.date)) {
                group.latestTx = tx;
            }
        });

        // Helper for radial offsets (approx meters to degrees)
        const getOffsetCoords = (lng: number, lat: number, distanceMeters: number, bearingDegrees: number) => {
            const radiusEarth = 6378137;
            const dLat = (distanceMeters * Math.cos(bearingDegrees * Math.PI / 180)) / radiusEarth;
            const dLng = (distanceMeters * Math.sin(bearingDegrees * Math.PI / 180)) / (radiusEarth * Math.cos(lat * Math.PI / 180));
            return [lng + (dLng * 180 / Math.PI), lat + (dLat * 180 / Math.PI)];
        };

        // 2. Generate 3D Tower Features with Clusters
        const towerFeatures: any[] = [];
        locationGroups.forEach(group => {
            const cats = Array.from(group.categories.entries());
            const count = cats.length;
            
            cats.forEach(([category, amount], idx) => {
                let center = [group.lng, group.lat];
                
                // If multiple categories, apply offset ring
                if (count > 1) {
                    const angle = (idx * 360) / count;
                    center = getOffsetCoords(group.lng, group.lat, 6, angle); // 6 meter offset ring
                }

                const radius = count > 1 ? 0.0006 : 0.001; // Smaller towers for clusters
                const sides = 8;
                const coordinates = [];
                for (let i = 0; i < sides; i++) {
                    const ang = (i * 360) / sides;
                    const rad = (ang * Math.PI) / 180;
                    coordinates.push([
                        center[0] + (radius / Math.cos(center[1] * Math.PI / 180)) * Math.cos(rad),
                        center[1] + radius * Math.sin(rad)
                    ]);
                }
                coordinates.push(coordinates[0]);

                towerFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [coordinates] },
                    properties: { amount, category: category.toLowerCase() }
                });
            });
        });

        (map.getSource('towers') as mapboxgl.GeoJSONSource)?.setData({
            type: 'FeatureCollection',
            features: towerFeatures
        });

        // Update Trails
        if (filteredTransactions.length > 1) {
            const userTrails: Record<string, Transaction[]> = {};
            filteredTransactions.forEach(tx => {
                const uid = tx.user_id;
                if (!userTrails[uid]) userTrails[uid] = [];
                userTrails[uid].push(tx);
            });
            const userColors = ['#00ffff', '#F472B6', '#F9C74F', '#10B981', '#6366F1', '#A855F7'];
            const trailFeatures = Object.entries(userTrails).map(([uid, txs], index) => {
                const sorted = [...txs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                if (sorted.length < 2) return null;
                return {
                    type: 'Feature' as const,
                    geometry: { type: 'LineString' as const, coordinates: sorted.map(tx => [tx.place_lng!, tx.place_lat!]) },
                    properties: { user_id: uid, color: userColors[index % userColors.length], halo: userColors[index % userColors.length] + '80' }
                };
            }).filter(Boolean);
            (map.getSource('trails') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: trailFeatures as any });
            if (map.getLayer('trail-blur')) map.setPaintProperty('trail-blur', 'line-color', ['get', 'color']);
            if (map.getLayer('trail-core')) map.setPaintProperty('trail-core', 'line-color', ['get', 'color']);
            if (map.getLayer('trail-arrows')) {
                map.setPaintProperty('trail-arrows', 'text-color', ['get', 'color']);
                map.setPaintProperty('trail-arrows', 'text-halo-color', ['get', 'halo']);
            }
        }

        // Update Aggregated HTML Markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        if (viewMode !== 'heatmap') {
            locationGroups.forEach(group => {
                const categoryEntries = Array.from(group.categories.entries());
                const catCount = categoryEntries.length;

                categoryEntries.forEach(([category, totalAmount], idx) => {
                    const txs = group.transactions.filter(t => t.category === category);
                    const latestTx = txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const color = CATEGORY_COLORS[category.toLowerCase() as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others;
                    const iconSvg = getIconSvgForCategory(category);
                    const abbr = latestTx.profile?.full_name ? latestTx.profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
                    const avatarImg = latestTx.profile?.avatar_url;
                    const count = txs.length;

                    // Apply the same offset as the towers
                    let markerPos = [group.lng, group.lat];
                    if (catCount > 1) {
                        const angle = (idx * 360) / catCount;
                        markerPos = getOffsetCoords(group.lng, group.lat, 6, angle);
                    }

                    const el = document.createElement('div');
                    el.className = 'expense-marker-root';

                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = `
                        width: 34px; height: 34px; border-radius: 50%;
                        background: ${color}; border: 3px solid rgba(255,255,255,0.9);
                        box-shadow: 0 4px 15px ${color}80, 0 0 0 2px ${color}40;
                        cursor: pointer; display: flex; align-items: center; justify-content: center;
                        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                        position: relative;
                    `;
                    el.appendChild(wrapper);
                    
                    wrapper.innerHTML = `<span style="color: white;">${iconSvg}</span>`;

                    if (count > 1) {
                        const countBadge = document.createElement('div');
                        countBadge.style.cssText = `
                            position: absolute; top: -6px; right: -6px;
                            background: #f43f5e; color: white; border-radius: 10px;
                            padding: 1px 4px; font-size: 8px; font-weight: 900;
                            border: 1.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        `;
                        countBadge.innerText = count.toString();
                        wrapper.appendChild(countBadge);
                    }

                    const badge = document.createElement('div');
                    badge.style.cssText = `
                        position: absolute; bottom: -4px; right: -4px;
                        width: 14px; height: 14px; border-radius: 50%;
                        background: #1e293b; border: 1.5px solid white;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 6px; font-weight: 900; color: white;
                        overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    `;

                    if (avatarImg) {
                        badge.innerHTML = `<img src="${avatarImg}" style="width: 100%; height: 100%; object-fit: cover;" />`;
                    } else {
                        badge.innerText = abbr;
                    }
                    wrapper.appendChild(badge);

                    wrapper.onclick = (e) => {
                        e.stopPropagation();
                        setSelectedTx(latestTx);
                        map.flyTo({ center: [markerPos[0], markerPos[1]], zoom: 15, duration: 800 });
                    };

                    wrapper.onmouseenter = () => { wrapper.style.transform = 'scale(1.15) translateY(-4px)'; };
                    wrapper.onmouseleave = () => { wrapper.style.transform = 'scale(1) translateY(0px)'; };

                    const marker = new mapboxgl.Marker({ element: el })
                        .setLngLat([markerPos[0], markerPos[1]] as [number, number])
                        .addTo(map);

                    markersRef.current.push(marker);
                });
            });
        }

        // Fit bounds on first load or category change
        if (filteredTransactions.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            filteredTransactions.forEach(tx => bounds.extend([tx.place_lng!, tx.place_lat!]));
            map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1000 });
        }
    }, [filteredTransactions, viewMode, isInitialLoad]);

    // 2. Visibilities and Layer states (Cheap updates)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isInitialLoad) return;

        const isHeatmap = viewMode === 'heatmap';
        
        // Use setPaintProperty/setLayoutProperty to toggle visibility without full re-renders
        if (map.getLayer('expense-heat')) map.setLayoutProperty('expense-heat', 'visibility', isHeatmap ? 'visible' : 'none');
        if (map.getLayer('trail-blur')) map.setLayoutProperty('trail-blur', 'visibility', showTrails ? 'visible' : 'none');
        if (map.getLayer('trail-core')) map.setLayoutProperty('trail-core', 'visibility', showTrails ? 'visible' : 'none');
        if (map.getLayer('trail-arrows')) map.setLayoutProperty('trail-arrows', 'visibility', showTrails ? 'visible' : 'none');
        if (map.getLayer('expense-3d')) map.setLayoutProperty('expense-3d', 'visibility', show3D ? 'visible' : 'none');

        // Handle Map Pitch
        map.easeTo({
            pitch: show3D ? 60 : 0,
            duration: 1000
        });
    }, [viewMode, showTrails, show3D, isInitialLoad]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
            >
                <div className="relative w-full h-full max-w-5xl bg-background rounded-[32px] overflow-hidden shadow-2xl border border-white/10 flex flex-col">

                {/* Header Overlay */}
                    <div className="absolute top-0 left-0 right-0 z-20 flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-background/90 via-background/40 to-transparent pointer-events-none">
                        <div className="w-full sm:w-auto flex items-center justify-between gap-3 pointer-events-auto">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 backdrop-blur-md shrink-0">
                                    <MapPin className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-black tracking-tight truncate">Expense Map</h2>
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                        {geoTransactions.length} location{geoTransactions.length !== 1 ? 's' : ''} tagged
                                    </p>
                                </div>
                            </div>
                            
                            {/* Mobile-only Close */}
                            <button
                                onClick={onClose}
                                className="sm:hidden w-10 h-10 rounded-full bg-card/60 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* View Content Controls */}
                        <div className="flex items-center gap-2 mt-2 sm:mt-0 pointer-events-auto">
                            <div className="flex p-1 rounded-full bg-card/60 backdrop-blur-md border border-white/10 shadow-lg">
                                <button
                                    onClick={() => setViewMode('pins')}
                                    className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                                        viewMode === 'pins' ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                                    )}
                                    title="Show Pins"
                                >
                                    <MousePointer2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('heatmap')}
                                    className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                                        viewMode === 'heatmap' ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                                    )}
                                    title="Show Heatmap"
                                >
                                    <Flame className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShow3D(!show3D)}
                                    className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                                        show3D ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                                    )}
                                    title="Toggle 3D View"
                                >
                                    <div className="relative">
                                        <div className="w-3.5 h-3.5 border-2 border-current rounded-sm transform rotate-45 -translate-y-0.5" />
                                        <div className="absolute inset-0 w-3.5 h-3.5 border-2 border-current rounded-sm transform rotate-45 translate-y-0.5 opacity-50" />
                                    </div>
                                </button>
                            </div>

                            <button
                                onClick={() => setShowTrails(!showTrails)}
                                className={cn(
                                    "w-11 h-11 rounded-full flex items-center justify-center border transition-all shadow-lg backdrop-blur-md",
                                    showTrails 
                                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" 
                                        : "bg-card/60 border-white/10 text-muted-foreground hover:bg-white/5"
                                )}
                                title="Toggle Spending Trails"
                            >
                                <Zap className={cn("w-5 h-5", showTrails && "fill-current animate-pulse")} />
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="hidden sm:flex w-10 h-10 rounded-full bg-card/60 backdrop-blur-md items-center justify-center border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                {/* Map Container */}
                {geoTransactions.length > 0 ? (
                    <div className="relative w-full h-full min-h-[400px]">
                        {!mapboxToken && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4 border border-rose-500/40">
                                    <X className="w-8 h-8 text-rose-500" />
                                </div>
                                <h3 className="text-lg font-black">Map Connection Missing</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                                    Mapbox token not found. Please add `NEXT_PUBLIC_MAPBOX_TOKEN` to your environment variables.
                                </p>
                            </div>
                        )}
                        <div ref={mapContainerRef} className="w-full h-full" />
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                            <MapPin className="w-8 h-8 text-primary/60" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold">No locations yet</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Add a location to your expenses to see them here
                            </p>
                        </div>
                    </div>
                )}

                {/* Category Legend & Toggles */}
                {geoTransactions.length > 0 && (
                    <div className="absolute bottom-20 left-6 right-6 z-20 pointer-events-none">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide pointer-events-auto no-scrollbar">
                            {availableCategories.map(cat => {
                                const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.others;
                                const isActive = selectedCategories.has(cat);
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => toggleCategory(cat)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shrink-0 backdrop-blur-md",
                                            isActive 
                                                ? "bg-white/10 border-white/20 text-white" 
                                                : "bg-black/20 border-white/5 text-muted-foreground opacity-60 grayscale"
                                        )}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                        <span className="text-[11px] font-bold capitalize">{cat}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Selected Transaction Card */}
                <AnimatePresence>
                    {selectedTx && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="absolute bottom-36 left-4 right-4 z-30"
                        >
                            <div className="rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                                <div className="p-4 flex items-start gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
                                        style={{
                                            backgroundColor: `${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS.others}20`,
                                            borderColor: `${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS.others}40`,
                                        }}
                                    >
                                        <MapPin className="w-4.5 h-4.5" style={{ color: CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS.others }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black truncate">{selectedTx.description}</p>
                                                <p className="text-[11px] text-emerald-400 font-bold mt-0.5 truncate">
                                                    📍 {selectedTx.place_name}
                                                </p>
                                                {selectedTx.place_address && (
                                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                        {selectedTx.place_address}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-base font-black shrink-0">
                                                {formatCurrency(selectedTx.amount, selectedTx.currency)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold capitalize"
                                                style={{
                                                    backgroundColor: `${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS.others}15`,
                                                    color: CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS.others,
                                                }}
                                            >
                                                {selectedTx.category}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(selectedTx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    window.open(
                                                        `https://www.google.com/maps/dir/?api=1&destination=${selectedTx.place_lat},${selectedTx.place_lng}`,
                                                        '_blank'
                                                    );
                                                }}
                                                className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
                                            >
                                                <Navigation className="w-2.5 h-2.5" />
                                                Directions
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedTx(null)}
                                        className="p-1 rounded-full hover:bg-white/10 text-muted-foreground shrink-0 -mt-1 -mr-1"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
