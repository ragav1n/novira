import { useState, useEffect } from 'react';

const FRANKFURTER_SUPPORTED = [
    'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
    'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
    'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
];

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export type ExchangeRatesState = {
    rates: Record<string, number>;
    /** Wall-clock ms when the rates currently in memory were last fetched/cached. null until anything loads. */
    lastUpdated: number | null;
};

export function useExchangeRates(currency: string): ExchangeRatesState {
    const [state, setState] = useState<ExchangeRatesState>({ rates: {}, lastUpdated: null });

    useEffect(() => {
        const cacheKey = `novira_rates_${currency}`;
        const API_KEY = process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;

        let hasFreshCache = false;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { rates, timestamp } = JSON.parse(cached);
                setState({ rates, lastUpdated: timestamp });
                hasFreshCache = Date.now() - timestamp < CACHE_TTL;
            } else {
                setState({ rates: {}, lastUpdated: null });
            }
        } catch (e) {
            console.warn('[useExchangeRates] Cache read failed:', e);
            setState({ rates: {}, lastUpdated: null });
        }

        if (hasFreshCache) return;

        const fetchRates = async () => {
            let ratesRes: Record<string, number> | null = null;

            if (FRANKFURTER_SUPPORTED.includes(currency)) {
                try {
                    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}`);
                    if (response.ok) {
                        const data = await response.json();
                        ratesRes = data.rates;
                        if (ratesRes) ratesRes[currency] = 1;
                    }
                } catch (e) {
                    console.warn('[useExchangeRates] Frankfurter fetch failed, trying fallback...');
                }
            }

            if (!ratesRes && API_KEY) {
                try {
                    const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${currency}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.result === 'success') {
                            ratesRes = data.conversion_rates;
                        }
                    }
                } catch (e) {
                    console.warn('[useExchangeRates] ExchangeRate-API fetch failed');
                }
            }

            if (ratesRes) {
                const ts = Date.now();
                setState({ rates: ratesRes, lastUpdated: ts });
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        rates: ratesRes,
                        timestamp: ts
                    }));
                } catch (e) {
                    console.warn('[useExchangeRates] Cache write failed:', e);
                }
            }
        };

        fetchRates();
    }, [currency]);

    return state;
}
