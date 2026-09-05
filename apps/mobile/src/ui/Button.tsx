import { useTheme } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function Button({
  children,
  onPress,
  testID,
}: PropsWithChildren<{ onPress: () => void; testID?: string }>) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
    >
      <Text style={[styles.label, { color: colors.primary }]}>{children}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', paddingVertical: 10 },
  label: { fontSize: 17 },
});
