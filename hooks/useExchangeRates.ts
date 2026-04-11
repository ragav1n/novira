import { useState, useEffect } from 'react';

const FRANKFURTER_SUPPORTED = [
    'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
    'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
    'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
];

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useExchangeRates(currency: string): Record<string, number> {
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    useEffect(() => {
        const cacheKey = `novira_rates_${currency}`;
        const API_KEY = process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;

        // Synchronously restore from cache for this currency to avoid using stale
        // rates from a previous currency during the async fetch window.
        let hasFreshCache = false;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { rates, timestamp } = JSON.parse(cached);
                setExchangeRates(rates);
                hasFreshCache = Date.now() - timestamp < CACHE_TTL;
            } else {
                setExchangeRates({}); // No cache for this currency — reset so isRatesLoading becomes true
            }
        } catch (e) {
            console.warn('[useExchangeRates] Cache read failed:', e);
            setExchangeRates({});
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
                setExchangeRates(ratesRes);
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        rates: ratesRes,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn('[useExchangeRates] Cache write failed:', e);
                }
            }
            // If fetch fails, the stale cache was already set above (or {} if no cache)
        };

        fetchRates();
    }, [currency]);

    return exchangeRates;
}
