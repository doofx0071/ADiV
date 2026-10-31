import React from "react";
import { StyleSheet, Text as NativeText, type TextProps, type TextStyle } from "react-native";

function fontForWeight(weight: TextStyle["fontWeight"] | undefined): string {
  switch (weight) {
    case "100": return "Geist_100Thin";
    case "200": return "Geist_200ExtraLight";
    case "300": return "Geist_300Light";
    case "500": return "Geist_500Medium";
    case "600": return "Geist_600SemiBold";
    case "700":
    case "bold": return "Geist_700Bold";
    case "800": return "Geist_800ExtraBold";
    case "900": return "Geist_900Black";
    default: return "Geist_400Regular";
  }
}

export const AppText = React.forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => {
    const weight = StyleSheet.flatten(style)?.fontWeight;
    return <NativeText ref={ref} {...props} style={[{ fontFamily: fontForWeight(weight) }, style]} />;
  }
);

AppText.displayName = "AppText";
