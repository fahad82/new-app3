import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { Colors } from '@/constants/theme';

// --- IMPORT ALL YOUR COMPONENTS ---
import AIChatSummary from '@/components/AISummaryCard'; // <-- Make sure this matches your file name
import AssetInventorySlider from '@/components/AssetInventorySlider';
import MobileDashboardSlider from '@/components/MobileDashboardSlider';
import VehicleCountAlerts from '@/components/vehiclecountalerts';

// --- Interfaces ---
interface NewsArticle {
    id: number;
    title: string;
    content: string;
    created_at: string;
}

interface DashboardStats {
    totalTrips: number;
    completedTrips: number;
    activeTrips: number;
    totalAlerts: number;
    resolvedAlerts: number;
    pendingAlerts: number;
    averageCompletionRate: number;
    averageResponseTime: number;
    fleetUtilization: number;
    onTimeDelivery: number;
}

// --- Dimensions & Responsive Utils ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const responsiveWidth = (percentage: number) => (SCREEN_WIDTH * percentage) / 100;
const responsiveHeight = (percentage: number) => (SCREEN_HEIGHT * percentage) / 100;
const responsiveFont = (size: number) => {
    const scaleFactor = Math.min(SCREEN_WIDTH / 375, 1.2);
    return Math.round(size * scaleFactor);
};

const isSmallDevice = SCREEN_WIDTH < 375;
const isTablet = SCREEN_WIDTH >= 768;

// --- Memoized Static Sub-Components (Using Colors from theme) ---

const SoftwareInfoCard = memo(() => (
    <LinearGradient
        colors={[Colors.primary, '#ef8e33']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.amberCard}
    >
        <View style={styles.amberCardContent}>
            <Text style={styles.cardTitle}>VTS Smart Solutions</Text>
            <Text style={styles.softwareDescription}>
                Enterprise fleet management platform with real-time tracking, AI-powered alerts, 
                asset monitoring, and comprehensive trip analytics for operational excellence.
            </Text>
            <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>System Operational</Text>
            </View>
        </View>
        <View style={styles.cardGraphic}>
            <MaterialCommunityIcons name="cloud-check" size={28} color={Colors.white} />
            <Text style={styles.cardGraphicText}>v3.0</Text>
        </View>
    </LinearGradient>
));

const PremiumBanner = memo(() => (
    <View style={styles.bannerWrapper}>
        <LinearGradient
            colors={[Colors.secondary, Colors.secondary, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBanner}
        >
            <View style={styles.bannerContent}>
                <View style={styles.bannerHeader}>
                    <View style={styles.bannerIconContainer}>
                        <Ionicons name="cube-outline" size={responsiveFont(24)} color={Colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.bannerTitle}>National Logistics Corporation</Text>
                        <Text style={styles.bannerSubtitle}>Strategic Mobility & Logistic Support</Text>
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="location" size={responsiveFont(20)} color={Colors.primary} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoTitle}>Headquarter</Text>
                            <Text style={styles.infoText}>National Logistics Corporation (GHQ)</Text>
                            <Text style={styles.infoText}>Harding Rd, Rawalpindi, Pakistan</Text>
                        </View>
                    </View>
                    <View style={styles.flagContainer}>
                        <Ionicons name="flag" size={responsiveFont(16)} color={Colors.primary} />
                        <Text style={styles.flagText}>Serving Nation Since 1978</Text>
                    </View>
                </View>

                <View style={styles.contactRow}>
                    <View style={styles.contactItem}>
                        <Ionicons name="call" size={responsiveFont(22)} color={Colors.primary} />
                        <Text style={styles.contactText}>051-111-652-000</Text>
                    </View>
                    <View style={styles.contactItem}>
                        <Ionicons name="mail" size={responsiveFont(22)} color={Colors.primary} />
                        <Text style={styles.contactText}>info@nlc.gov.pk</Text>
                    </View>
                    <View style={styles.contactItem}>
                        <Ionicons name="globe" size={responsiveFont(22)} color={Colors.primary} />
                        <Text style={styles.contactText}>nlc.gov.pk</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2026 National Logistics Corporation</Text>
                </View>
            </View>
        </LinearGradient>
    </View>
));

export const Dashboard = () => {
    // Phase 0: Initial Render (Header + Memoized Static Cards)
    // Phase 1: Mount DashSlider + Trigger Stats Fetch
    // Phase 2: Mount AISummary + AssetInventorySlider
    // Phase 3: Mount VehicleAlerts + Trigger News Fetch
    const [renderPhase, setRenderPhase] = useState<number>(0);
    
    const [newsData, setNewsData] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    
    const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
        totalTrips: 0,
        completedTrips: 0,
        activeTrips: 0,
        totalAlerts: 0,
        resolvedAlerts: 0,
        pendingAlerts: 0,
        averageCompletionRate: 0,
        averageResponseTime: 0,
        fleetUtilization: 0,
        onTimeDelivery: 0,
    });

    const scrollViewRef = useRef<ScrollView>(null);
    const isMounted = useRef(true);

    const CARD_WIDTH = isTablet ? SCREEN_WIDTH * 0.7 : SCREEN_WIDTH * 0.85;
    const CARD_HEIGHT = isTablet 
        ? responsiveHeight(20) 
        : responsiveHeight(28);
    const SPACING = isTablet ? 15 : 10;
    const SNAP_INTERVAL = CARD_WIDTH + SPACING;
    const SPACER_WIDTH = (SCREEN_WIDTH - CARD_WIDTH) / 2;

    const BASE_URL = useMemo(() => {
        return process.env.EXPO_PUBLIC_BASE_URL || 
               Constants.expoConfig?.extra?.baseUrl || 
               "https://vtssmartsolutions.com";
    }, []);

    const API_URL = useMemo(() => `${BASE_URL}/api/news/list`, [BASE_URL]);
    const ALERTS_API_URL = useMemo(() => `${BASE_URL}/api/mobile/alerts/daily-counts`, [BASE_URL]);
    const STATS_API_URL = useMemo(() => `${BASE_URL}/api/mobiledashboard/status-trip-counts`, [BASE_URL]);

    const handleProfile = useCallback(() => console.log("Profile Pressed"), []);

    // --- Staggered Render Orchestration ---
    useEffect(() => {
        isMounted.current = true;

        InteractionManager.runAfterInteractions(() => {
            if (!isMounted.current) return;
            setRenderPhase(1);

            setTimeout(() => {
                if (!isMounted.current) return;
                setRenderPhase(2);
            }, 300);

            setTimeout(() => {
                if (!isMounted.current) return;
                setRenderPhase(3);
                setLoading(false);
            }, 700);
        });

        return () => {
            isMounted.current = false;
        };
    }, []);

    // --- Data Fetching ---
    const fetchDashboardStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(STATS_API_URL, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data && data.today && isMounted.current) {
                const todayStats = data.today || {};
                const lastMonthStats = data.last_month || {};
                const last6MonthsStats = data.last_6_months || {};
                const lastYearStats = data.last_year || {};

                const totalPlanned = (todayStats.planned || 0) + (lastMonthStats.planned || 0) + 
                                    (last6MonthsStats.planned || 0) + (lastYearStats.planned || 0);
                const totalStarted = (todayStats.started || 0) + (lastMonthStats.started || 0) + 
                                    (last6MonthsStats.started || 0) + (lastYearStats.started || 0);
                const totalApproved = (todayStats.approved || 0) + (lastMonthStats.approved || 0) + 
                                     (last6MonthsStats.approved || 0) + (lastYearStats.approved || 0);
                const totalCompleted = (todayStats.completed || 0) + (lastMonthStats.completed || 0) + 
                                      (last6MonthsStats.completed || 0) + (lastYearStats.completed || 0);

                const totalTrips = totalPlanned + totalStarted + totalApproved + totalCompleted;
                const activeTrips = totalStarted + totalApproved;
                const completionRate = totalTrips > 0 ? (totalCompleted / totalTrips) * 100 : 0;
                const fleetUtilization = totalTrips > 0 ? (activeTrips / totalTrips) * 100 : 0;
                const onTimeRate = completionRate * 0.95;

                setDashboardStats({
                    totalTrips,
                    completedTrips: totalCompleted,
                    activeTrips,
                    totalAlerts: 0,
                    resolvedAlerts: 0,
                    pendingAlerts: 0,
                    averageCompletionRate: Math.round(completionRate),
                    averageResponseTime: 4.2,
                    fleetUtilization: Math.round(fleetUtilization),
                    onTimeDelivery: Math.round(onTimeRate),
                });
            }
        } catch (error: any) {
            console.error('Error fetching dashboard stats:', error);
            if (isMounted.current) {
                setDashboardStats({
                    totalTrips: 0, completedTrips: 0, activeTrips: 0, totalAlerts: 0,
                    resolvedAlerts: 0, pendingAlerts: 0, averageCompletionRate: 0,
                    averageResponseTime: 0, fleetUtilization: 0, onTimeDelivery: 0,
                });
            }
        } finally {
            if (isMounted.current) setStatsLoading(false);
        }
    }, [STATS_API_URL]);

    const fetchLatestNews = useCallback(async () => {
        try {
            setError(null);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${API_URL}?limit=10&offset=0`, {
                signal: controller.signal,
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            let articles = [];
            if (data.articles && Array.isArray(data.articles)) articles = data.articles;
            else if (data.data && Array.isArray(data.data)) articles = data.data;
            else if (Array.isArray(data)) articles = data;
            
            if (isMounted.current) {
                setNewsData(articles);
                if (articles.length === 0) setError('No news articles found');
            }
        } catch (error: any) {
            console.error('Error fetching news:', error.message);
            if (isMounted.current) {
                if (error.name === 'AbortError') setError('Request timeout - server is not responding');
                else if (error.message === 'Network request failed') setError('Network error - cannot reach server');
                else setError(`Failed to load news: ${error.message}`);
                setNewsData([]);
            }
        }
    }, [API_URL]);

    // Triggers based on render phases
    useEffect(() => {
        if (renderPhase >= 1) fetchDashboardStats();
    }, [renderPhase, fetchDashboardStats]);

    useEffect(() => {
        if (renderPhase >= 3) fetchLatestNews();
    }, [renderPhase, fetchLatestNews]);

    // Auto-scroll news logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (newsData.length > 0 && renderPhase >= 3) {
            interval = setInterval(() => {
                setActiveSlide((prev) => {
                    const next = (prev + 1) % newsData.length;
                    if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                            x: next * SNAP_INTERVAL,
                            animated: true
                        });
                    }
                    return next;
                });
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [newsData.length, SNAP_INTERVAL, renderPhase]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Promise.all([fetchLatestNews(), fetchDashboardStats()]).finally(() => {
            if (isMounted.current) setRefreshing(false);
        });
    }, [fetchLatestNews, fetchDashboardStats]);

    const handleNewsScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slide = Math.round(event.nativeEvent.contentOffset.x / SNAP_INTERVAL);
        setActiveSlide(slide);
    }, [SNAP_INTERVAL]);

    const LoadingSkeleton = () => (
        <View style={styles.skeletonContainer}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
        </View>
    );

    const ErrorMessage = () => (
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={responsiveFont(48)} color={Colors.accent} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
           
            
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollViewContent}
                removeClippedSubviews={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                <StatusBar
                    barStyle="dark-content"
                    backgroundColor="transparent"
                    translucent={true}
                />
                
                <View style={styles.contentContainer}>
                    {/* Phase 0: Static Info instantly mounts */}
                    <SoftwareInfoCard />
                    
                    {/* ✅ NEW: AI Chat Summary - Phase 1 or 2 */}
                    {renderPhase >= 1 && (
                        <AIChatSummary 
                            onRefresh={fetchDashboardStats}
                            autoRefreshInterval={300000} // 5 minutes
                        />
                    )}

                    {/* Phase 1: Mount Stats Slider */}
                    {renderPhase >= 1 ? (
                        <MobileDashboardSlider newsData={newsData} newsLoading={loading} />
                    ) : (
                        <View style={{ height: responsiveHeight(25), marginHorizontal: 20 }} /> 
                    )}
                    
                    {/* Phase 2: Mount Heavy Computational Cards */}
                    {renderPhase >= 2 && (
                        <>
                            {/* ✅ NEW: Asset Inventory Grid */}
                            <AssetInventorySlider />
                        </>
                    )}

                    {/* Phase 3: Mount Alerts and List Views */}
                    {renderPhase >= 3 && (
                        <>
                            {/* ✅ Vehicle Count Alerts with consistent styling */}
                            <VehicleCountAlerts
                                apiUrl={ALERTS_API_URL}
                                showDateFilter={true}
                                showTodayStats={true}
                            />

                            {error && newsData.length === 0 ? (
                                <ErrorMessage />
                            ) : newsData.length > 0 && (
                                <View style={styles.newsSection}>
                                    <View style={styles.newsHeader}>
                                        <View style={styles.newsHeaderLeft}>
                                            <FontAwesome5 name="newspaper" size={responsiveFont(18)} color={Colors.secondary} />
                                            <Text style={styles.newsHeaderTitle}>Trending News</Text>
                                        </View>
                                        <Text style={styles.newsCounter}>
                                            {activeSlide + 1}/{newsData.length}
                                        </Text>
                                    </View>

                                    <ScrollView
                                        ref={scrollViewRef}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        decelerationRate="fast"
                                        snapToInterval={SNAP_INTERVAL}
                                        snapToAlignment="center"
                                        disableIntervalMomentum={true}
                                        onScroll={handleNewsScroll}
                                        scrollEventThrottle={16}
                                        contentContainerStyle={{ paddingHorizontal: SPACER_WIDTH }}
                                    >
                                        {newsData.map((item, index) => (
                                            <LinearGradient
                                                key={item.id || index}
                                                colors={[Colors.secondary, Colors.secondary, Colors.primary]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={[styles.newsCard, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
                                            >
                                                <View style={styles.newsCardContent}>
                                                    <View style={styles.newsCardHeader}>
                                                        <View style={styles.newsCardTextContainer}>
                                                            <View style={styles.featuredBadge}>
                                                                <FontAwesome5 name="globe-americas" size={responsiveFont(9)} color={Colors.white} />
                                                                <Text style={styles.featuredText}>Featured</Text>
                                                            </View>
                                                            <Text style={styles.newsTitle} numberOfLines={2}>
                                                                {item.title || "Latest Update"}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.trendingIcon}>
                                                            <Ionicons name="trending-up" size={responsiveFont(24)} color={Colors.primary} />
                                                        </View>
                                                    </View>
                                                    <Text style={styles.newsContent} numberOfLines={2}>
                                                        {item.content?.replace(/<[^>]*>?/gm, '') || "No content available"}
                                                    </Text>
                                                    <View style={styles.newsFooter}>
                                                        <View style={styles.dateContainer}>
                                                            <Ionicons name="time-outline" size={responsiveFont(11)} color={Colors.white} />
                                                            <Text style={styles.dateText}>
                                                                {new Date(item.created_at).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                })}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity style={styles.readButton} activeOpacity={0.7}>
                                                            <Text style={styles.readButtonText}>Read</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </LinearGradient>
                                        ))}
                                    </ScrollView>

                                    <View style={styles.dotIndicatorContainer}>
                                        {newsData.map((_, index) => (
                                            <View
                                                key={index}
                                                style={[
                                                    styles.dotIndicator,
                                                    activeSlide === index ? styles.dotActive : styles.dotInactive
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Phase 0 Static injected at bottom */}
                            <PremiumBanner />


                        </>
                    )}

                    
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles (All using Colors from theme) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.white },
    scrollView: { flex: 1 },
    scrollViewContent: { flexGrow: 1 },
    contentContainer: { flex: 1, paddingBottom: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(3) },
    skeletonContainer: { alignSelf: 'center', marginVertical: responsiveHeight(2), width: '90%' },
    skeletonCard: { minHeight: responsiveHeight(28), backgroundColor: Colors.muted, borderRadius: responsiveFont(24), marginBottom: responsiveHeight(4) },
    welcomeSection: { paddingHorizontal: responsiveWidth(5), paddingTop: responsiveHeight(1), marginBottom: responsiveHeight(2) },
    greeting: { fontSize: responsiveFont(14), color: Colors.accent, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1 },
    userName: { fontSize: responsiveFont(isSmallDevice ? 24 : 28), fontWeight: '800', color: Colors.secondary, marginTop: responsiveHeight(0.5) },
    
    statsScrollView: { marginBottom: responsiveHeight(2), paddingLeft: responsiveWidth(5) },
    statsRow: { flexDirection: 'row', gap: responsiveWidth(3), paddingRight: responsiveWidth(5) },
    statCard: { width: responsiveWidth(28), borderRadius: responsiveFont(16), padding: responsiveWidth(3), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    statCardContent: { alignItems: 'center' },
    statIconContainer: { width: responsiveWidth(10), height: responsiveWidth(10), borderRadius: responsiveWidth(5), alignItems: 'center', justifyContent: 'center', marginBottom: responsiveHeight(1) },
    statLabel: { fontSize: responsiveFont(11), color: Colors.accent, marginBottom: responsiveHeight(0.5) },
    statMainValue: { fontSize: responsiveFont(20), fontWeight: 'bold', color: Colors.white, marginBottom: responsiveHeight(0.5) },
    statTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    statTrendText: { fontSize: responsiveFont(10), color: '#10B981' },
    
    quickStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: responsiveWidth(5), marginBottom: responsiveHeight(3), gap: responsiveWidth(2) },
    quickStatItem: { width: '48%', backgroundColor: Colors.surface, borderRadius: responsiveFont(16), padding: responsiveHeight(2), alignItems: 'center', borderWidth: 1, borderColor: Colors.muted },
    quickStatIcon: { width: responsiveWidth(11), height: responsiveWidth(11), borderRadius: responsiveWidth(5.5), alignItems: 'center', justifyContent: 'center', marginBottom: responsiveHeight(1) },
    quickStatValue: { fontSize: responsiveFont(18), fontWeight: 'bold', color: Colors.secondary },
    quickStatLabel: { fontSize: responsiveFont(11), color: Colors.accent, marginTop: responsiveHeight(0.5) },
    
    amberCard: { marginTop: 15, backgroundColor: Colors.primary, padding: responsiveWidth(6), borderRadius: responsiveFont(24), marginHorizontal: responsiveWidth(5), marginBottom: responsiveHeight(3), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: responsiveHeight(1) }, shadowOpacity: 0.3, shadowRadius: responsiveFont(15) },
    amberCardContent: { flex: 1 },
    cardTitle: { color: Colors.white, fontSize: responsiveFont(16), fontWeight: '500', opacity: 0.9 },
    cardValue: { color: Colors.white, fontSize: responsiveFont(isSmallDevice ? 32 : 36), fontWeight: '900', marginVertical: responsiveHeight(0.5) },
    cardSub: { color: Colors.white, fontSize: responsiveFont(13), opacity: 0.8 },
    cardGraphic: { width: responsiveWidth(15), height: responsiveWidth(15), borderRadius: responsiveWidth(7.5), backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' },
    cardGraphicText: { color: Colors.white, fontSize: responsiveFont(16), fontWeight: 'bold' },
    
    sectionTitle: { fontSize: responsiveFont(20), fontWeight: '700', color: Colors.secondary, marginBottom: responsiveHeight(2), marginHorizontal: responsiveWidth(5) },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: responsiveWidth(5), gap: responsiveWidth(3) },
    actionItem: { width: isTablet ? '31%' : '47%', backgroundColor: Colors.surface, paddingVertical: responsiveHeight(3), paddingHorizontal: responsiveWidth(4), borderRadius: responsiveFont(20), alignItems: 'center', marginBottom: responsiveHeight(2.5), borderWidth: 1, borderColor: Colors.muted },
    iconCircle: { width: responsiveWidth(14), height: responsiveWidth(14), borderRadius: responsiveFont(18), backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: responsiveHeight(1.5), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
    actionText: { fontSize: responsiveFont(15), fontWeight: '700', color: Colors.secondary, textAlign: 'center' },
    alertWrapper: { marginVertical: responsiveHeight(1.5) },
    newsSection: { marginBottom: responsiveHeight(4) },
    newsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: responsiveHeight(2), paddingHorizontal: responsiveWidth(5) },
    newsHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    newsHeaderTitle: { fontSize: responsiveFont(20), fontWeight: 'bold', color: Colors.secondary, marginLeft: responsiveWidth(2) },
    newsCounter: { color: Colors.accent, fontSize: responsiveFont(14) },
    newsCard: { marginRight: responsiveWidth(2.5), borderRadius: responsiveFont(24), overflow: 'hidden', elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 16 },
    newsCardContent: { padding: responsiveWidth(5), flex: 1 },
    newsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: responsiveHeight(1.5) },
    newsCardTextContainer: { flex: 1, paddingRight: responsiveWidth(3) },
    featuredBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: responsiveWidth(3), paddingVertical: responsiveHeight(0.5), borderRadius: responsiveFont(20), alignSelf: 'flex-start', marginBottom: responsiveHeight(1) },
    featuredText: { color: Colors.white, fontSize: responsiveFont(9), fontWeight: 'bold', textTransform: 'uppercase', marginLeft: responsiveWidth(2) },
    newsTitle: { color: Colors.white, fontSize: responsiveFont(16), fontWeight: 'bold', lineHeight: responsiveFont(20), marginBottom: responsiveHeight(1) },
    trendingIcon: { backgroundColor: 'rgba(255,255,255,0.1)', width: responsiveWidth(12), height: responsiveWidth(12), borderRadius: responsiveWidth(6), justifyContent: 'center', alignItems: 'center' },
    newsContent: { color: 'rgba(255,255,255,0.7)', fontSize: responsiveFont(12), marginBottom: responsiveHeight(2), lineHeight: responsiveFont(16) },
    newsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateContainer: { flexDirection: 'row', alignItems: 'center' },
    dateText: { color: 'rgba(255,255,255,0.6)', fontSize: responsiveFont(10), marginLeft: responsiveWidth(1.5) },
    readButton: { backgroundColor: Colors.primary, paddingHorizontal: responsiveWidth(3), paddingVertical: responsiveHeight(0.8), borderRadius: responsiveFont(12) },
    readButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: responsiveFont(12) },
    dotIndicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: responsiveHeight(2) },
    dotIndicator: { height: responsiveHeight(0.8), marginHorizontal: responsiveWidth(1.5), borderRadius: responsiveFont(3) },
    dotActive: { width: responsiveWidth(5), backgroundColor: Colors.primary },
    dotInactive: { width: responsiveWidth(1.5), backgroundColor: Colors.accent },
    bannerWrapper: { paddingHorizontal: responsiveWidth(5), paddingBottom: Platform.OS === 'ios' ? responsiveHeight(5) : responsiveHeight(4), marginBottom: 20 },
    premiumBanner: { borderRadius: responsiveFont(24), overflow: 'hidden', elevation: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16 },
    bannerContent: { paddingTop: responsiveHeight(4), paddingBottom: responsiveHeight(1), paddingHorizontal: responsiveWidth(5) },
    bannerHeader: { alignItems: 'center', marginBottom: responsiveHeight(4) },
    bannerIconContainer: { backgroundColor: 'rgba(255,255,255,0.1)', padding: responsiveWidth(3), borderRadius: responsiveFont(30), marginBottom: responsiveHeight(2) },
    bannerTitle: { color: Colors.white, fontSize: responsiveFont(isSmallDevice ? 16 : 18), fontWeight: '600', textAlign: 'center', marginBottom: responsiveHeight(0.5) },
    bannerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: responsiveFont(14), textAlign: 'center' },
    infoCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: responsiveFont(16), padding: responsiveWidth(5), marginBottom: responsiveHeight(3) },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: responsiveHeight(1.5) },
    infoTextContainer: { marginLeft: responsiveWidth(3), flex: 1 },
    infoTitle: { color: Colors.white, fontWeight: 'bold', fontSize: responsiveFont(16), marginBottom: responsiveHeight(0.5) },
    infoText: { color: 'rgba(255,255,255,0.9)', fontSize: responsiveFont(14) },
    flagContainer: { flexDirection: 'row', alignItems: 'center', marginTop: responsiveHeight(1) },
    flagText: { color: 'rgba(255,255,255,0.8)', fontSize: responsiveFont(12), marginLeft: responsiveWidth(2) },
    contactRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: responsiveHeight(3), flexWrap: 'wrap' },
    contactItem: { alignItems: 'center', flex: 1 },
    contactText: { color: Colors.white, fontSize: responsiveFont(10), marginTop: responsiveHeight(0.5), textAlign: 'center' },
    footer: { alignItems: 'center', paddingTop: responsiveHeight(2), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    footerText: { color: 'rgba(255,255,255,0.6)', fontSize: responsiveFont(10) },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: responsiveHeight(10), paddingHorizontal: responsiveWidth(5) },
    errorText: { fontSize: responsiveFont(16), color: Colors.accent, textAlign: 'center', marginTop: responsiveHeight(2), marginBottom: responsiveHeight(3) },
    retryButton: { backgroundColor: Colors.primary, paddingHorizontal: responsiveWidth(8), paddingVertical: responsiveHeight(1.5), borderRadius: responsiveFont(12) },
    retryButtonText: { color: Colors.white, fontSize: responsiveFont(14), fontWeight: '600' },
    softwareDescription: {
        fontSize: responsiveFont(11),
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 16,
        marginTop: responsiveHeight(0.5),
        marginBottom: responsiveHeight(1),
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: responsiveHeight(0.5),
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    statusText: {
        fontSize: responsiveFont(9),
        color: 'rgba(255,255,255,0.6)',
    },
});

export default Dashboard;