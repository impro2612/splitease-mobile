import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const logoImage = require("@/assets/splash-icon.png");
const taglineImage = require("@/assets/123.png");

export function LaunchIntro() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const orbitOpacity = useRef(new Animated.Value(0)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.94)).current;
  const splitProgress = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const orbitLoop = Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 6800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    orbitLoop.start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.15)),
          useNativeDriver: true,
        }),
        Animated.timing(orbitOpacity, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(titleScale, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(180),
      Animated.timing(splitProgress, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslate, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => {
      orbitLoop.stop();
    };
  }, [
    glowOpacity,
    logoOpacity,
    logoScale,
    orbitOpacity,
    orbitRotation,
    splitProgress,
    taglineOpacity,
    taglineTranslate,
    titleOpacity,
    titleScale,
  ]);

  const orbitSpin = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const splitOffset = splitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 26],
  });

  const seamOpacity = splitProgress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blobLeft]} />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.orbitLayer,
            {
              opacity: orbitOpacity,
              transform: [{ rotate: orbitSpin }],
            },
          ]}
        >
          <View style={styles.orbitRing} />
          <View style={[styles.orbitDot, styles.orbitDotA]} />
          <View style={[styles.orbitDot, styles.orbitDotB]} />
        </Animated.View>

        <View style={styles.logoCard}>
          <Image source={logoImage} style={styles.logoImage} resizeMode="contain" />
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.wordmarkWrap,
          {
            opacity: titleOpacity,
            transform: [{ scale: titleScale }],
          },
        ]}
      >
        <View style={styles.wordmarkRow}>
          <Animated.View
            style={{
              transform: [{ translateX: Animated.multiply(splitOffset, -1) }],
            }}
          >
            <Text style={styles.wordmarkSplit}>Split</Text>
          </Animated.View>
          <Animated.View style={[styles.wordmarkSeam, { opacity: seamOpacity }]} />
          <Animated.View
            style={{
              transform: [{ translateX: splitOffset }],
            }}
          >
            <Text style={styles.wordmarkIt}>IT</Text>
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.taglineWrap,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslate }],
          },
        ]}
      >
        <Image source={taglineImage} style={styles.taglineImage} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06081b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    backgroundColor: "rgba(116, 84, 255, 0.12)",
  },
  blobLeft: {
    width: 286,
    height: 380,
    borderTopRightRadius: 190,
    borderBottomRightRadius: 190,
    left: -92,
    top: 126,
  },
  blobTop: {
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -42,
    right: 54,
  },
  blobBottom: {
    width: 298,
    height: 298,
    borderRadius: 82,
    right: -42,
    bottom: 150,
    backgroundColor: "rgba(154, 71, 205, 0.15)",
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(111, 92, 255, 0.09)",
    top: "31%",
  },
  logoWrap: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  orbitLayer: {
    position: "absolute",
    width: 212,
    height: 212,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitRing: {
    position: "absolute",
    width: 202,
    height: 202,
    borderRadius: 101,
    borderWidth: 1.5,
    borderColor: "rgba(120, 103, 255, 0.34)",
  },
  orbitDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  orbitDotA: {
    top: 46,
    right: 18,
    backgroundColor: "#7A64FF",
  },
  orbitDotB: {
    bottom: 34,
    left: 22,
    backgroundColor: "#CF61FF",
  },
  logoCard: {
    width: 148,
    height: 148,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  logoImage: {
    width: 126,
    height: 126,
    borderRadius: 16,
  },
  wordmarkWrap: {
    alignItems: "center",
    marginBottom: 26,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 92,
  },
  wordmarkSplit: {
    fontSize: 54,
    fontWeight: "900",
    color: "#F8F7FB",
    letterSpacing: -2.6,
  },
  wordmarkIt: {
    fontSize: 54,
    fontWeight: "900",
    color: "#7A64FF",
    letterSpacing: -2.4,
  },
  wordmarkSeam: {
    width: 2,
    height: 54,
    backgroundColor: "rgba(255, 255, 255, 0.32)",
    marginHorizontal: 2,
    borderRadius: 1,
  },
  taglineWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 90,
  },
  taglineImage: {
    width: "100%",
    maxWidth: 520,
    height: 118,
  },
});
