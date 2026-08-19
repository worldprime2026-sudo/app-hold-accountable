import { Spacing } from '@/constants/theme';
import { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export function Card({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#171E1B',
    borderRadius: 24,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#24302A',
    gap: Spacing.two,
  },
});
