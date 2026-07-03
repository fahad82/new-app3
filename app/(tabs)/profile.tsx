import { Colors } from '@/constants/theme';
import { authStorage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface UserData {
  email: string;
  role: string;
  isLoggedIn: boolean;
}

export default function ProfileScreen() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [email, role, isLoggedIn] = await Promise.all([
        authStorage.getEmail(),
        authStorage.getRole(),
        authStorage.isLoggedIn(),
      ]);

      setUser({
        email: email || 'N/A',
        role: role || 'User',
        isLoggedIn: isLoggedIn,
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await authStorage.logout();
              router.replace('/login' as any);
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getInitials = (email: string) => {
    if (!email || email === 'N/A') return 'U';
    const parts = email.split('@');
    if (parts.length > 0) {
      const username = parts[0];
      if (username.length >= 2) {
        return username.substring(0, 2).toUpperCase();
      }
      return username.substring(0, 1).toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = () => {
    if (!user?.email || user.email === 'N/A') return 'NLC User';
    const parts = user.email.split('@');
    if (parts.length > 0) {
      // Format username: replace dots/underscores with spaces and capitalize
      const name = parts[0]
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      return name;
    }
    return 'NLC User';
  };

  const getDisplayEmail = () => {
    return user?.email || 'user@nlc.com';
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return '#D32F2F';
      case 'manager':
        return Colors.primary;
      case 'user':
        return '#10B981';
      default:
        return Colors.accent;
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'shield-checkmark';
      case 'manager':
        return 'people';
      case 'user':
        return 'person';
      default:
        return 'person-outline';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.accent }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={[styles.profileSection, { backgroundColor: Colors.white }]}>
          <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials(getDisplayEmail())}</Text>
          </View>
          
          <Text style={[styles.name, { color: Colors.text }]}>{getDisplayName()}</Text>
          <Text style={[styles.email, { color: Colors.accent }]}>{getDisplayEmail()}</Text>
          
          {user?.role && (
            <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) + '15' }]}>
              <Ionicons 
                name={getRoleIcon(user.role) as any} 
                size={14} 
                color={getRoleBadgeColor(user.role)} 
              />
              <Text style={[styles.roleText, { color: getRoleBadgeColor(user.role) }]}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* User Info Section */}
        <View style={[styles.infoSection, { backgroundColor: Colors.white }]}>
          <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>Account Information</Text>
          
          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={20} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: Colors.accent }]}>Email Address</Text>
              <Text style={[styles.infoValue, { color: Colors.text }]}>{getDisplayEmail()}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={20} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: Colors.accent }]}>Role</Text>
              <Text style={[styles.infoValue, { color: Colors.text }]}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
              </Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: Colors.accent }]}>Status</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: user?.isLoggedIn ? '#10B981' : '#D32F2F' }]} />
                <Text style={[styles.infoValue, { color: user?.isLoggedIn ? '#10B981' : '#D32F2F' }]}>
                  {user?.isLoggedIn ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={[styles.menuSection, { backgroundColor: Colors.white }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Settings page is under development')}>
            <Ionicons name="settings-outline" size={22} color={Colors.primary} />
            <Text style={[styles.menuLabel, { color: Colors.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('About', 'Smart Solution Fleet Management System v3.0')}>
            <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
            <Text style={[styles.menuLabel, { color: Colors.text }]}>About</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity style={styles.menuItem} onPress={loadUserData}>
            <Ionicons name="refresh-outline" size={22} color={Colors.primary} />
            <Text style={[styles.menuLabel, { color: Colors.text }]}>Refresh Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: Colors.white }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#E74C3C" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: Colors.accent }]}>Version 3.0.0</Text>
          <Text style={[styles.versionSubtext, { color: Colors.accent }]}>Smart Solution Fleet Management System</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  content: { 
    flex: 1, 
    padding: 16 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.white,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 14,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuSection: {
    borderRadius: 16,
    padding: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 12,
  },
  menuLabel: {
    fontSize: 16,
    flex: 1,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 8,
    marginBottom: 100,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  versionSubtext: {
    fontSize: 10,
  },
});