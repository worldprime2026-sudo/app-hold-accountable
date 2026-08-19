import { StyleSheet, Text } from 'react-native';

export function Disclaimer() {
  return (
    <Text style={styles.text}>
      Not a financial advisor, bank, brokerage, or investment service. Educational playground only. We do not tell you
      what to do with your money.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#6F7C74',
    fontSize: 12,
    lineHeight: 18,
  },
});
