import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

interface HeaderProps {
  onBack?: () => void;
  onProfile?: () => void;
  isHome?: boolean;
  compact?: boolean; // For screens needing less header space
  customHeight?: number; // Allow custom height override
  showStatusBar?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive sizing functions
const responsiveSize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH / 375, 1.2);
  return Math.round(size * scale);
};

const responsiveHeight = (size: number) => {
  const scale = Math.min(SCREEN_HEIGHT / 812, 1.2);
  return Math.round(size * scale);
};

export default function Header({ 
  onBack, 
  onProfile, 
  isHome = true,
  compact = false,
  customHeight,
  showStatusBar = true,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  
  // Dynamic sizes based on device
  const headerHeight = customHeight || (compact ? 40 : 50);
  const iconSize = responsiveSize(compact ? 28 : 36);
  const iconInnerSize = responsiveSize(compact ? 16 : 20);
  const logoWidth = responsiveSize(compact ? 80 : 100);
  const logoHeight = responsiveSize(compact ? 30 : 36);
  const horizontalPadding = responsiveSize(compact ? 12 : 16);
  const borderRadius = responsiveSize(compact ? 8 : 10);
  const statusBarHeight = showStatusBar ? (Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0) : 0;

  return (
    <SafeAreaView 
      style={[
        styles.safeArea,
        { 
          paddingTop: 0,
          backgroundColor: Colors.white,
        }
      ]} 
      edges={['left', 'right']}
    >
      {showStatusBar && (
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      )}
      
      <View style={[
        styles.container,
        {
          height: headerHeight + responsiveSize(4),
          paddingHorizontal: horizontalPadding,
         paddingTop: responsiveSize(compact ? 8 : 12), // Increased from 2/4 to 8/12
         paddingBottom: responsiveSize(compact ? 8 : 12), // ← Half of top padding
        }
      ]}>
        
        {/* Left Action */}
        <TouchableOpacity 
          onPress={isHome ? undefined : onBack} 
          activeOpacity={isHome ? 1 : 0.7}
          style={styles.iconButtonWrapper}
        >
          <LinearGradient
            colors={[Colors.primary, '#FFB347']} 
            style={[
              styles.iconButton,
              {
                width: iconSize,
                height: iconSize,
                borderRadius: borderRadius,
              }
            ]}
          >
            <Ionicons 
              name={isHome ? "home" : "arrow-back"} 
              size={iconInnerSize} 
              color={Colors.white} 
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Center: NLC Logo */}
        <View style={styles.logoWrapper}>
          <Image
            source={require('../assets/images/nlc-logo-removebg-preview.png')}
            style={[
              styles.logo,
              {
                width: logoWidth,
                height: logoHeight,
              }
            ]}
            contentFit="contain"
            transition={200}
          />
        </View>

        {/* Right Action */}
        <TouchableOpacity 
          onPress={onProfile} 
          activeOpacity={0.7}
          style={styles.iconButtonWrapper}
        >
          <LinearGradient
            colors={[Colors.secondary, Colors.accent]} 
            style={[
              styles.iconButton,
              {
                width: iconSize,
                height: iconSize,
                borderRadius: borderRadius,
              }
            ]}
          >
            <Ionicons name="person" size={iconInnerSize} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Dynamic styles applied inline
  },
  logoWrapper: { 
    flex: 1, 
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  logo: {
    // Dynamic styles applied inline
  },
  iconButtonWrapper: {
    padding: 4,
  },
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
});