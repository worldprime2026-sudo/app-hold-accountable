import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#171E1B',
    borderWidth: 1,
    borderColor: '#2C3A33',
  },
  selected: {
    backgroundColor: '#C6F54A',
    borderColor: '#C6F54A',
  },
  text: {
    color: '#F3ECDE',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedText: {
    color: '#12180F',
  },
});
