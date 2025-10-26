import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function StartScreen() {
  return (
    <>
        <ThemedView style={styles.titleContainer}>
            <ThemedText
                type='title'
            >Maps</ThemedText>
        </ThemedView>
        
    </>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 10
  },
});
