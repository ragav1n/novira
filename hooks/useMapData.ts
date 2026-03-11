import { useMemo } from 'react';
import { CATEGORY_COLORS } from '@/lib/categories';
import { Transaction } from '@/components/expense-map-view';

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
    // 1. Data Transformation: location matching
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
            const key = `${(Math.round(tx.place_lat! * 5000) / 5000).toFixed(4)},${(Math.round(tx.place_lng! * 5000) / 5000).toFixed(4)}`;
            
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

    // 2. Data Transformation: 3D Geometry
    const towerFeatures = useMemo(() => {
        const features: any[] = [];
        locationGroups.forEach(group => {
            const cats = Array.from(group.categories.entries()).sort((a, b) => a[1] - b[1]);
            const totalCategories = cats.length;
            const clusterRadius = totalCategories > 1 ? 20 : 0;
            
            cats.forEach(([category, amountInBase], idx) => {
                let center = [group.lng, group.lat];
                
                const angle = totalCategories > 1 ? (idx / totalCategories) * 2 * Math.PI : 0;
                const offsetX = Math.cos(angle) * clusterRadius;
                const offsetY = Math.sin(angle) * clusterRadius;
                
                center = getGridOffsetCoords(group.lng, group.lat, offsetX, offsetY);

                const radius = 0.00003; 
                const sides = 24; // Optimized from 32 down to 24 for faster polygon generation
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

                const txsInCategory = group.transactions.filter(t => t.category === category).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const count = txsInCategory.length;
                
                const merchantMap = new Map<string, number>();
                txsInCategory.forEach(t => {
                    const tAmountInBase = convertAmount(Number(t.amount), t.currency || 'USD', baseCurrency);
                    merchantMap.set(t.description, (merchantMap.get(t.description) || 0) + tAmountInBase);
                });
                const topMerchant = Array.from(merchantMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
                
                const amountsInBase = txsInCategory.map(t => convertAmount(Number(t.amount), t.currency || 'USD', baseCurrency));
                const sparkline = amountsInBase.slice(-10);
                const txIds = txsInCategory.map(t => t.id).join(',');

                features.push({
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [coordinates] },
                    properties: { 
                        amount: amountInBase, 
                        category: category.toLowerCase(), 
                        topMerchant, 
                        count,
                        sparkline: JSON.stringify(sparkline),
                        txIds
                    }
                });
            });
        });
        return features;
    }, [locationGroups, convertAmount, baseCurrency]);

    // 3. Data Transformation: Lines
    const trailFeatures = useMemo(() => {
        if (filteredTransactions.length < 2) return [];
        
        const userTrails: Record<string, Transaction[]> = {};
        filteredTransactions.forEach(tx => {
            const uid = tx.user_id;
            if (!userTrails[uid]) userTrails[uid] = [];
            userTrails[uid].push(tx);
        });
        
        const userColors = ['#00ffff', '#F472B6', '#F9C74F', '#10B981', '#6366F1', '#A855F7'];
        
        const hexToRgba = (hex: string, alpha: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        return Object.entries(userTrails).map(([uid, txs], index) => {
            const sorted = [...txs].sort((a, b) => a.created_at < b.created_at ? -1 : 1);
            if (sorted.length < 2) return null;
            const color = userColors[index % userColors.length];

            return {
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: sorted.map(tx => [tx.place_lng!, tx.place_lat!]) },
                properties: { 
                    user_id: uid, 
                    color: color, 
                    halo: hexToRgba(color, 0.5) 
                }
            };
        }).filter(Boolean);
    }, [filteredTransactions]);

    // Point Features (for heatmap, distinct from 3D)
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
        trailFeatures,
        pointFeatures
    };
}
