import Mapbox from "@rnmapbox/maps";

export function setMapboxAccessToken(token: string): void {
  Mapbox.setAccessToken(token);
}
