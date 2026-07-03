import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 Minutes
const FETCH_TIMEOUT = 15000; // 15 Seconds

interface AssetStats {
  total: number;
  available: number;
  in_use: number;
}

interface AssetData {
  pmd: AssetStats;
  csd: AssetStats;
  eseal: AssetStats;
}

interface EntityData {
  total_unique_vehicles: number;
  total_unique_carriers: number;
}

interface MiniGridCardProps {
  title: string;
  value: number;       // Represents In-Use for assets, or Total for raw metrics
  subValue?: number;   // Optional: Represents Total Inventory for asset breakdowns
  icon: string;
  themeColor: string;
  opacityColor: string;
  percentage?: number; // Live computed utilization percentage
  label: string;
}

const initialStats: AssetStats = { total: 0, available: 0, in_use: 0 };

const AssetInventoryGrid = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [assets, setAssets] = useState<AssetData | null>(null);
  const [entities, setEntities] = useState<EntityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const BASE_URL = useMemo(() => {
    return process.env.EXPO_PUBLIC_BASE_URL || 
           Constants.expoConfig?.extra?.baseUrl || 
           "https://vtssmartsolutions.com";
  }, []);

  const fetchData = useCallback(async (isInitial = false) => {
    if (!isMountedRef.current) return;
    
    if (isInitial) setLoading(true);
    setIsRefreshing(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const [assetRes, entityRes] = await Promise.all([
        fetch(`${BASE_URL}/api/mobiledashboard/asset-utilization`, { signal: controller.signal }),
        fetch(`${BASE_URL}/api/mobiledashboard/unique-entity-counts`, { signal: controller.signal })
      ]);

      if (!assetRes.ok || !entityRes.ok) {
        throw new Error("Server communication returned a faulty status sync.");
      }

      const assetJson = await assetRes.json();
      const entityJson = await entityRes.json();

      if (isMountedRef.current) {
        setAssets(assetJson);
        setEntities(entityJson);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.error('Asset Inventory Grid Engine Error:', err);
        setError(err.name === 'AbortError' ? "Request Timeout" : "Sync Failed");
      }
    } finally {
      clearTimeout(timeoutId);
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [BASE_URL]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData(true);
    
    timerRef.current = setInterval(() => {
      if (isMountedRef.current) {
        fetchData(false);
      }
    }, REFRESH_INTERVAL);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isMountedRef.current) {
        fetchData(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      subscription.remove();
    };
  }, [fetchData]);

  // Safe utilization calculation logic
  const calculateRate = (stats: AssetStats) => {
    if (!stats.total || stats.total <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((stats.in_use / stats.total) * 100)));
  };

  const memoData = useMemo(() => {
    const pmd = assets?.pmd || initialStats;
    const csd = assets?.csd || initialStats;
    const eseal = assets?.eseal || initialStats;

    return {
      pmd,
      csd,
      eseal,
      pmdRate: calculateRate(pmd),
      csdRate: calculateRate(csd),
      esealRate: calculateRate(eseal),
      vehicles: entities?.total_unique_vehicles || 0,
      carriers: entities?.total_unique_carriers || 0,
    };
  }, [assets, entities]);

  const headerGradient = useMemo(() => [Colors.primary, '#f3a253'] as const, []);
  const updateLabel = lastUpdated ? `Update: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Update: Syncing';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Executive Sync Header */}
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="shield-car" size={20} color={Colors.white} />
            </View>
            <View>
              <Text style={styles.titleText}>Asset Operational Matrix</Text>
              <Text style={styles.subtitleText}>Real-time Device Utilization</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => fetchData(false)} 
            style={styles.refreshButton} 
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isRefreshing ? "hourglass-outline" : "sync"} 
              size={15} 
              color={Colors.white} 
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.primary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(true)} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Retry Sync</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          
          {/* Row 1: ESEAL & PMD Layout */}
          <View style={styles.gridRow}>
            <MiniGridCard 
              title="ESEAL Devices" 
              value={memoData.eseal.in_use} 
              subValue={memoData.eseal.total}
              icon="lock-smart" 
              themeColor={Colors.primary} 
              opacityColor="rgba(239, 142, 51, 0.1)" 
              percentage={memoData.esealRate}
              label={updateLabel}
            />
            <MiniGridCard 
              title="PMD Devices" 
              value={memoData.pmd.in_use} 
              subValue={memoData.pmd.total}
              icon="devices" 
              themeColor={Colors.primary} 
              opacityColor="rgba(239, 142, 51, 0.1)" 
              percentage={memoData.pmdRate}
              label={updateLabel}
            />
          </View>

          {/* Row 2: CSD & Active Logistics Vehicles */}
          <View style={styles.gridRow}>
            <MiniGridCard 
              title="CSD Devices" 
              value={memoData.csd.in_use} 
              subValue={memoData.csd.total}
              icon="bicycle" 
              themeColor={Colors.primary} 
              opacityColor="rgba(239, 142, 51, 0.1)" 
              percentage={memoData.csdRate}
              label={updateLabel}
            />
            <MiniGridCard 
              title="Total Vehicles" 
              value={memoData.vehicles} 
              icon="truck-delivery" 
              themeColor={Colors.secondary} 
              opacityColor="rgba(35, 31, 32, 0.08)" 
              label={updateLabel}
            />
          </View>

          {/* Row 3: Active Platform Carriers */}
          <View style={styles.gridRow}>
            <MiniGridCard 
              title="Active Carriers" 
              value={memoData.carriers} 
              icon="account-group" 
              themeColor={Colors.accent} 
              opacityColor="rgba(157, 157, 156, 0.15)" 
              label={updateLabel}
            />
            {/* Balanced Structural Layout Grid Spacer */}
            <View style={styles.spacerCard} />
          </View>

        </View>
      )}
    </View>
  );
};

/* ==========================================================================
   SUB-COMPONENTS (Clean Presentation Layer Matching Layout Spec)
   ========================================================================== */

const MiniGridCard = memo(({ title, value, subValue, icon, themeColor, opacityColor, percentage, label }: MiniGridCardProps) => {
  return (
    <View style={[styles.cardContainer, { borderBottomColor: themeColor }]}>
      {/* Top Header Row */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrapper, { backgroundColor: opacityColor }]}>
          <MaterialCommunityIcons name={icon as any} size={19} color={themeColor} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
      </View>

      {/* Main Metric Row (Active Used Devices vs Total) */}
      <View style={styles.valueRow}>
        <View style={styles.numbersGroup}>
          <Text style={styles.mainValue}>{value}</Text>
          {subValue !== undefined && (
            <Text style={styles.subValueLabel}>/{subValue}</Text>
          )}
        </View>
        
        {/* Dynamic Green Performance/Utilization Percentage Badge */}
        {percentage !== undefined && (
          <View style={styles.rateBadge}>
            <Ionicons name="trending-up" size={10} color="#2ecc71" style={styles.badgeIcon} />
            <Text style={styles.rateText}>{percentage}%</Text>
          </View>
        )}
      </View>

      {/* Clean Bottom Sync Footer Segment */}
      <View style={styles.cardFooter}>
        <Text style={styles.footerLabel}>{label}</Text>
      </View>
    </View>
  );
});

MiniGridCard.displayName = 'MiniGridCard';

/* ==========================================================================
   STYLE ARCHITECTURE (Refined Premium Multi-Color 2x2 Grid)
   ========================================================================== */
const styles = StyleSheet.create({
  container: { 
    paddingHorizontal: 16, 
    marginVertical: 12 
  },
  loadingContainer: { 
    height: 240, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerCard: { 
    borderRadius: 14, 
    padding: 14, 
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  headerContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  titleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  iconContainer: { 
    width: 34, 
    height: 34, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 10 
  },
  titleText: { 
    color: Colors.white, 
    fontSize: 15, 
    fontWeight: '700'
  },
  subtitleText: { 
    color: 'rgba(255, 255, 255, 0.8)', 
    fontSize: 10,
    marginTop: 1
  },
  refreshButton: { 
    backgroundColor: 'rgba(255, 255, 255, 0.15)', 
    padding: 8, 
    borderRadius: 20 
  },
  gridContainer: {
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardContainer: {
    width: '48.2%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    // Corporate Accent Baseline Visual Anchor
    borderBottomWidth: 3.5,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1.5,
    justifyContent: 'space-between'
  },
  spacerCard: {
    width: '48.2%',
    backgroundColor: 'transparent'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17, // Clean circular vector frame matching references
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    flex: 1
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  numbersGroup: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  mainValue: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5
  },
  subValueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    marginLeft: 1
  },
  rateBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(46, 204, 113, 0.11)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center'
  },
  badgeIcon: {
    marginRight: 2
  },
  rateText: {
    color: '#27ae60',
    fontSize: 10,
    fontWeight: '700'
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F6F6F6',
    paddingTop: 10
  },
  footerLabel: {
    fontSize: 10.5,
    color: '#999999',
    fontWeight: '500'
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 142, 51, 0.25)'
  },
  errorText: { 
    color: Colors.text, 
    fontSize: 13, 
    fontWeight: '600',
    marginTop: 6
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default memo(AssetInventoryGrid);