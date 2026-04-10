import 'leaflet';

declare module 'leaflet' {
  export interface HeatLayer extends Layer {
    setLatLngs(latlngs: any[]): this;
    addLatLng(latlng: any): this;
    setOptions(options: any): this;
  }

  export function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: { [key: number]: string };
    }
  ): HeatLayer;
}
