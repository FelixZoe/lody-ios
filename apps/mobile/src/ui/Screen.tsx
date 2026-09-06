import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ScrollViewMarker } from 'react-native-screens/experimental';

export const softScrollEdgeEffects = { top: 'soft', bottom: 'soft' } as const;

export function Screen({ children }: PropsWithChildren) {
  return (
    <ScrollViewMarker
      scrollEdgeEffects={softScrollEdgeEffects}
      style={styles.root}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {children}
      </ScrollView>
    </ScrollViewMarker>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
});
