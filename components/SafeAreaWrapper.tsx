import { StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  backgroundColor?: string;
}

export default function SafeAreaWrapper({ 
  children, 
  style,
  edges = ['top', 'bottom'],
  backgroundColor = Colors.background
}: SafeAreaWrapperProps) {
  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor }, style]}
      edges={edges}
    >
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={backgroundColor}
      />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  }
});