import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Flat config. `next lint` was removed in Next 16, so `npm run lint` calls eslint
// directly. `eslint-config-next/core-web-vitals` bundles the Next, TypeScript and
// react-hooks rule sets, plus ignores for .next/, out/, build/ and next-env.d.ts.
const config = [
    {
        ignores: [
            // Capacitor native shells — generated, and full of vendored build output.
            'android/**',
            'ios/**',
            // Hand-written service worker; worker scope these rules don't model.
            'public/sw.js',
            'scripts/**',
        ],
    },

    ...nextCoreWebVitals,

    {
        rules: {
            // Apostrophes in copy ("last month's spending") read fine in JSX and
            // React escapes them correctly. Novira's UI is prose-heavy, so this
            // rule is 42 findings of pure noise.
            'react/no-unescaped-entities': 'off',

            // The two React Compiler rules below fire on deliberate, safe idioms
            // used throughout this codebase, ~170 times between them:
            //   - `ref.current = fn` during render (the latest-callback ref idiom)
            //   - calling a fetch function inside useEffect on mount
            // Neither is a bug here, and neither is worth a codebase-wide refactor
            // nobody asked for. Off rather than 'warn' so the remaining warnings
            // stay small enough to actually read.
            'react-hooks/refs': 'off',
            'react-hooks/set-state-in-effect': 'off',

            // Lower-volume compiler rules stay on as warnings — few enough to
            // review, and they point at spots worth knowing about.
            'react-hooks/static-components': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/purity': 'warn',
        },
    },
];

export default config;
