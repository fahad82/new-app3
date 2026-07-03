import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MaterialIcons,
  MaterialCommunityIcons,
  Ionicons
} from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';

// --- Configuration & Sizing Architecture ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const responsiveWidth = (percentage: number) => (SCREEN_WIDTH * percentage) / 100;
const responsiveHeight = (percentage: number) => (SCREEN_HEIGHT * percentage) / 100;
const responsiveFont = (size: number) => {
  const scaleFactor = Math.min(SCREEN_WIDTH / 375, 1.15);
  return Math.round(size * scaleFactor);
};

const isTablet = SCREEN_WIDTH >= 768;

// Carousel Card Geometry
const CARD_WIDTH = isTablet ? SCREEN_WIDTH * 0.70 : SCREEN_WIDTH * 0.88;
// const CARD_HEIGHT = isTablet ? 225 : 190;
const CARD_HEIGHT = isTablet ? responsiveHeight(32) : responsiveHeight(28);
const CARD_SPACING = isTablet ? 16 : 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;
const CENTER_PADDING = (SCREEN_WIDTH - SNAP_INTERVAL) / 2;

const getBaseUrl = () => {
  return process.env.EXPO_PUBLIC_BASE_URL || 
         Constants.expoConfig?.extra?.baseUrl || 
         "https://vtssmartsolutions.com";
};

interface SliderProps {
  newsData: any[];
  newsLoading: boolean;
}

interface StatData {
  [key: string]: {
    [status: string]: number;
  };
}

// --- Memoized Timeline Component for Performance ---
const TimelineIndicator = memo(({ slide, index, activeIndex, onPress, isLast }: any) => {
  const isActive = activeIndex === index;
  const isCompleted = activeIndex > index;

  return (
    <TouchableOpacity
      onPress={() => onPress(index)}
      style={styles.timelineIndicator}
      activeOpacity={0.7}
    >
      <View style={styles.timelineDotWrapper}>
        <View style={[
          styles.timelineDot,
          isActive && styles.timelineDotActive,
          isCompleted && styles.timelineDotCompleted,
        ]}>
          {isActive && <View style={styles.timelineDotInner} />}
        </View>
        {!isLast && (
          <View style={[
            styles.timelineConnector,
            isCompleted && styles.timelineConnectorCompleted,
          ]} />
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.timelineText,
          isActive && styles.timelineTextActive,
        ]}
      >
        {slide.title}
      </Text>
    </TouchableOpacity>
  );
});

const MobileDashboardSlider: React.FC<SliderProps> = ({ newsData, newsLoading }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [statsData, setStatsData] = useState<StatData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 mins

  const BASE_URL = getBaseUrl();

  const dashboardStats = {
    totalTrips: statsData?.last_month ? Object.values(statsData.last_month).reduce((a, b) => a + b, 0) : 1420,
    averageCompletionRate: 94.2,
    averageResponseTime: 2.4,
    activeTrips: 42,
    completedTrips: 1284,
    onTimeDelivery: 96.8,
    fleetUtilization: 88.5
  };

  const slides = [
    { id: 'today', title: "Today's Status", subtitle: "Real-time fleet tracking", icon: 'calendar-today' },
    { id: 'last_month', title: 'Monthly Status', subtitle: "Current month overview", icon: 'calendar-month' },
    { id: 'last_6_months', title: '6-Month Analysis', subtitle: "Semi-annual performance", icon: 'calendar-range' },
    { id: 'last_year', title: 'Annual Report', subtitle: "Yearly performance metrics", icon: 'calendar-star' },
  ];

  const fetchStats = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      setStatsLoading(true);
      setError(null);
      const url = `${BASE_URL}/api/mobiledashboard/status-trip-counts`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (isMountedRef.current) {
        setStatsData(data);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.error("Dashboard Slider Fetch Error:", err);
        setError(err.name === 'AbortError' ? "Request Timeout" : "Network Disconnected");
      }
    } finally {
      if (isMountedRef.current) setStatsLoading(false);
    }
  }, [BASE_URL]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchStats();

    const dataSyncTimer = setInterval(() => {
      if (isMountedRef.current) fetchStats();
    }, REFRESH_INTERVAL);
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isMountedRef.current) fetchStats();
    });
    
    return () => {
      isMountedRef.current = false;
      clearInterval(dataSyncTimer);
      subscription.remove();
    };
  }, [fetchStats]);

  const scrollToSection = useCallback((index: number) => {
    setActiveIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * SNAP_INTERVAL,
      animated: true
    });
  }, []);

  useEffect(() => {
    if (statsLoading || error) return;
    autoPlayTimerRef.current = setInterval(() => {
      if (isMountedRef.current) {
        const nextIndex = (activeIndex + 1) % slides.length;
        scrollToSection(nextIndex);
      }
    }, 6000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [activeIndex, statsLoading, error, scrollToSection, slides.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    if (index !== activeIndex && index >= 0 && index < slides.length) {
      setActiveIndex(index);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: string; label: string }> = {
      planned: { icon: 'calendar-clock', label: 'Planned' },
      started: { icon: 'play-circle', label: 'In Progress' },
      approved: { icon: 'check-circle', label: 'Approved' },
      completed: { icon: 'flag-checkered', label: 'Completed' },
    };
    return configs[status] || { icon: 'circle', label: status };
  };

  const renderSlide = (item: any, index: number) => {
    const stats = statsData ? statsData[item.id] : null;
    const totalTrips = stats ? 
      (stats.planned || 0) + (stats.started || 0) + (stats.approved || 0) + (stats.completed || 0) 
      : 0;

    return (
      <View key={item.id} style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
        <LinearGradient
          colors={[Colors.white, '#FCFCFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardSolid, { height: CARD_HEIGHT }]}
        >
          {/* Main Card Header Block */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name={item.icon} size={responsiveFont(18)} color={Colors.primary} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
            {activeIndex === index && (
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Live Track</Text>
              </View>
            )}
          </View>

          {/* Stats Inner Block */}
          {statsLoading ? (
            <View style={styles.innerLoadingContainer}>
              <ActivityIndicator color={Colors.primary} size="small" />
            </View>
          ) : stats ? (
            <View style={styles.statsContainer}>
              <View style={styles.totalSummary}>
                <Text style={styles.totalLabel}>Total Segment Trips</Text>
                <Text style={styles.totalValue}>{totalTrips.toLocaleString()}</Text>
              </View>

              <View style={styles.statusGrid}>
                {['planned', 'started', 'approved', 'completed'].map((status) => {
                  const config = getStatusConfig(status);
                  const val = stats[status] || 0;
                  const percentage = totalTrips > 0 ? (val / totalTrips) * 100 : 0;
                  
                  return (
                    <View key={status} style={styles.statusItem}>
                      <View style={styles.statusHeader}>
                        <MaterialCommunityIcons name={config.icon as any} size={responsiveFont(12)} color={Colors.accent} />
                        <Text style={styles.statusLabel} numberOfLines={1}>{config.label}</Text>
                      </View>
                      <Text style={styles.statusValue}>{val.toLocaleString()}</Text>
                      <View style={styles.progressBar}>
                        <LinearGradient
                          colors={[Colors.primary, '#F3AD6D']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.progressFill, { width: `${Math.min(percentage, 100)}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="analytics-outline" size={responsiveFont(26)} color={Colors.accent} />
              <Text style={styles.noDataText}>No records parsed</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
     
 {/* Structural Section Boundary Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIconWrapper}>
            <MaterialCommunityIcons name="chart-box" size={responsiveFont(18)} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Trip Statistics</Text>
            <Text style={styles.sectionSubtitle}>Performance telemetry reports</Text>
          </View>
        </View>
        <View style={styles.sectionHeaderRight}>
          {lastUpdated && (
            <Text style={styles.lastUpdatedText}>
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <TouchableOpacity style={styles.refreshButton} onPress={fetchStats} activeOpacity={0.7}>
            <Ionicons name="refresh" size={responsiveFont(14)} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>
      {/* Primary Key Metric Highlights Horizontal Grid */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.statsScrollView}
        contentContainerStyle={styles.statsScrollContent}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="analytics" size={responsiveFont(16)} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>Total Fleet Trips</Text>
            <Text style={styles.statMainValue}>{dashboardStats.totalTrips.toLocaleString()}</Text>
            <View style={styles.statTrend}>
              <Ionicons name="trending-up" size={11} color="#2E7D32" />
              <Text style={styles.statTrendText}>+8.5% MoM</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-done-circle" size={responsiveFont(16)} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>Completion Rate</Text>
            <Text style={styles.statMainValue}>{dashboardStats.averageCompletionRate}%</Text>
            <View style={styles.statTrend}>
              <Ionicons name="trending-up" size={11} color="#2E7D32" />
              <Text style={styles.statTrendText}>+5.2% Target</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="time" size={responsiveFont(16)} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>Avg Response</Text>
            <Text style={styles.statMainValue}>{dashboardStats.averageResponseTime} hrs</Text>
            <View style={styles.statTrend}>
              <Ionicons name="trending-down" size={11} color="#D32F2F" />
              <Text style={[styles.statTrendText, { color: '#D32F2F' }]}>-0.5h Opt</Text>
            </View>
          </View>
        </View>
      </ScrollView>

     

      {/* Dynamic Slide Carousel Track System */}
      {error && !statsData ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={responsiveFont(26)} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
            <Text style={styles.retryButtonText}>Reinitialize</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="center"
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: CENTER_PADDING, paddingVertical: responsiveHeight(1) }}
            style={styles.carouselContainer}
          >
            {slides.map((slide, index) => renderSlide(slide, index))}
          </ScrollView>

          {/* Clean Stepper & Pagination System */}
          <View style={styles.navigationWrapper}>
            <View style={styles.timelineContainer}>
              {slides.map((slide, index) => (
                <TimelineIndicator
                  key={slide.id}
                  slide={slide}
                  index={index}
                  activeIndex={activeIndex}
                  onPress={scrollToSection}
                  isLast={index === slides.length - 1}
                />
              ))}
            </View>

            <View style={styles.arrowNavigation}>
              <TouchableOpacity 
                style={[styles.arrowButton, activeIndex === 0 && styles.arrowButtonDisabled]}
                onPress={() => scrollToSection((activeIndex - 1 + slides.length) % slides.length)}
                disabled={activeIndex === 0}
              >
                <MaterialIcons name="chevron-left" size={22} color={activeIndex === 0 ? '#CCCCCC' : Colors.secondary} />
              </TouchableOpacity>

              <View style={styles.pageIndicator}>
                {slides.map((_, index) => (
                  <View key={index} style={[styles.pageDot, activeIndex === index && styles.pageDotActive]} />
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.arrowButton, activeIndex === slides.length - 1 && styles.arrowButtonDisabled]}
                onPress={() => scrollToSection((activeIndex + 1) % slides.length)}
                disabled={activeIndex === slides.length - 1}
              >
                <MaterialIcons name="chevron-right" size={22} color={activeIndex === slides.length - 1 ? '#CCCCCC' : Colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Hero Structured Data Spotlight Banner Card with Gradient Backdrop */}
      <LinearGradient
        colors={[Colors.secondary, '#332E30']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.amberHeroCard}
      >
        <View style={styles.amberCardContent}>
          <Text style={styles.amberCardTitle}>Overall Fleet Efficiency</Text>
          <Text style={styles.amberCardValue}>{dashboardStats.averageCompletionRate}%</Text>
          <Text style={styles.amberCardSub}>System-wide workflow completion score</Text>
        </View>
        <LinearGradient
          colors={[Colors.primary, '#F3AD6D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGraphic}
        >
          <Text style={styles.cardGraphicText}>{dashboardStats.fleetUtilization}%</Text>
          <Text style={styles.cardGraphicSub}>Active</Text>
        </LinearGradient>
      </LinearGradient>

      {/* 2x2 Clean Balanced Key Metrics Dashboard Grid Layout */}
      <View style={styles.quickStatsGrid}>
        <View style={styles.quickStatItem}>
          <View style={styles.quickStatIcon}>
            <Ionicons name="car-sport" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.quickStatValue}>{dashboardStats.activeTrips.toLocaleString()}</Text>
          <Text style={styles.quickStatLabel}>Active Transits</Text>
        </View>
        
        <View style={styles.quickStatItem}>
          <View style={styles.quickStatIcon}>
            <Ionicons name="flag" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.quickStatValue}>{dashboardStats.completedTrips.toLocaleString()}</Text>
          <Text style={styles.quickStatLabel}>Archived Cycles</Text>
        </View>

        <View style={styles.quickStatItem}>
          <View style={styles.quickStatIcon}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.quickStatValue}>{dashboardStats.onTimeDelivery}%</Text>
          <Text style={styles.quickStatLabel}>On-Time Rating</Text>
        </View>

        <View style={styles.quickStatItem}>
          <View style={styles.quickStatIcon}>
            <Ionicons name="speedometer" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.quickStatValue}>{dashboardStats.fleetUtilization}%</Text>
          <Text style={styles.quickStatLabel}>Resource Density</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface, // Clean institutional light-grey backdrop canvas layout (#F8F8F8)
  },
  
  // Welcome Branding Section Blocks
  welcomeSection: {
    paddingHorizontal: responsiveWidth(5),
    marginTop: Platform.OS === 'ios' ? responsiveHeight(2.5) : responsiveHeight(3.5),
    marginBottom: responsiveHeight(2),
  },
  greeting: {
    fontSize: responsiveFont(13),
    color: Colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: responsiveFont(25),
    fontWeight: '800',
    color: Colors.secondary, // High-visibility dark charcoal contrast font
    letterSpacing: -0.5,
    marginTop: 2,
  },

  // Premium Metric Card Alignment Blocks
  statsScrollView: {
    marginBottom: responsiveHeight(2.5),
  },
  statsScrollContent: {
    paddingLeft: responsiveWidth(5),
    paddingRight: responsiveWidth(2),
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCard: {
    width: responsiveWidth(38),
    borderRadius: responsiveFont(14),
    padding: responsiveWidth(4),
    marginRight: responsiveWidth(3),
    backgroundColor: Colors.white, // Clean premium pure-white card body surface
    borderTopWidth: 3,
    borderTopColor: Colors.primary, // Premium Amber top indicator strip line
    ...Platform.select({
      ios: {
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  statIconContainer: {
    width: responsiveWidth(8),
    height: responsiveWidth(8),
    borderRadius: responsiveWidth(2),
    backgroundColor: 'rgba(239, 142, 51, 0.08)', // Elegant Amber background blend layer
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveHeight(1.2),
  },
  statLabel: {
    fontSize: responsiveFont(11),
    color: Colors.accent,
    fontWeight: '600',
  },
  statMainValue: {
    fontSize: responsiveFont(19),
    fontWeight: '800',
    color: Colors.secondary,
    marginVertical: 2,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statTrendText: {
    fontSize: responsiveFont(10),
    fontWeight: '700',
    color: '#2E7D32',
    marginLeft: 3,
  },

  // Structural Section Separation Rules
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(1.5),
    paddingTop: responsiveHeight(2.5),
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconWrapper: {
    width: responsiveWidth(8.5),
    height: responsiveWidth(8.5),
    borderRadius: responsiveWidth(2.5),
    backgroundColor: 'rgba(239, 142, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveWidth(2.5),
  },
  sectionTitle: {
    fontSize: responsiveFont(16),
    fontWeight: '700',
    color: Colors.secondary,
  },
  sectionSubtitle: {
    fontSize: responsiveFont(11),
    color: Colors.accent,
    marginTop: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastUpdatedText: {
    fontSize: responsiveFont(10),
    color: Colors.accent,
    fontWeight: '500',
  },
  refreshButton: {
    width: responsiveWidth(7.5),
    height: responsiveWidth(7.5),
    borderRadius: responsiveWidth(2),
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },

  // Carousel Layout Infrastructure
  carouselContainer: {
    flexGrow: 0,
    marginBottom: responsiveHeight(1.5),
  },
  cardWrapper: {
    marginHorizontal: CARD_SPACING / 2,
  },
  cardSolid: {
    borderRadius: responsiveFont(16),
    padding: responsiveWidth(4.5),
    paddingBottom: responsiveHeight(2),
    borderLeftWidth: 4, 
    borderLeftColor: Colors.primary, // Dominant Solid Amber left focal line element
    ...Platform.select({
      ios: {
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1),
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: responsiveWidth(8),
    height: responsiveWidth(8),
    borderRadius: responsiveWidth(2),
    backgroundColor: 'rgba(239, 142, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveWidth(2.5),
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    color: Colors.secondary,
    fontSize: responsiveFont(15),
    fontWeight: '800',
  },
  cardSubtitle: {
    color: Colors.accent,
    fontSize: responsiveFont(11),
    fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 142, 51, 0.1)',
    paddingHorizontal: responsiveWidth(2),
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginRight: 4,
  },
  activeText: {
    color: Colors.primary,
    fontSize: responsiveFont(9),
    fontWeight: '700',
  },
  statsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  totalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveHeight(1),
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  totalLabel: {
    color: Colors.accent,
    fontSize: responsiveFont(11),
    fontWeight: '600',
  },
  totalValue: {
    color: Colors.secondary,
    fontSize: responsiveFont(15),
    fontWeight: '800',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
   
  },
  statusItem: {
    width: '47%',
    marginBottom: 6,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusLabel: {
    color: Colors.secondary,
    fontSize: responsiveFont(10),
    fontWeight: '600',
    marginLeft: 4,
  },
  statusValue: {
    color: Colors.secondary,
    fontSize: responsiveFont(13),
    fontWeight: '800',
    marginTop: 1,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#EEEEEE',
    borderRadius: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },

  // Spotlight Hero Structural Container
  amberHeroCard: {
    marginHorizontal: responsiveWidth(5),
    borderRadius: responsiveFont(16),
    padding: responsiveWidth(4.5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(2.5),
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary, 
    ...Platform.select({
      ios: {
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: { elevation: 3 },
    }),
  },
  amberCardContent: {
    flex: 1,
  },
  amberCardTitle: {
    fontSize: responsiveFont(12),
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amberCardValue: {
    fontSize: responsiveFont(26),
    fontWeight: '800',
    color: Colors.white,
    marginVertical: 1,
  },
  amberCardSub: {
    fontSize: responsiveFont(11),
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  cardGraphic: {
    width: responsiveWidth(14),
    height: responsiveWidth(14),
    borderRadius: responsiveWidth(7),
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  cardGraphicText: {
    color: Colors.secondary,
    fontWeight: '900',
    fontSize: responsiveFont(12),
  },
  cardGraphicSub: {
    fontSize: 7,
    color: Colors.secondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Balanced 2x2 Data Matrix Structural Layout Block
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(4),
    gap: responsiveWidth(3),
  },
  quickStatItem: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: responsiveFont(14),
    padding: responsiveWidth(4),
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  quickStatIcon: {
    width: responsiveWidth(7.5),
    height: responsiveWidth(7.5),
    borderRadius: responsiveWidth(1.8),
    backgroundColor: 'rgba(239, 142, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveHeight(1),
  },
  quickStatValue: {
    fontSize: responsiveFont(17),
    fontWeight: '800',
    color: Colors.secondary,
  },
  quickStatLabel: {
    fontSize: responsiveFont(11),
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },

  // Stepper Controller Navigation System Styles
  navigationWrapper: {
    paddingHorizontal: responsiveWidth(5),
    marginBottom: responsiveHeight(2.5),
  },
  timelineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1.5),
  },
  timelineIndicator: {
    flex: 1,
    alignItems: 'center',
  },
  timelineDotWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
    transform: [{ scale: 1.15 }],
  },
  timelineDotCompleted: {
    backgroundColor: Colors.primary,
  },
  timelineDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
    position: 'absolute',
    top: 2,
    left: 2,
  },
  timelineConnector: {
    height: 1.5,
    backgroundColor: '#EAEAEA',
    flex: 1,
    marginHorizontal: 4,
  },
  timelineConnectorCompleted: {
    backgroundColor: Colors.primary,
  },
  timelineText: {
    fontSize: responsiveFont(9.5),
    color: Colors.accent,
    fontWeight: '600',
  },
  timelineTextActive: {
    color: Colors.secondary,
    fontWeight: '800',
  },
  arrowNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  arrowButton: {
    width: responsiveWidth(8),
    height: responsiveWidth(8),
    borderRadius: responsiveWidth(2),
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: responsiveWidth(5),
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 3,
  },
  pageDotActive: {
    backgroundColor: Colors.primary,
    width: 12,
    borderRadius: 3,
  },

  // Fallback Error Handling Layout Blocks
  innerLoadingContainer: {
    height: CARD_HEIGHT - 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataContainer: {
    height: CARD_HEIGHT - 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: Colors.accent,
    fontSize: responsiveFont(12),
    fontWeight: '600',
    marginTop: 4,
  },
  errorContainer: {
    marginHorizontal: responsiveWidth(5),
    padding: responsiveWidth(5),
    backgroundColor: Colors.white,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  errorText: {
    color: Colors.secondary,
    fontSize: responsiveFont(13),
    marginVertical: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: responsiveFont(12),
  },
});

export default MobileDashboardSlider;