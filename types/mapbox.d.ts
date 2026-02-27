declare module '@mapbox/point-geometry';
declare module '@mapbox/mapbox-gl-supported';
declare module 'mapbox-gl' {
  const content: any;
  export default content;
  export const Map: any;
  export const Marker: any;
  export const NavigationControl: any;
  export const LngLatBounds: any;
  export let accessToken: string;
}
