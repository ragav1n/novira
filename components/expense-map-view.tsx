'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, MapPin, Navigation } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { parseISO, startOfMonth, subMonths, startOfYear } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, getIconSvgForCategory, getCategoryLabel } from '@/lib/categories';
import { createPortal } from 'react-dom';
import { useMapData } from '@/hooks/useMapData';
import { MapHeader } from './map-header';
import { MapControls, type LightPreset } from './map-controls';
import { MapSummaryPanel } from './map-summary-panel';

export type MapTimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const TIME_RANGES: { key: MapTimeRange; label: string }[] = [
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: '6M', label: '6M' },
    { key: '1Y', label: '1Y' },
    { key: 'ALL', label: 'All' },
];

// Earliest date (inclusive) a transaction may have to fall within the selected range.
// Returns null for 'ALL' (no lower bound).
function timeRangeStart(range: MapTimeRange, now: Date): Date | null {
    switch (range) {
        case '1M': return startOfMonth(now);
        case '3M': return startOfMonth(subMonths(now, 2));
        case '6M': return startOfMonth(subMonths(now, 5));
        case '1Y': return startOfYear(now);
        case 'ALL': return null;
    }
}

function parseSparkline(raw: unknown): number[] {
    if (!raw || typeof raw !== 'string') return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
    } catch {
        return [];
    }
}

// Category → fill color as a Mapbox `match` expression, built from the shared palette.
const categoryColorExpression: mapboxgl.ExpressionSpecification = [
    'match',
    ['get', 'category'],
    ...Object.entries(CATEGORY_COLORS).flatMap(([key, color]) => [key, color] as [string, string]),
    CATEGORY_COLORS.others,
] as unknown as mapboxgl.ExpressionSpecification;

export interface Transaction {
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

export interface ExpenseMapViewProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    formatCurrency: (amount: number, currency?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number;
    currency: string;
    /** True while the full geo-tagged history is still being fetched. */
    isLoading?: boolean;
    /** True when the history fetch hit its row cap and is showing a recent subset. */
    truncated?: boolean;
}

export function ExpenseMapView({ isOpen, onClose, transactions, formatCurrency, convertAmount, currency, isLoading = false, truncated = false }: ExpenseMapViewProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const styleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const reduceMotion = useReducedMotion();
    // Map animation durations collapse to 0 when the user prefers reduced motion.
    const camDuration = (ms: number) => (reduceMotion ? 0 : ms);
    const springTransition = reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 25, stiffness: 300 };
    const [mapError, setMapError] = useState(false);
    const [retryNonce, setRetryNonce] = useState(0);
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
    const [drillDownTxIds, setDrillDownTxIds] = useState<string[] | null>(null);
    const [viewMode, setViewMode] = useState<'pins' | 'heatmap'>('pins');
    const [show3D, setShow3D] = useState(true);
    const [lightPreset, setLightPreset] = useState<LightPreset>('dawn');
    const [timeRange, setTimeRange] = useState<MapTimeRange>('ALL');
    const [showSummary, setShowSummary] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [mounted, setMounted] = useState(false);
    const hide3DTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [hoveredTower, setHoveredTower] = useState<{
        x: number;
        y: number;
        category: string;
        amount: number;
        topMerchant: string;
        count: number;
        sparkline: number[];
    } | null>(null);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock body scroll when map is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    // Close on Escape and move focus into the dialog for keyboard / screen-reader users.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const focusTimer = setTimeout(() => dialogRef.current?.focus(), 80);
        return () => { window.removeEventListener('keydown', onKey); clearTimeout(focusTimer); };
    }, [isOpen, onClose]);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // Filter transactions that have location data
    const geoTransactions = useMemo(
        () => transactions.filter(tx => tx.place_lat != null && tx.place_lng != null),
        [transactions]
    );
    const hasGeo = geoTransactions.length > 0;

    // Apply the selected time window. 'ALL' keeps everything.
    const timeFilteredTransactions = useMemo(() => {
        const start = timeRangeStart(timeRange, new Date());
        if (!start) return geoTransactions;
        const startMs = start.getTime();
        return geoTransactions.filter(tx => parseISO(tx.date.slice(0, 10)).getTime() >= startMs);
    }, [geoTransactions, timeRange]);

    // Get unique categories with locations (within the current time window)
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        timeFilteredTransactions.forEach(tx => cats.add(tx.category));
        return Array.from(cats);
    }, [timeFilteredTransactions]);

    // Stable signature of the category set so the re-seed below only fires when the
    // actual categories change — not when `transactions` merely gets a new reference.
    const categoriesKey = useMemo(() => [...availableCategories].sort().join('|'), [availableCategories]);

    // Re-seed the selection to "all" when the set of categories changes (first data
    // load / time-range switch) so newly-revealed categories stay visible — while an
    // incidental new transactions-array reference no longer wipes the user's toggles.
    useEffect(() => {
        setSelectedCategories(new Set(categoriesKey ? categoriesKey.split('|') : []));
    }, [categoriesKey]);

    const filteredTransactions = useMemo(() => {
        return timeFilteredTransactions.filter(tx => selectedCategories.has(tx.category));
    }, [timeFilteredTransactions, selectedCategories]);

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

    const { locationGroups, towerFeatures, pointFeatures, topPlaces } = useMapData(filteredTransactions, convertAmount, currency);

    // One GeoJSON point per snapped location, carrying the data each pin needs. Native
    // clustering merges nearby locations; clicking a pin opens its transaction(s).
    const locationFeatures = useMemo(() => {
        const feats: GeoJSON.Feature<GeoJSON.Point>[] = [];
        locationGroups.forEach(group => {
            const topCategory = Array.from(group.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'others';
            feats.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [group.lng, group.lat] },
                properties: {
                    amount: group.totalAmount,
                    category: topCategory.toLowerCase(),
                    count: group.transactions.length,
                    txIds: group.transactions.map(t => t.id).join(','),
                    placeName: group.latestTx.place_name || group.latestTx.place_address || 'Location',
                },
            });
        });
        return feats;
    }, [locationGroups]);

    // Headline stats for the current time + category filter
    const summary = useMemo(() => {
        let total = 0;
        locationGroups.forEach(g => { total += g.totalAmount; });
        return { total, places: locationGroups.size, topPlace: topPlaces[0] ?? null };
    }, [locationGroups, topPlaces]);

    const selectedTx = useMemo(
        () => (selectedTxId ? transactions.find(t => t.id === selectedTxId) ?? null : null),
        [selectedTxId, transactions]
    );

    const drillDownTxs = useMemo(() => {
        if (!drillDownTxIds) return null;
        return transactions.filter(t => drillDownTxIds.includes(t.id));
    }, [drillDownTxIds, transactions]);

    const flyToPlace = (lng: number, lat: number) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: camDuration(900) });
    };

    // --- Map initialization ---
    useEffect(() => {
        if (!isOpen || !mapboxToken || !hasGeo) return;

        // Small delay so the animating modal has settled to its real size before the
        // canvas captures dimensions (a 0-height container paints gray with no error).
        const timer = setTimeout(() => {
            const container = mapContainerRef.current;
            if (!container) return;

            mapboxgl.accessToken = mapboxToken;

            const bounds = new mapboxgl.LngLatBounds();
            geoTransactions.forEach(tx => bounds.extend([tx.place_lng!, tx.place_lat!]));

            const map = new mapboxgl.Map({
                container,
                // Mapbox Standard — gives the light presets (dawn/day/dusk/night) and the
                // built-in 3D buildings the towers sit among.
                style: 'mapbox://styles/mapbox/standard',
                center: [geoTransactions[0].place_lng!, geoTransactions[0].place_lat!],
                zoom: 12,
                pitch: 45,
                attributionControl: false,
            });
            mapRef.current = map;

            // Surface a clear fallback instead of a silent gray canvas if the style/tiles
            // fail to load (e.g. token without Standard-style access, network error).
            map.on('error', (e: mapboxgl.ErrorEvent) => {
                if (process.env.NODE_ENV === 'development') console.error('Mapbox error:', e?.error);
            });
            styleTimerRef.current = setTimeout(() => {
                if (mapRef.current && !mapRef.current.isStyleLoaded()) setMapError(true);
            }, 8000);

            // Snap camera to encompass the data without an animation.
            map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });

            map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
            // Mapbox requires visible attribution — compact keeps it to an unobtrusive "i".
            map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true,
                fitBoundsOptions: { maxZoom: 15 },
            });
            map.addControl(geolocate, 'bottom-right');

            // The container may still be resolving its final size inside the modal — re-sync
            // the canvas whenever it changes so the map never stays stuck at a stale size.
            const ro = new ResizeObserver(() => map.resize());
            ro.observe(container);
            resizeObserverRef.current = ro;

            map.on('load', () => {
                if (styleTimerRef.current) { clearTimeout(styleTimerRef.current); styleTimerRef.current = null; }
                setMapError(false);
                map.resize();

                // Open centered on the user's current location (falls back to the data-fit
                // view above if permission is denied or geolocation is unavailable).
                geolocate.trigger();

                // Standard-style atmosphere/lighting (dawn by default, user-switchable).
                map.setConfigProperty('basemap', 'lightPreset', lightPreset);
                map.setConfigProperty('basemap', 'showPointOfInterestLabels', true);

                // Clustered source for pins, plus a plain source for the heatmap.
                map.addSource('locations', {
                    type: 'geojson',
                    cluster: true,
                    clusterMaxZoom: 14,
                    clusterRadius: 50,
                    data: { type: 'FeatureCollection', features: [] },
                });
                map.addSource('heat', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                });

                map.addLayer({
                    id: 'heat-layer',
                    type: 'heatmap',
                    source: 'heat',
                    maxzoom: 24,
                    layout: { visibility: 'none' },
                    paint: {
                        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                        'heatmap-color': [
                            'interpolate', ['linear'], ['heatmap-density'],
                            0, 'rgba(0, 0, 0, 0)',
                            0.1, 'rgba(80, 0, 180, 0.2)',
                            0.3, 'rgba(180, 0, 180, 0.5)',
                            0.5, 'rgba(255, 40, 100, 0.75)',
                            0.7, 'rgba(255, 120, 20, 0.9)',
                            0.9, 'rgba(255, 220, 0, 1)',
                            1, 'rgba(255, 255, 200, 1)',
                        ],
                        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 40, 20, 100],
                        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 22, 0.6],
                    },
                });

                map.addLayer({
                    id: 'clusters',
                    type: 'circle',
                    source: 'locations',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': 'rgba(168, 85, 247, 0.55)',
                        'circle-stroke-color': 'rgba(255, 255, 255, 0.75)',
                        'circle-stroke-width': 2,
                        'circle-blur': 0.15,
                        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
                    },
                });
                map.addLayer({
                    id: 'cluster-count',
                    type: 'symbol',
                    source: 'locations',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': ['get', 'point_count_abbreviated'],
                        'text-size': 12,
                        'text-allow-overlap': true,
                    },
                    paint: { 'text-color': '#ffffff' },
                });
                map.addLayer({
                    id: 'unclustered-point',
                    type: 'circle',
                    source: 'locations',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-color': categoryColorExpression,
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2,
                        // Larger, zoom-responsive radius = an easier tap target on touch.
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 10, 16, 14],
                    },
                });

                // Click a cluster → zoom in to expand it.
                map.on('click', 'clusters', (e: mapboxgl.MapLayerMouseEvent) => {
                    const feature = e.features?.[0];
                    if (!feature) return;
                    const clusterId = feature.properties?.cluster_id;
                    const source = map.getSource('locations') as mapboxgl.GeoJSONSource;
                    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                        if (err || zoom == null) return;
                        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5, duration: camDuration(700) });
                    });
                });

                // Click a location pin → open its single transaction or the drill-down list.
                map.on('click', 'unclustered-point', (e: mapboxgl.MapLayerMouseEvent) => {
                    const feature = e.features?.[0];
                    if (!feature) return;
                    const props = feature.properties || {};
                    const ids = String(props.txIds || '').split(',').filter(Boolean);
                    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
                    map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 15), duration: camDuration(800) });
                    if (ids.length > 1) setDrillDownTxIds(ids);
                    else if (ids.length === 1) setSelectedTxId(ids[0]);
                });

                // 3D spending towers — extruded bars whose height scales with spend.
                map.addSource('towers', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                });
                map.addLayer({
                    id: 'expense-3d',
                    type: 'fill-extrusion',
                    source: 'towers',
                    slot: 'top',
                    layout: { visibility: 'none' },
                    paint: {
                        'fill-extrusion-color': categoryColorExpression,
                        'fill-extrusion-height': 0,
                        'fill-extrusion-height-transition': { duration: reduceMotion ? 0 : 1000 },
                        'fill-extrusion-base': 0,
                        'fill-extrusion-opacity': 0.85,
                        'fill-extrusion-vertical-gradient': true,
                    },
                });

                map.on('mousemove', 'expense-3d', (e: mapboxgl.MapLayerMouseEvent) => {
                    if (map.getLayoutProperty('expense-3d', 'visibility') === 'none') return;
                    const props = e.features?.[0]?.properties;
                    if (!props) return;
                    map.getCanvas().style.cursor = 'pointer';
                    setHoveredTower({
                        x: e.point.x,
                        y: e.point.y,
                        category: props.category,
                        amount: props.amount,
                        topMerchant: props.topMerchant || 'Multiple',
                        count: props.count || 1,
                        sparkline: parseSparkline(props.sparkline),
                    });
                });
                map.on('mouseleave', 'expense-3d', () => {
                    map.getCanvas().style.cursor = '';
                    setHoveredTower(null);
                });
                map.on('click', 'expense-3d', (e: mapboxgl.MapLayerMouseEvent) => {
                    const props = e.features?.[0]?.properties;
                    if (!props?.txIds) return;
                    const ids = String(props.txIds).split(',').filter(Boolean);
                    // Surface the rich insight on tap too (touch devices have no hover).
                    if (ids.length > 1) {
                        setHoveredTower({
                            x: e.point.x,
                            y: e.point.y,
                            category: props.category,
                            amount: props.amount,
                            topMerchant: props.topMerchant || 'Multiple',
                            count: props.count || 1,
                            sparkline: parseSparkline(props.sparkline),
                        });
                        setDrillDownTxIds(ids);
                    } else if (ids.length === 1) {
                        setSelectedTxId(ids[0]);
                    }
                });

                // Clear any lingering insight bubble once the user pans/zooms.
                map.on('movestart', () => setHoveredTower(null));

                const setCursor = (cursor: string) => () => { map.getCanvas().style.cursor = cursor; };
                map.on('mouseenter', 'clusters', setCursor('pointer'));
                map.on('mouseleave', 'clusters', setCursor(''));
                map.on('mouseenter', 'unclustered-point', setCursor('pointer'));
                map.on('mouseleave', 'unclustered-point', setCursor(''));

                setIsInitialLoad(false);
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            if (hide3DTimerRef.current) clearTimeout(hide3DTimerRef.current);
            if (styleTimerRef.current) { clearTimeout(styleTimerRef.current); styleTimerRef.current = null; }
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            mapRef.current?.remove();
            mapRef.current = null;
            setSelectedTxId(null);
            setDrillDownTxIds(null);
            setHoveredTower(null);
            setIsInitialLoad(true);
        };
    }, [isOpen, mapboxToken, hasGeo, retryNonce]); // eslint-disable-line react-hooks/exhaustive-deps

    // Push data into the sources whenever the filtered set changes.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isInitialLoad) return;

        (map.getSource('locations') as mapboxgl.GeoJSONSource | undefined)?.setData({
            type: 'FeatureCollection',
            features: locationFeatures,
        });
        (map.getSource('heat') as mapboxgl.GeoJSONSource | undefined)?.setData({
            type: 'FeatureCollection',
            features: pointFeatures as GeoJSON.Feature[],
        });
        (map.getSource('towers') as mapboxgl.GeoJSONSource | undefined)?.setData({
            type: 'FeatureCollection',
            features: towerFeatures,
        });

        // Scale heatmap weight to the actual data range so it's currency-agnostic.
        if (pointFeatures.length > 0 && map.getLayer('heat-layer')) {
            const maxAmount = Math.max(...pointFeatures.map(f => f.properties.amount), 1);
            map.setPaintProperty('heat-layer', 'heatmap-weight', [
                'interpolate', ['linear'], ['get', 'amount'],
                0, 0,
                maxAmount * 0.1, 0.2,
                maxAmount * 0.5, 0.6,
                maxAmount, 1,
            ]);
        }
    }, [locationFeatures, pointFeatures, towerFeatures, isInitialLoad]);

    // Toggle pins vs heatmap visibility.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isInitialLoad) return;
        const isHeatmap = viewMode === 'heatmap';
        const pinVis = isHeatmap ? 'none' : 'visible';
        ['clusters', 'cluster-count', 'unclustered-point'].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', pinVis);
        });
        if (map.getLayer('heat-layer')) map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none');
    }, [viewMode, isInitialLoad]);

    // 3D towers + camera pitch.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isInitialLoad) return;

        const showTowers = show3D && viewMode !== 'heatmap';
        if (hide3DTimerRef.current) clearTimeout(hide3DTimerRef.current);
        if (map.getLayer('expense-3d')) {
            if (showTowers) {
                map.setLayoutProperty('expense-3d', 'visibility', 'visible');
                map.setPaintProperty('expense-3d', 'fill-extrusion-height', [
                    'interpolate', ['linear'], ['get', 'amount'],
                    0, 0,
                    100, 30,
                    1000, 200,
                    5000, 800,
                    10000, 1500,
                    50000, 3000,
                ]);
            } else {
                // Let the height transition collapse, then hide the layer.
                map.setPaintProperty('expense-3d', 'fill-extrusion-height', 0);
                hide3DTimerRef.current = setTimeout(() => {
                    if (mapRef.current?.getLayer('expense-3d')) {
                        mapRef.current.setLayoutProperty('expense-3d', 'visibility', 'none');
                    }
                }, 1000);
            }
        }

        map.easeTo({ pitch: show3D ? 45 : 0, duration: camDuration(1000) });
    }, [show3D, viewMode, isInitialLoad]); // eslint-disable-line react-hooks/exhaustive-deps

    // Light preset (dawn / day / dusk / night) — Standard-style config swap.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isInitialLoad) return;
        map.setConfigProperty('basemap', 'lightPreset', lightPreset);
    }, [lightPreset, isInitialLoad]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-4 sm:p-6 sm:pb-4 bg-black/40 overscroll-contain touch-none"
                >
                    {/* Blurred scrim as a SIBLING (not an ancestor) of the map. A backdrop-filter on
                        an ancestor of the WebGL canvas renders the Mapbox map black in Chrome. */}
                    <div className="absolute inset-0 backdrop-blur-sm pointer-events-none" aria-hidden="true" />
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Expense map"
                        tabIndex={-1}
                        className="relative w-full h-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] max-w-5xl bg-background rounded-[32px] overflow-hidden shadow-2xl border border-white/10 flex flex-col outline-none"
                    >

                        <MapHeader
                            summary={{
                                total: formatCurrency(summary.total),
                                places: summary.places,
                                topPlace: summary.topPlace?.placeName ?? null,
                            }}
                            onClose={onClose}
                        >
                            <MapControls
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                show3D={show3D}
                                setShow3D={setShow3D}
                                lightPreset={lightPreset}
                                setLightPreset={setLightPreset}
                                summaryActive={showSummary}
                                onToggleSummary={() => setShowSummary(v => !v)}
                            />
                        </MapHeader>

                        {/* Loading / truncation notice */}
                        {(isLoading || truncated) && geoTransactions.length > 0 && (
                            <div className="absolute top-[5.5rem] sm:top-[4.75rem] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-md border border-white/10 shadow-lg text-[11px] font-medium text-muted-foreground">
                                    {isLoading ? (
                                        <>
                                            <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                            Loading all locations…
                                        </>
                                    ) : (
                                        <>Showing most recent 5,000 located expenses</>
                                    )}
                                </div>
                            </div>
                        )}

                {/* Map Container */}
                {geoTransactions.length > 0 ? (
                    <div className="relative w-full flex-1 min-h-0">
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
                        {mapboxToken && mapError && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 border border-amber-500/40">
                                    <MapPin className="w-8 h-8 text-amber-400" />
                                </div>
                                <h3 className="text-lg font-black">Map couldn&apos;t load</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                                    The map tiles didn&apos;t load. Check your connection and try again.
                                </p>
                                <button
                                    onClick={() => { setMapError(false); setRetryNonce(n => n + 1); }}
                                    className="mt-4 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold min-h-[44px] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    Try again
                                </button>
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

                {/* Time range + Category Legend (hidden while a detail panel is open or on error) */}
                {geoTransactions.length > 0 && !mapError && !selectedTx && !drillDownTxs && !showSummary && (
                    <div className="absolute bottom-20 left-6 right-6 z-20 pointer-events-none flex flex-col gap-2">
                        {/* Time range filter */}
                        <div className="flex items-center gap-1 p-1 rounded-full bg-card/60 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto w-fit">
                            {TIME_RANGES.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setTimeRange(key)}
                                    className={cn(
                                        "px-3.5 min-h-[40px] rounded-full text-[12px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        timeRange === key ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                                    )}
                                    aria-pressed={timeRange === key}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {/* Category Legend */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide pointer-events-auto no-scrollbar">
                            {availableCategories.map(cat => {
                                const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.others;
                                const isActive = selectedCategories.has(cat);
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => toggleCategory(cat)}
                                        aria-pressed={isActive}
                                        className={cn(
                                            "flex items-center gap-2 px-3.5 min-h-[40px] rounded-full border transition-all shrink-0 backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                            isActive
                                                ? "bg-white/10 border-white/20 text-white"
                                                : "bg-black/20 border-white/5 text-muted-foreground opacity-60 grayscale"
                                        )}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                        <span className="text-[12px] font-bold capitalize">{getCategoryLabel(cat)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Heatmap intensity legend */}
                        {viewMode === 'heatmap' && (
                            <div
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto w-fit text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                                role="img"
                                aria-label="Heatmap colour shows spending density, from low (purple) to high (yellow)"
                            >
                                <span>Less</span>
                                <span
                                    className="h-2 w-20 rounded-full"
                                    style={{ background: 'linear-gradient(90deg, rgba(80,0,180,0.6), rgba(180,0,180,0.8), rgba(255,40,100,0.9), rgba(255,120,20,1), rgba(255,220,0,1))' }}
                                    aria-hidden="true"
                                />
                                <span>More</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Top places summary panel */}
                <MapSummaryPanel
                    open={showSummary}
                    onClose={() => setShowSummary(false)}
                    topPlaces={topPlaces}
                    totalLabel={formatCurrency(summary.total)}
                    formatCurrency={formatCurrency}
                    onSelectPlace={(place) => { flyToPlace(place.lng, place.lat); setShowSummary(false); }}
                />

                {/* Selected Transaction Card */}
                <AnimatePresence>
                    {selectedTx && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            transition={springTransition}
                            className="absolute bottom-36 left-4 right-4 z-30"
                        >
                            <div className="rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                                <div className="p-4 flex items-start gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
                                        style={{
                                            backgroundColor: `${CATEGORY_COLORS[selectedTx.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others}20`,
                                            borderColor: `${CATEGORY_COLORS[selectedTx.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others}40`,
                                        }}
                                    >
                                        <MapPin className="w-4.5 h-4.5" style={{ color: CATEGORY_COLORS[selectedTx.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black truncate">{selectedTx.description}</p>
                                                <p className="text-[11px] text-emerald-400 font-bold mt-0.5 truncate">
                                                    📍 {selectedTx.place_name}
                                                </p>
                                                {selectedTx.place_address && (
                                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                        {selectedTx.place_address}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-base font-black shrink-0">
                                                {formatCurrency(selectedTx.amount, selectedTx.currency || 'USD')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold capitalize"
                                                style={{
                                                    backgroundColor: `${CATEGORY_COLORS[selectedTx.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others}15`,
                                                    color: CATEGORY_COLORS[selectedTx.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others,
                                                }}
                                            >
                                                {getCategoryLabel(selectedTx.category)}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                                {parseISO(selectedTx.date.slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    window.open(
                                                        `https://www.google.com/maps/dir/?api=1&destination=${selectedTx.place_lat},${selectedTx.place_lng}`,
                                                        '_blank'
                                                    );
                                                }}
                                                className="ml-auto flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-full hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                aria-label="Get directions to this place"
                                            >
                                                <Navigation className="w-2.5 h-2.5" />
                                                Directions
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedTxId(null); setHoveredTower(null); }}
                                        className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground shrink-0 -mt-1 -mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        aria-label="Close transaction details"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Drill-down list for a location with multiple transactions */}
                <AnimatePresence>
                    {drillDownTxs && drillDownTxs.length > 0 && (
                        <motion.div
                            initial={{ y: 200, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 200, opacity: 0 }}
                            transition={springTransition}
                            className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-auto sm:right-8 sm:w-[350px] z-40 max-h-[60vh] overflow-hidden flex flex-col rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-card/80 sticky top-0">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border"
                                        style={{
                                            backgroundColor: `${CATEGORY_COLORS[drillDownTxs[0].category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others}40`,
                                            borderColor: `${CATEGORY_COLORS[drillDownTxs[0].category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others}60`,
                                        }}
                                    >
                                        <span
                                            className="scale-[0.7] text-white"
                                            dangerouslySetInnerHTML={{ __html: getIconSvgForCategory(drillDownTxs[0].category) }}
                                        />
                                    </div>
                                    <div>
                                        <span className="capitalize">{getCategoryLabel(drillDownTxs[0].category)}</span>
                                        <p className="text-[11px] text-muted-foreground">{drillDownTxs.length} Transactions</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setDrillDownTxIds(null); setHoveredTower(null); }}
                                    className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    aria-label="Close transaction list"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="overflow-y-auto p-2 no-scrollbar">
                                {drillDownTxs.map(tx => (
                                    <button type="button" key={tx.id} className="w-full text-left p-3 mb-1 flex items-center justify-between rounded-xl hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => { setDrillDownTxIds(null); setHoveredTower(null); setSelectedTxId(tx.id); }}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate max-w-[150px]">{tx.description}</p>
                                                <p className="text-[11px] text-emerald-400 truncate">{tx.place_name || 'Location'}</p>
                                                <p className="text-[11px] text-muted-foreground">{new Date(tx.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                            </div>
                                        </div>
                                        <span className="font-black text-sm shrink-0 pl-2">{formatCurrency(tx.amount, tx.currency)}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Glassmorphic hover insight bubble for 3D towers */}
                <AnimatePresence>
                    {hoveredTower && !selectedTx && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ duration: reduceMotion ? 0 : 0.18 }}
                            className="absolute z-[110] pointer-events-none"
                            style={{
                                left: hoveredTower.x < 120 ? 120 : (typeof window !== 'undefined' && hoveredTower.x > window.innerWidth - 120 ? window.innerWidth - 120 : hoveredTower.x),
                                top: hoveredTower.y - 120,
                                transform: 'translateX(-50%)'
                            }}
                        >
                            <div className="bg-card/40 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl min-w-[200px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/20"
                                        style={{ backgroundColor: `${CATEGORY_COLORS[hoveredTower.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others}40` }}
                                    >
                                        <span
                                            className="scale-75 text-white"
                                            dangerouslySetInnerHTML={{ __html: getIconSvgForCategory(hoveredTower.category) }}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                                            {getCategoryLabel(hoveredTower.category)}
                                        </p>
                                        <p className="text-sm font-black text-white">
                                            {formatCurrency(hoveredTower.amount)}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-muted-foreground font-medium">Top Merchant</span>
                                        <span className="text-white font-black truncate max-w-[100px] text-right">{hoveredTower.topMerchant}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-muted-foreground font-medium">Transactions</span>
                                        <span className="text-white font-black">{hoveredTower.count}</span>
                                    </div>
                                    {hoveredTower.sparkline.length > 0 && (
                                        <div className="h-6 w-full flex items-end gap-0.5 mt-2 bg-white/5 rounded px-1.5 py-1">
                                            {hoveredTower.sparkline.map((val, i) => {
                                                const max = Math.max(...hoveredTower.sparkline);
                                                const min = Math.min(...hoveredTower.sparkline, 0);
                                                const range = max - min || 1;
                                                const h = Math.max(10, ((val - min) / range) * 100);
                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex-1 bg-primary/40 rounded-t-[1px]"
                                                        style={{ height: `${h}%`, opacity: 0.4 + ((i / hoveredTower.sparkline.length) * 0.6) }}
                                                        title={formatCurrency(val)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card/40 backdrop-blur-xl border-r border-b border-white/20 rotate-45" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                </div>
            </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
