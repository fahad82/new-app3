import { AntDesign, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import SeeAllAlertsModal from './SeeAllAlertsModal';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const responsiveWidth = (percentage: number) => (SCREEN_WIDTH * percentage) / 100;
const responsiveHeight = (percentage: number) => (SCREEN_HEIGHT * percentage) / 100;
const responsiveFont = (size: number) => {
    const scaleFactor = Math.min(SCREEN_WIDTH / 375, 1.15);
    return Math.round(size * scaleFactor);
};

const ALERT_CARD_WIDTH = SCREEN_WIDTH * 0.75;
const ALERT_SPACING = 12;

// Alert type configuration
const ALERT_TYPES_CONFIG = {
    UNUSUAL_HALTS: {
        title: 'Unusual Halts',
        icon: 'car-sport-outline',
        iconSet: Ionicons,
        iconColor: Colors.primary,
        description: 'Vehicle stopped unexpectedly',
        priority: 'High',
        priorityColor: '#D32F2F',
    },
    ROUTE_DEVIATION: {
        title: 'Route Deviation',
        icon: 'navigate-outline',
        iconSet: Ionicons,
        iconColor: Colors.primary,
        description: 'Vehicle deviated from route',
        priority: 'High',
        priorityColor: '#D32F2F',
    },
    DOOR_OPEN: {
        title: 'Door Open',
        icon: 'door-open',
        iconSet: FontAwesome5,
        iconColor: Colors.primary,
        description: 'Vehicle door opened unexpectedly',
        priority: 'Medium',
        priorityColor: Colors.primary,
    },
    UNSYNC: {
        title: 'Device Unsync',
        icon: 'sync-disabled',
        iconSet: MaterialIcons,
        iconColor: Colors.primary,
        description: 'Device synchronization lost',
        priority: 'Low',
        priorityColor: '#10B981',
    },
    DEATTACH_DEVICE: {
        title: 'Device Detached',
        icon: 'device-unknown',
        iconSet: MaterialIcons,
        iconColor: Colors.primary,
        description: 'Tracking device detached',
        priority: 'High',
        priorityColor: '#D32F2F',
    },
};

interface AlertData {
    alert_category: string;
    generated: number;
    closed: number;
    today_generated: number;
    today_closed: number;
    first_date: string;
    last_date: string;
    pending: number;
    today_pending: number;
}

interface TotalsData {
    overall: {
        generated: number;
        closed: number;
        pending: number;
    };
    today: {
        generated: number;
        closed: number;
        pending: number;
    };
}

interface VehicleCountAlertsProps {
    apiUrl?: string;
    showDateFilter?: boolean;
    showTodayStats?: boolean;
}

// Circular Progress component - clean light style
const CircularProgress = ({
    progress,
    size = 56,
    strokeWidth = 5,
    strokeColor = Colors.primary,
    backgroundColor = '#EEEEEE',
    showText = true
}: {
    progress: number;
    size?: number;
    strokeWidth?: number;
    strokeColor?: string;
    backgroundColor?: string;
    showText?: boolean;
}) => {
    return (
        <View style={{ width: size, height: size, position: 'relative' }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: backgroundColor,
                    position: 'absolute',
                }}
            />
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: strokeColor,
                    borderLeftColor: 'transparent',
                    borderBottomColor: progress > 0.5 ? strokeColor : 'transparent',
                    borderRightColor: progress > 0.25 ? strokeColor : 'transparent',
                    borderTopColor: progress > 0.75 ? strokeColor : strokeColor,
                    transform: [{ rotate: `${progress * 360}deg` }],
                    position: 'absolute',
                }}
            />
            {showText && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: Colors.secondary, fontSize: size * 0.22, fontWeight: '800' }}>
                        {Math.round(progress * 100)}%
                    </Text>
                </View>
            )}
        </View>
    );
};

const VehicleCountAlerts: React.FC<VehicleCountAlertsProps> = ({
    showDateFilter = true,
    showTodayStats = true,
}) => {
    const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ||
        Constants.expoConfig?.extra?.baseUrl ||
        "https://vtssmartsolutions.com";
    const apiUrl = `${BASE_URL}/api/mobile/alerts/daily-counts`;

    const [alertsData, setAlertsData] = useState<AlertData[]>([]);
    const [totals, setTotals] = useState<TotalsData>({
        overall: { generated: 0, closed: 0, pending: 0 },
        today: { generated: 0, closed: 0, pending: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [serverToday, setServerToday] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [dateRange, setDateRange] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const alertsScrollRef = useRef<ScrollView>(null);
    const [showAllModal, setShowAllModal] = useState(false);
    const isMountedRef = useRef(true);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

    // Fetch alerts data from API
    const fetchAlertsData = useCallback(async () => {
        if (!isMountedRef.current) return;
        try {
            setLoading(true);
            setError(null);

            let url = apiUrl;
            const params = new URLSearchParams();

            if (dateRange.startDate) {
                params.append('start_date', dateRange.startDate.toISOString().split('T')[0]);
            }
            if (dateRange.endDate) {
                params.append('end_date', dateRange.endDate.toISOString().split('T')[0]);
            }

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (isMountedRef.current) {
                if (data.success) {
                    setAlertsData(data.data || []);
                    setTotals({
                        overall: data.totals?.overall || { generated: 0, closed: 0, pending: 0 },
                        today: data.totals?.today || { generated: 0, closed: 0, pending: 0 }
                    });
                    setServerToday(data.server_today || '');
                    setLastUpdated(new Date());
                } else {
                    setAlertsData([]);
                    setTotals({
                        overall: { generated: 0, closed: 0, pending: 0 },
                        today: { generated: 0, closed: 0, pending: 0 }
                    });
                    setError(data.message || 'Failed to fetch alerts');
                }
            }
        } catch (error: any) {
            if (isMountedRef.current) {
                console.error('Error fetching alerts:', error);
                setError(error.name === 'AbortError' ? 'Request timeout' : 'Network error');
                setAlertsData([]);
                setTotals({
                    overall: { generated: 0, closed: 0, pending: 0 },
                    today: { generated: 0, closed: 0, pending: 0 }
                });
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [apiUrl, dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        isMountedRef.current = true;
        fetchAlertsData();

        // 10-minute auto-refresh
        refreshTimerRef.current = setInterval(() => {
            if (isMountedRef.current) fetchAlertsData();
        }, REFRESH_INTERVAL);

        // Refresh when app becomes active
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && isMountedRef.current) fetchAlertsData();
        });

        return () => {
            isMountedRef.current = false;
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
            subscription.remove();
        };
    }, [fetchAlertsData]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAlertsData();
    }, [fetchAlertsData]);

    const handleStartDateConfirm = (date: Date) => {
        setDateRange(prev => ({ ...prev, startDate: date }));
        setShowStartPicker(false);
    };

    const handleEndDateConfirm = (date: Date) => {
        setDateRange(prev => ({ ...prev, endDate: date }));
        setShowEndPicker(false);
    };

    const clearDateFilter = () => {
        setDateRange({ startDate: null, endDate: null });
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 0.8) return '#10B981';
        if (progress >= 0.6) return Colors.primary;
        return '#D32F2F';
    };

    const formatDisplayNumber = (num: number | undefined | null): string => {
        if (num === undefined || num === null) return '0';
        return num.toString();
    };

    const getCompletionRate = (alert: AlertData) => {
        if (alert?.generated > 0) return alert.closed / alert.generated;
        return 0;
    };

    const getAlertConfig = (type: string) => {
        if (type && ALERT_TYPES_CONFIG[type as keyof typeof ALERT_TYPES_CONFIG]) {
            return ALERT_TYPES_CONFIG[type as keyof typeof ALERT_TYPES_CONFIG];
        }
        const safeType = type || 'Unknown Alert';
        return {
            title: safeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            icon: 'alert-circle-outline',
            iconSet: Ionicons,
            iconColor: Colors.primary,
            description: 'Alert detected',
            priority: 'Medium',
            priorityColor: Colors.primary,
        };
    };

    const getTimeAgo = (dateString?: string) => {
        if (!dateString) return 'Recently';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    };

    const getTodayReadable = () => {
        if (serverToday) {
            const date = new Date(serverToday);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
        return new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const todayTotals = totals?.today || { generated: 0, closed: 0, pending: 0 };
    const overallTotals = totals?.overall || { generated: 0, closed: 0, pending: 0 };

    // Show error state
    if (error && !loading) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#D32F2F" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchAlertsData}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* Header Section - Clean light style */}
            <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                    <View style={styles.sectionIconWrapper}>
                        <Ionicons name="notifications" size={responsiveFont(18)} color={Colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.sectionTitle}>Alert Summary</Text>
                        <Text style={styles.sectionSubtitle}>Real-time vehicle alerts & notifications</Text>
                    </View>
                </View>
                <View style={styles.sectionHeaderRight}>
                    {lastUpdated && (
                        <Text style={styles.lastUpdatedText}>
                            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                    <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} activeOpacity={0.7}>
                        <Ionicons name="refresh" size={responsiveFont(14)} color={Colors.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Date Filter & See All Row */}
            <View style={styles.actionRow}>
                {showDateFilter && (
                    <View style={styles.dateFilterContainer}>
                        <TouchableOpacity
                            onPress={() => setShowStartPicker(true)}
                            style={styles.dateButton}
                        >
                            <Ionicons name="calendar-outline" size={13} color={Colors.secondary} />
                            <Text style={styles.dateButtonText}>
                                {formatDate(dateRange.startDate)}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.dateToText}>to</Text>

                        <TouchableOpacity
                            onPress={() => setShowEndPicker(true)}
                            style={styles.dateButton}
                        >
                            <Ionicons name="calendar-outline" size={13} color={Colors.secondary} />
                            <Text style={styles.dateButtonText}>
                                {formatDate(dateRange.endDate)}
                            </Text>
                        </TouchableOpacity>

                        {(dateRange.startDate || dateRange.endDate) && (
                            <TouchableOpacity onPress={clearDateFilter} style={styles.clearButton}>
                                <Ionicons name="close-circle" size={18} color="#D32F2F" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <TouchableOpacity
                    style={styles.seeAllButton}
                    onPress={() => setShowAllModal(true)}
                >
                    <Text style={styles.seeAllText}>See All</Text>
                    <AntDesign name="right" size={12} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Loading State */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading alerts...</Text>
                </View>
            ) : (
                <>
                    {/* Today's Stats Banner - Clean light style */}
                    {showTodayStats && todayTotals.generated > 0 && (
                        <View style={styles.todayBanner}>
                            <View style={styles.todayBannerContent}>
                                <View style={styles.todayBannerLeft}>
                                    <View style={styles.todayIconContainer}>
                                        <Ionicons name="today-outline" size={18} color={Colors.primary} />
                                    </View>
                                    <View style={styles.todayTextContainer}>
                                        <Text style={styles.todayActivityText}>
                                            Today's Activity
                                        </Text>
                                        <Text style={styles.todayDateText}>
                                            {getTodayReadable()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.todayMiniStats}>
                                    <View style={styles.todayMiniItem}>
                                        <Text style={styles.todayMiniValue}>{formatDisplayNumber(todayTotals.generated)}</Text>
                                        <Text style={styles.todayMiniLabel}>New</Text>
                                    </View>
                                    <View style={styles.todayMiniItem}>
                                        <Text style={styles.todayMiniValue}>{formatDisplayNumber(todayTotals.closed)}</Text>
                                        <Text style={styles.todayMiniLabel}>Done</Text>
                                    </View>
                                    <View style={styles.todayMiniItem}>
                                        <Text style={styles.todayMiniValue}>{formatDisplayNumber(todayTotals.pending)}</Text>
                                        <Text style={styles.todayMiniLabel}>Pending</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Alerts Cards Scroll */}
                    <ScrollView
                        ref={alertsScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.alertsScrollView}
                        decelerationRate="fast"
                    >
                        <View style={styles.cardsContainer}>
                            {alertsData.length > 0 ? (
                                alertsData.map((alert, index) => {
                                    if (!alert) return null;
                                    const config = getAlertConfig(alert.alert_category);
                                    const IconComponent = config.iconSet;
                                    const progress = getCompletionRate(alert);
                                    const progressColor = getProgressColor(progress);

                                    return (
                                        <View
                                            key={`${alert.alert_category}-${index}`}
                                            style={styles.alertCard}
                                        >
                                            <View style={styles.cardContent}>
                                                {/* Header with icon and progress circle */}
                                                <View style={styles.cardHeader}>
                                                    <View style={styles.cardHeaderLeft}>
                                                        <View style={styles.cardIconContainer}>
                                                            <IconComponent name={config.icon as any} size={24} color={config.iconColor} />
                                                        </View>
                                                        <View style={styles.cardHeaderTextContainer}>
                                                            <Text style={styles.cardTitle}>
                                                                {config.title}
                                                            </Text>
                                                            <Text style={styles.cardDescription}>
                                                                {config.description}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <CircularProgress
                                                        progress={progress}
                                                        size={56}
                                                        strokeWidth={5}
                                                        strokeColor={progressColor}
                                                        backgroundColor="#EEEEEE"
                                                        showText={true}
                                                    />
                                                </View>

                                                {/* Overall Stats Row */}
                                                <View style={styles.overallStatsContainer}>
                                                    <Text style={styles.sectionLabel}>OVERALL</Text>
                                                    <View style={styles.statsRow}>
                                                        <View style={styles.statItem}>
                                                            <Text style={styles.statLabel}>Generated</Text>
                                                            <Text style={styles.statValue}>
                                                                {formatDisplayNumber(alert.generated)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.statItem}>
                                                            <Text style={styles.statLabel}>Resolved</Text>
                                                            <Text style={styles.statValue}>
                                                                {formatDisplayNumber(alert.closed)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.statItem}>
                                                            <Text style={styles.statLabel}>Pending</Text>
                                                            <Text style={styles.statValue}>
                                                                {formatDisplayNumber(alert.pending)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Today's Stats Row */}
                                                {showTodayStats && (
                                                    <View style={styles.todayStatsContainer}>
                                                        <Text style={styles.sectionLabel}>TODAY</Text>
                                                        <View style={styles.statsRow}>
                                                            <View style={styles.statItem}>
                                                                <Text style={styles.statLabel}>Generated</Text>
                                                                <Text style={styles.todayStatValue}>
                                                                    {formatDisplayNumber(alert.today_generated)}
                                                                </Text>
                                                            </View>
                                                            <View style={styles.statItem}>
                                                                <Text style={styles.statLabel}>Resolved</Text>
                                                                <Text style={styles.todayStatValue}>
                                                                    {formatDisplayNumber(alert.today_closed)}
                                                                </Text>
                                                            </View>
                                                            <View style={styles.statItem}>
                                                                <Text style={styles.statLabel}>Pending</Text>
                                                                <Text style={styles.todayStatValue}>
                                                                    {formatDisplayNumber(alert.today_pending)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                )}

                                                {/* Footer with time and priority */}
                                                <View style={styles.cardFooter}>
                                                    <View style={styles.timeContainer}>
                                                        <Ionicons name="time-outline" size={13} color={Colors.accent} />
                                                        <Text style={styles.timeText}>
                                                            {getTimeAgo(alert.last_date)}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.priorityContainer, { backgroundColor: config.priorityColor + '15' }]}>
                                                        <View style={[styles.priorityDot, { backgroundColor: config.priorityColor }]} />
                                                        <Text style={[styles.priorityText, { color: config.priorityColor }]}>
                                                            {config.priority}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                            {/* Left amber accent border */}
                                            <View style={styles.cardLeftAccent} />
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyStateContainer}>
                                    <View style={styles.emptyStateContent}>
                                        <Ionicons name="notifications-off-outline" size={40} color={Colors.accent} />
                                        <Text style={styles.emptyStateTitle}>No alerts found</Text>
                                        <Text style={styles.emptyStateSubtitle}>
                                            {dateRange.startDate || dateRange.endDate
                                                ? 'Try adjusting your date filter'
                                                : 'No alerts in the system'
                                            }
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <SeeAllAlertsModal
                        visible={showAllModal}
                        onClose={() => setShowAllModal(false)}
                    />

                    {/* Overall Summary Card - Clean light style */}
                    {alertsData.length > 0 && (
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryHeader}>
                                <Text style={styles.summaryTitle}>Overall Summary</Text>
                                <LinearGradient
                                    colors={[Colors.primary, '#F3AD6D']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.summaryBadge}
                                >
                                    <Text style={styles.summaryBadgeText}>
                                        {alertsData.length} alert types
                                    </Text>
                                </LinearGradient>
                            </View>

                            {/* Overall Stats */}
                            <View style={styles.summaryStatsContainer}>
                                <View style={styles.summaryStatItem}>
                                    <View style={styles.summaryIconContainer}>
                                        <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.summaryStatLabel}>Total Generated</Text>
                                    <Text style={styles.summaryStatValue}>
                                        {formatDisplayNumber(overallTotals.generated)}
                                    </Text>
                                </View>

                                <View style={styles.summaryDivider} />

                                <View style={styles.summaryStatItem}>
                                    <View style={styles.summaryIconContainer}>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                                    </View>
                                    <Text style={styles.summaryStatLabel}>Total Resolved</Text>
                                    <Text style={styles.summaryStatValue}>
                                        {formatDisplayNumber(overallTotals.closed)}
                                    </Text>
                                </View>

                                <View style={styles.summaryDivider} />

                                <View style={styles.summaryStatItem}>
                                    <View style={styles.summaryIconContainer}>
                                        <Ionicons name="time-outline" size={20} color="#D32F2F" />
                                    </View>
                                    <Text style={styles.summaryStatLabel}>Total Pending</Text>
                                    <Text style={styles.summaryStatValue}>
                                        {formatDisplayNumber(overallTotals.pending)}
                                    </Text>
                                </View>
                            </View>

                            {/* Today's Stats - Mini version */}
                            {showTodayStats && todayTotals.generated > 0 && (
                                <View style={styles.miniTodayContainer}>
                                    <View style={styles.miniTodayHeader}>
                                        <Ionicons name="today-outline" size={14} color={Colors.primary} />
                                        <Text style={styles.miniTodayLabel}>Today's Activity</Text>
                                    </View>
                                    <View style={styles.miniTodayStats}>
                                        <View style={styles.miniStatItem}>
                                            <Text style={styles.miniStatLabel}>Generated</Text>
                                            <Text style={styles.miniStatValue}>
                                                {formatDisplayNumber(todayTotals.generated)}
                                            </Text>
                                        </View>
                                        <View style={styles.miniStatItem}>
                                            <Text style={styles.miniStatLabel}>Resolved</Text>
                                            <Text style={styles.miniStatValue}>
                                                {formatDisplayNumber(todayTotals.closed)}
                                            </Text>
                                        </View>
                                        <View style={styles.miniStatItem}>
                                            <Text style={styles.miniStatLabel}>Pending</Text>
                                            <Text style={styles.miniStatValue}>
                                                {formatDisplayNumber(todayTotals.pending)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </>
            )}

            {/* Date Pickers */}
            <DateTimePickerModal
                isVisible={showStartPicker}
                mode="date"
                date={dateRange.startDate || new Date()} // Provide a default date
                onConfirm={handleStartDateConfirm}
                onCancel={() => setShowStartPicker(false)}
                maximumDate={dateRange.endDate || new Date()}
            />

            <DateTimePickerModal
                isVisible={showEndPicker}
                mode="date"
                date={dateRange.endDate || new Date()} // Provide a default date
                onConfirm={handleEndDateConfirm}
                onCancel={() => setShowEndPicker(false)}
                minimumDate={dateRange.startDate || undefined}
                maximumDate={new Date()}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        marginBottom: 32,
        backgroundColor: Colors.surface,
    },

    // Section Header - matching dashboard slider style
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: responsiveWidth(5),
        marginBottom: responsiveHeight(1.5),
        paddingTop: responsiveHeight(2),
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

    // Action Row
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: responsiveWidth(5),
        marginBottom: 12,
    },

    // Date Filter
    dateFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    dateButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.secondary,
        marginLeft: 5,
    },
    dateToText: {
        fontSize: 12,
        color: Colors.accent,
        fontWeight: '500',
    },
    clearButton: {
        padding: 4,
    },

    // See All Button
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: 'rgba(239, 142, 51, 0.3)',
    },
    seeAllText: {
        fontWeight: '600',
        fontSize: 13,
        color: Colors.primary,
        marginRight: 4,
    },

    // Loading
    loadingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    loadingText: {
        marginLeft: 12,
        color: Colors.accent,
        fontSize: 14,
    },

    // Today Banner
    todayBanner: {
        marginHorizontal: responsiveWidth(5),
        marginBottom: 14,
        padding: 14,
        borderRadius: 14,
        backgroundColor: Colors.white,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
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
    todayBannerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    todayBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    todayIconContainer: {
        backgroundColor: 'rgba(239, 142, 51, 0.08)',
        padding: 8,
        borderRadius: 8,
        marginRight: 10,
    },
    todayTextContainer: {
        flex: 1,
    },
    todayActivityText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.secondary,
    },
    todayDateText: {
        fontSize: 11,
        color: Colors.accent,
        fontWeight: '500',
        marginTop: 2,
    },
    todayMiniStats: {
        flexDirection: 'row',
        gap: 12,
    },
    todayMiniItem: {
        alignItems: 'center',
    },
    todayMiniValue: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.secondary,
    },
    todayMiniLabel: {
        fontSize: 10,
        color: Colors.accent,
        fontWeight: '600',
    },

    // Alerts ScrollView
    alertsScrollView: {
        marginBottom: 8,
    },
    cardsContainer: {
        flexDirection: 'row',
        paddingBottom: 16,
        paddingLeft: responsiveWidth(5),
    },

    // Alert Card - Clean light style
    alertCard: {
        width: ALERT_CARD_WIDTH,
        marginRight: ALERT_SPACING,
        minHeight: 260,
        padding: 16,
        borderRadius: 16,
        backgroundColor: Colors.white,
        overflow: 'hidden',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        ...Platform.select({
            ios: {
                shadowColor: Colors.secondary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
            android: { elevation: 3 },
        }),
    },
    cardLeftAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: Colors.primary,
    },
    cardContent: {
        flex: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        marginRight: 12,
    },
    cardIconContainer: {
        backgroundColor: 'rgba(239, 142, 51, 0.08)',
        padding: 10,
        borderRadius: 10,
        marginRight: 10,
    },
    cardHeaderTextContainer: {
        flex: 1,
    },
    cardTitle: {
        color: Colors.secondary,
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    cardDescription: {
        color: Colors.accent,
        fontSize: 12,
        fontWeight: '500',
    },
    overallStatsContainer: {
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    sectionLabel: {
        color: Colors.accent,
        fontSize: 10,
        marginBottom: 6,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        color: Colors.accent,
        fontSize: 10,
        marginBottom: 2,
        fontWeight: '500',
    },
    statValue: {
        color: Colors.secondary,
        fontSize: 18,
        fontWeight: '800',
    },
    todayStatsContainer: {
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    todayStatValue: {
        color: Colors.secondary,
        fontSize: 16,
        fontWeight: '800',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    timeText: {
        color: Colors.accent,
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 5,
    },
    priorityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    priorityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    priorityText: {
        fontSize: 11,
        fontWeight: '700',
    },

    // Empty State
    emptyStateContainer: {
        width: ALERT_CARD_WIDTH,
        marginRight: ALERT_SPACING,
    },
    emptyStateContent: {
        backgroundColor: Colors.white,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        height: 192,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    emptyStateTitle: {
        fontWeight: '600',
        color: Colors.secondary,
        marginTop: 12,
    },
    emptyStateSubtitle: {
        fontSize: 12,
        color: Colors.accent,
        marginTop: 4,
        textAlign: 'center',
    },

    // Summary Card
    summaryCard: {
        marginHorizontal: responsiveWidth(5),
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginTop: 8,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        ...Platform.select({
            ios: {
                shadowColor: Colors.secondary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
            },
            android: { elevation: 2 },
        }),
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    summaryTitle: {
        color: Colors.secondary,
        fontSize: 15,
        fontWeight: '700',
    },
    summaryBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    summaryBadgeText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '700',
    },
    summaryStatsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    summaryStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryDivider: {
        width: 1,
        backgroundColor: '#F0F0F0',
    },
    summaryIconContainer: {
        backgroundColor: 'rgba(239, 142, 51, 0.08)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 6,
    },
    summaryStatLabel: {
        color: Colors.accent,
        fontSize: 10,
        fontWeight: '500',
    },
    summaryStatValue: {
        color: Colors.secondary,
        fontSize: 20,
        fontWeight: '800',
        marginTop: 2,
    },
    miniTodayContainer: {
        marginTop: 4,
        backgroundColor: Colors.surface,
        padding: 10,
        borderRadius: 10,
    },
    miniTodayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    miniTodayLabel: {
        color: Colors.secondary,
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    miniTodayStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    miniStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    miniStatLabel: {
        color: Colors.accent,
        fontSize: 10,
        fontWeight: '500',
    },
    miniStatValue: {
        color: Colors.secondary,
        fontSize: 14,
        fontWeight: '700',
    },

    // Error State
    errorContainer: {
        backgroundColor: Colors.white,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginVertical: 20,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    errorText: {
        fontSize: 14,
        color: Colors.accent,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 16,
        fontWeight: '500',
    },
    retryButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: 14,
    },
});

export default VehicleCountAlerts;