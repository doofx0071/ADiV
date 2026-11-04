import { Map as MapView, Camera, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

interface Props {
  styleURL: string;
  bounds: [number, number, number, number] | null;
  route: GeoJSON.FeatureCollection;
  start: GeoJSON.FeatureCollection;
  end: GeoJSON.FeatureCollection;
  showEndpoints: boolean;
  routeColor: string;
  routeWidth: number;
  onRendered: () => void;
}

export function ShareMapBackground({ styleURL, bounds, route, start, end, showEndpoints, routeColor, routeWidth, onRendered }: Props) {
  return (
    <MapView mapStyle={styleURL} style={{ flex: 1 }} onDidFinishRenderingMapFully={onRendered}>
      {bounds ? <Camera bounds={bounds} padding={{ top: 80, right: 80, bottom: 80, left: 80 }} /> : <Camera />}
      <GeoJSONSource id="shareActivityRoute" data={route}>
        <Layer
          id="shareActivityRouteLine"
          type="line"
          paint={{ "line-color": routeColor, "line-width": routeWidth * 0.55 }}
        />
      </GeoJSONSource>
      {showEndpoints ? (
        <>
          <GeoJSONSource id="shareActivityStart" data={start}>
            <Layer
              id="shareActivityStartDot"
              type="circle"
              paint={{ "circle-radius": routeWidth + 3, "circle-color": "#ffffff", "circle-stroke-color": routeColor, "circle-stroke-width": 3 }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="shareActivityEnd" data={end}>
            <Layer
              id="shareActivityEndDot"
              type="circle"
              paint={{ "circle-radius": routeWidth + 2, "circle-color": routeColor, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 }}
            />
          </GeoJSONSource>
        </>
      ) : null}
    </MapView>
  );
}
