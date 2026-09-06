import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/palette';
import { timings } from '@/theme/motion';
import { AppText } from './AppText';
import { useToast } from './toast';

export function ToastHost() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const colors = usePalette();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: toast ? 1 : 0,
      duration: timings.fade.duration,
      useNativeDriver: true,
    }).start();
  }, [toast, progress]);

  if (!toast) return null;

  return (
    <View pointerEvents="none" style={[styles.slot, { top: insets.top + 8 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.pill,
          {
            backgroundColor: colors.card,
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <AppText variant="meta" style={styles.message}>
          {toast.message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  pill: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    minHeight: 36,
    justifyContent: 'center',
    maxWidth: '90%',
    boxShadow: '0 1px 2px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.16)',
  },
  message: { textAlign: 'center' },
});
