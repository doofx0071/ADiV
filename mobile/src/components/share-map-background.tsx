import { Text, View } from "react-native";

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

export function ShareMapBackground(_props: Props) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#e5e7eb" }}>
      <Text style={{ color: "#34363d", fontSize: 12, textAlign: "center", padding: 12 }}>
        Offline map backgrounds are available in the Android app.
      </Text>
    </View>
  );
}
