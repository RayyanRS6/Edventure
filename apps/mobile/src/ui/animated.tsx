import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { radius, shadow } from './theme';

/**
 * Spring-physics pressable button/card that feels tactile and responsive.
 * Scales down slightly to 0.97 on touch and springs back on release.
 */
export function PressableScale({
  children,
  onPress,
  disabled,
  style,
  scaleTo = 0.97,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Staggered entrance card that smoothly fades in and glides upward.
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 320,
  offsetY = 12,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        speed: 18,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, duration, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Pulsing live indicator for active periods or urgent alerts.
 */
export function PulseView({
  children,
  style,
  minScale = 0.95,
  maxScale = 1.05,
}: {
  children: ReactNode;
  style?: ViewStyle;
  minScale?: number;
  maxScale?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: maxScale,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: minScale,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [maxScale, minScale, scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Gentle floating animation for badges, sticker pills, and hero sculptures.
 */
export function FloatingView({
  children,
  style,
  distance = 6,
  duration = 2400,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  distance?: number;
  duration?: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -distance,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [distance, duration, translateY]);

  return (
    <Animated.View style={[{ transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

