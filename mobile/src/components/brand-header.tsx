import { Moon, Sun } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { SvgXml } from "react-native-svg";
import { useAppTheme } from "@/lib/theme";
import { advLogoDark, advLogoLight } from "@/lib/brand-logos";
import alternateLogo from "../../assets/images/ADiV-shesh.png";

export function BrandHeader() {
  const { resolved, colors, setMode } = useAppTheme();
  const [showAlternate, setShowAlternate] = useState(false);
  const [opacities] = useState(() => {
    const alternate = new Animated.Value(0);
    return {
      alternate,
      primary: alternate.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    };
  });

  useEffect(() => {
    const intervalId = setInterval(() => setShowAlternate((current) => !current), 4500);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    Animated.timing(opacities.alternate, {
      toValue: showAlternate ? 1 : 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [opacities, showAlternate]);

  return (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to AdiV home"
        onPress={() => router.replace("/(tabs)")}
        style={styles.logoSlot}
      >
        <Animated.View pointerEvents="none" style={[styles.logoLayer, { opacity: opacities.primary }]}>
          <SvgXml xml={resolved === "dark" ? advLogoDark : advLogoLight} width="100%" height="100%" />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.logoLayer, { opacity: opacities.alternate }]}>
          <Image source={alternateLogo} contentFit="contain" alt="" style={styles.alternateLogo} />
        </Animated.View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onPress={() => setMode(resolved === "dark" ? "light" : "dark")}
        style={[styles.themeButton, { borderColor: colors.border }]}
      >
        {resolved === "dark" ? <Sun size={18} color={colors.foreground} /> : <Moon size={18} color={colors.foreground} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  logoSlot: { width: 200, height: 44 },
  logoLayer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  alternateLogo: { width: "100%", height: "100%" },
  themeButton: { width: 36, height: 36, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});
