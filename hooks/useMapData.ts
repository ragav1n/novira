import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Transaction } from '@/components/expense-map-view';

// Controls how finely lat/lng is snapped to group nearby transactions into the same pin.
// Higher = finer grouping (more pins); lower = coarser grouping (fewer, merged pins).
const LOCATION_SNAP_PRECISION = 5000;

// Radius of each tower polygon in degrees (~3m on the ground). Kept small so pins don't overlap.
const TOWER_POLYGON_RADIUS = 0.00003;
// Number of sides for tower polygons.
const TOWER_POLYGON_SIDES = 24;

// Helper for radial offsets (approx meters to degrees)
export function getGridOffsetCoords(lng: number, lat: number, offsetX: number, offsetY: number) {
    const radiusEarth = 6378137;
    const dLat = offsetY / radiusEarth;
    const dLng = offsetX / (radiusEarth * Math.cos(lat * Math.PI / 180));
    return [lng + (dLng * 180 / Math.PI), lat + (dLat * 180 / Math.PI)];
}

export function useMapData(
    filteredTransactions: Transaction[],
    convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number,
    baseCurrency: string
) {
    // Group transactions by snapped location.
    const locationGroups = useMemo(() => {
        const groups = new Map<string, {
            lat: number,
            lng: number,
            transactions: Transaction[],
            latestTx: Transaction,
            totalAmount: number,
            categories: Map<string, number>
        }>();

        filteredTransactions.forEach(tx => {
            const key = `${(Math.round(tx.place_lat! * LOCATION_SNAP_PRECISION) / LOCATION_SNAP_PRECISION).toFixed(4)},${(Math.round(tx.place_lng! * LOCATION_SNAP_PRECISION) / LOCATION_SNAP_PRECISION).toFixed(4)}`;

            // Convert to base currency for aggregation!
            const amountInBase = convertAmount(Number(tx.amount), tx.currency || 'USD', baseCurrency);

            if (!groups.has(key)) {
                groups.set(key, {
                    lat: tx.place_lat!,
                    lng: tx.place_lng!,
                    transactions: [],
                    latestTx: tx,
                    totalAmount: 0,
                    categories: new Map()
                });
            }
            const group = groups.get(key)!;
            group.transactions.push(tx);
            group.totalAmount += amountInBase;
            group.categories.set(tx.category, (group.categories.get(tx.category) || 0) + amountInBase);

            if (tx.date > group.latestTx.date) {
                group.latestTx = tx;
            }
        });
        return groups;
    }, [filteredTransactions, convertAmount, baseCurrency]);

    // 3D spending towers — one extruded polygon per category at each location.
    const towerFeatures = useMemo(() => {
        type TowerProps = { amount: number; category: string; topMerchant: string; count: number; sparkline: string; txIds: string };
        const features: GeoJSON.Feature<GeoJSON.Polygon, TowerProps>[] = [];
        locationGroups.forEach(group => {
            const cats = Array.from(group.categories.entries()).sort((a, b) => a[1] - b[1]);
            const totalCategories = cats.length;
            const clusterRadius = totalCategories > 1 ? 20 : 0;

            cats.forEach(([category, amountInBase], idx) => {
                const angle = totalCategories > 1 ? (idx / totalCategories) * 2 * Math.PI : 0;
                const offsetX = Math.cos(angle) * clusterRadius;
                const offsetY = Math.sin(angle) * clusterRadius;
                const center = getGridOffsetCoords(group.lng, group.lat, offsetX, offsetY);

                const coordinates = [];
                for (let i = 0; i < TOWER_POLYGON_SIDES; i++) {
                    const rad = ((i * 360) / TOWER_POLYGON_SIDES) * Math.PI / 180;
                    coordinates.push([
                        center[0] + (TOWER_POLYGON_RADIUS / Math.cos(center[1] * Math.PI / 180)) * Math.cos(rad),
                        center[1] + TOWER_POLYGON_RADIUS * Math.sin(rad)
                    ]);
                }
                coordinates.push(coordinates[0]);

                const txsInCategory = group.transactions
                    .filter(t => t.category === category)
                    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

                const merchantMap = new Map<string, number>();
                txsInCategory.forEach(t => {
                    const tAmountInBase = convertAmount(Number(t.amount), t.currency || 'USD', baseCurrency);
                    merchantMap.set(t.description, (merchantMap.get(t.description) || 0) + tAmountInBase);
                });
                const topMerchant = Array.from(merchantMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
                const sparkline = txsInCategory.map(t => convertAmount(Number(t.amount), t.currency || 'USD', baseCurrency)).slice(-10);

                features.push({
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [coordinates] },
                    properties: {
                        amount: amountInBase,
                        category: category.toLowerCase(),
                        topMerchant,
                        count: txsInCategory.length,
                        sparkline: JSON.stringify(sparkline),
                        txIds: txsInCategory.map(t => t.id).join(','),
                    }
                });
            });
        });
        return features;
    }, [locationGroups, convertAmount, baseCurrency]);

    // Top places ranked by spend (for the summary panel + headline stats)
    const topPlaces = useMemo(() => {
        return Array.from(locationGroups.values())
            .map(g => ({
                lat: g.lat,
                lng: g.lng,
                placeName: g.latestTx.place_name || g.latestTx.place_address || 'Unknown place',
                total: g.totalAmount,
                count: g.transactions.length,
                topCategory: Array.from(g.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'others',
            }))
            .sort((a, b) => b.total - a.total);
    }, [locationGroups]);

    // Per-transaction point features (used for the heatmap).
    const pointFeatures = useMemo(() => {
        return filteredTransactions.map(tx => {
            const amountInBase = convertAmount(Number(tx.amount), tx.currency || 'USD', baseCurrency);
            return {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [tx.place_lng!, tx.place_lat!] },
                properties: { id: tx.id, amount: amountInBase, category: tx.category }
            };
        });
    }, [filteredTransactions, convertAmount, baseCurrency]);

    return {
        locationGroups,
        towerFeatures,
        pointFeatures,
        topPlaces
    };
}

export type TopPlace = {
    lat: number;
    lng: number;
    placeName: string;
    total: number;
    count: number;
    topCategory: string;
};
