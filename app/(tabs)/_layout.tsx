import Header from '@/components/Header';
import { Colors } from '@/constants/theme';
import { authStorage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const responsiveFont = (size: number) => Math.round(size * Math.min(SCREEN_WIDTH / 375, 1.15));

export default function TabLayout() {
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      const role = await authStorage.getRole();
      setUserRole(role as 'admin' | 'user' | null);
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  // Different heights for iOS and Android
  const tabBarHeight = Platform.OS === 'ios' 
    ? 58 + insets.bottom 
    : 80 + insets.bottom; // Reduced for Android

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Tabs
        screenOptions={{
          header: () => <Header />,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.accent,
          tabBarStyle: {
            backgroundColor: Colors.secondary,
            borderTopWidth: 0,
            elevation: 12,
            height: tabBarHeight,
            paddingBottom: Platform.OS === 'ios' 
              ? 18 + insets.bottom 
              : 15, // Reduced for Android
            paddingTop: Platform.OS === 'ios' 
              ? 15  // iOS keeps more top padding
              : 13,  // Android reduced top padding
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontSize: responsiveFont(10.5),
            fontWeight: '600',
            marginTop: Platform.OS === 'ios' ? 2 : 0, // Android no margin
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons 
                name={focused ? 'home' : 'home-outline'} 
                size={Platform.OS === 'ios' ? 22 : 24} // Slightly bigger on Android
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons 
                name={focused ? 'notifications' : 'notifications-outline'} 
                size={Platform.OS === 'ios' ? 22 : 24}
                color={color} 
              />
            ),
          }}
        />
        {userRole === 'admin' && (
          <Tabs.Screen
            name="create"
            options={{
              title: 'Create',
              tabBarIcon: ({ focused, color }) => (
                <Ionicons 
                  name={focused ? 'add-circle' : 'add-circle-outline'} 
                  size={Platform.OS === 'ios' ? 26 : 28}
                  color={color} 
                />
              ),
            }}
          />
        )}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons 
                name={focused ? 'person' : 'person-outline'} 
                size={Platform.OS === 'ios' ? 22 : 24}
                color={color} 
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});