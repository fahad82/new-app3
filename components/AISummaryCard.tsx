// AIChatSummary.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
    Platform,
    ScrollView,
    Animated,
    LayoutAnimation,
    UIManager,
    RefreshControl,
    AppState,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const responsiveFont = (size: number) => Math.round(size * Math.min(SCREEN_WIDTH / 375, 1.15));

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Types for our summary data
interface SummaryMetrics {
    today: {
        trips: { total: number; completed: number; inProgress: number; completionRate: number };
        alerts: { generated: number; resolved: number; pending: number; resolutionRate: number };
        assets: { total: number; inUse: number; utilizationRate: number };
    };
    overall: {
        trips: { total: number; completed: number; inProgress: number; completionRate: number };
        alerts: { generated: number; resolved: number; pending: number; resolutionRate: number };
        assets: { total: number; inUse: number; utilizationRate: number };
    };
    insights: {
        title: string;
        description: string;
        type: 'positive' | 'warning' | 'neutral';
        trend: 'up' | 'down' | 'stable';
        action?: string;
    }[];
    lastUpdated: Date | null;
}

interface Message {
    id: string;
    text: string;
    isBot: boolean;
    timestamp: Date;
    type?: 'greeting' | 'insight' | 'summary' | 'action';
    insightData?: any;
}

interface AIChatSummaryProps {
    onRefresh?: () => void;
    autoRefreshInterval?: number; // in milliseconds
}

// Typing animation hook with cleanup
const useTypingAnimation = (text: string, isTyping: boolean, speed: number = 30) => {
    const [displayText, setDisplayText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const indexRef = useRef(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isMountedRef.current) return;
        
        if (!isTyping) {
            setDisplayText(text);
            setIsComplete(true);
            return;
        }

        if (text && text.length > 0) {
            indexRef.current = 0;
            setDisplayText('');
            setIsComplete(false);

            const typeNextChar = () => {
                if (!isMountedRef.current) return;
                
                if (indexRef.current < text.length) {
                    setDisplayText(text.substring(0, indexRef.current + 1));
                    indexRef.current++;
                    timeoutRef.current = setTimeout(typeNextChar, speed);
                } else {
                    setIsComplete(true);
                }
            };

            typeNextChar();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [text, isTyping, speed]);

    return { displayText, isComplete };
};

// Animated cursor component
const AnimatedCursor = () => {
    const [opacity] = useState(new Animated.Value(1));
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        const blink = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])
        );
        animRef.current = blink;
        blink.start();
        
        return () => {
            if (animRef.current) {
                animRef.current.stop();
            }
        };
    }, []);

    return (
        <Animated.View style={[styles.cursor, { opacity }]}>
            <Text style={styles.cursorText}>|</Text>
        </Animated.View>
    );
};

const AIChatSummary: React.FC<AIChatSummaryProps> = ({ 
    onRefresh, 
    autoRefreshInterval = 300000 // 5 minutes default
}) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summaryData, setSummaryData] = useState<SummaryMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'overall'>('today');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [showMetrics, setShowMetrics] = useState(false);
    const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [isOffline, setIsOffline] = useState(false);
    
    const scrollViewRef = useRef<ScrollView>(null);
    const chatEndRef = useRef<View>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMountedRef = useRef(true);
    const conversationTimeoutRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const BASE_URL = useMemo(() => {
        try {
            return process.env.EXPO_PUBLIC_BASE_URL ||
                Constants.expoConfig?.extra?.baseUrl ||
                "https://vtssmartsolutions.com";
        } catch (err) {
            console.error('Error getting BASE_URL:', err);
            return "https://vtssmartsolutions.com";
        }
    }, []);

    // Clear all conversation timeouts
    const clearConversationTimeouts = useCallback(() => {
        conversationTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
        conversationTimeoutRef.current = [];
    }, []);

    // Scroll to bottom of chat
    const scrollToBottom = useCallback(() => {
        if (!isMountedRef.current) return;
        
        setTimeout(() => {
            try {
                chatEndRef.current?.measureLayout(scrollViewRef.current as any, () => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, () => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                });
            } catch (err) {
                // Silently fail - component might be unmounting
            }
        }, 100);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isBotTyping, scrollToBottom]);

    // Auto-refresh setup
    useEffect(() => {
        if (autoRefreshInterval > 0 && !error) {
            refreshTimerRef.current = setInterval(() => {
                if (isMountedRef.current && !refreshing && !isBotTyping) {
                    fetchAllData();
                }
            }, autoRefreshInterval);
        }
        
        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, [autoRefreshInterval, error]);

    // App state listener for background/foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && isMountedRef.current && !refreshing && !isBotTyping) {
                // Refresh when app comes to foreground
                fetchAllData();
            }
        });
        
        return () => subscription.remove();
    }, []);

    // Network connectivity check
    const checkConnectivity = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('https://www.google.com', { 
                signal: controller.signal,
                method: 'HEAD',
            });
            
            clearTimeout(timeoutId);
            setIsOffline(!response.ok);
            return response.ok;
        } catch (err) {
            setIsOffline(true);
            return false;
        }
    }, []);

    // Generate AI response text based on data
    const generateBotMessage = useCallback((data: SummaryMetrics, period: 'today' | 'overall') => {
        try {
            const currentData = period === 'today' ? data.today : data.overall;
            
            const tripPerformance = currentData.trips.completionRate >= 80 ? "excellent" :
                                   currentData.trips.completionRate >= 60 ? "good" : "needs improvement";
            
            const alertStatus = currentData.alerts.resolutionRate >= 80 ? "well" :
                               currentData.alerts.resolutionRate >= 50 ? "moderately" : "slowly";
            
            const assetStatus = currentData.assets.utilizationRate >= 75 ? "highly efficient" :
                               currentData.assets.utilizationRate >= 50 ? "moderately utilized" : "underutilized";

            const greetings = [
                "👋 Hello! I've analyzed your data and here's what I found:",
                "🤖 AI Assistant here! Let me give you a quick overview:",
                "📊 Analysis complete! Here's your performance summary:",
                "🎯 I've crunched the numbers. Here's the verdict:",
            ];
            
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];

            const summary = `${currentData.trips.total.toLocaleString()} total trips with a ${currentData.trips.completionRate}% completion rate (${tripPerformance}). ` +
                           `${currentData.alerts.generated.toLocaleString()} alerts generated, ${currentData.alerts.resolutionRate}% resolved (${alertStatus}). ` +
                           `Asset utilization is at ${currentData.assets.utilizationRate}% (${assetStatus}).`;

            return { greeting, summary };
        } catch (err) {
            console.error('Error generating bot message:', err);
            return {
                greeting: "👋 Hello! I've analyzed your data.",
                summary: "System is operational. Check back for detailed metrics."
            };
        }
    }, []);

    // Generate insight messages
    const generateInsightMessages = useCallback((insights: any[]) => {
        try {
            return insights.map(insight => {
                let message = "";
                let action = "";
                
                switch (insight.type) {
                    case 'positive':
                        message = `✨ ${insight.title}: ${insight.description}`;
                        action = "Keep up the great work! 🎉";
                        break;
                    case 'warning':
                        message = `⚠️ ${insight.title}: ${insight.description}`;
                        action = "I recommend reviewing these items soon. Need help?";
                        break;
                    case 'neutral':
                        message = `ℹ️ ${insight.title}: ${insight.description}`;
                        action = "Everything is on track. Monitoring continues.";
                        break;
                    default:
                        message = `📊 ${insight.title}: ${insight.description}`;
                        action = "Continue monitoring operations.";
                }
                
                return {
                    title: insight.title,
                    description: message,
                    action: insight.action || action,
                    type: insight.type,
                    trend: insight.trend,
                };
            });
        } catch (err) {
            console.error('Error generating insight messages:', err);
            return [];
        }
    }, []);

    // Generate AI-powered insights with safe calculations
    const generateInsights = useCallback((data: any) => {
        const insights = [];
        
        try {
            // Trip performance insights
            if (data.todayTripCompletionRate >= 80) {
                insights.push({
                    title: 'Excellent Trip Performance',
                    description: `Today's trip completion rate of ${data.todayTripCompletionRate}% exceeds target.`,
                    type: 'positive',
                    trend: 'up',
                    action: "Consider rewarding the operations team for this achievement!",
                });
            } else if (data.todayTripCompletionRate >= 60) {
                insights.push({
                    title: 'Good Progress',
                    description: `${data.todayTripCompletionRate}% completion rate today with ${data.todayInProgressTrips || 0} trips in progress.`,
                    type: 'neutral',
                    trend: 'stable',
                    action: "Focus on completing the remaining trips to hit your target.",
                });
            } else if (data.todayTripCompletionRate > 0) {
                insights.push({
                    title: 'Completion Rate Needs Attention',
                    description: `Only ${data.todayTripCompletionRate}% of trips completed today.`,
                    type: 'warning',
                    trend: 'down',
                    action: `Review the ${data.todayInProgressTrips || 0} active trips to identify bottlenecks.`,
                });
            }

            // Alert resolution insights
            if (data.todayAlertResolutionRate >= 80) {
                insights.push({
                    title: 'Quick Alert Resolution',
                    description: `${data.todayAlertResolutionRate}% of today's alerts resolved promptly.`,
                    type: 'positive',
                    trend: 'up',
                    action: "Response team is performing exceptionally well!",
                });
            } else if (data.todayAlertResolutionRate >= 50) {
                insights.push({
                    title: 'Moderate Alert Response',
                    description: `${data.todayAlertResolutionRate}% resolution rate with ${data.todayAlertsPending || 0} alerts pending.`,
                    type: 'neutral',
                    trend: 'stable',
                    action: "Prioritize the pending alerts to improve response time.",
                });
            } else if ((data.todayAlertsPending || 0) > 0) {
                insights.push({
                    title: 'Alert Backlog Detected',
                    description: `${data.todayAlertsPending || 0} alerts pending resolution today.`,
                    type: 'warning',
                    trend: 'down',
                    action: `Escalate unresolved alerts: ${data.todayAlertsPending || 0} pending.`,
                });
            }

            // Asset utilization insights
            if (data.assetUtilizationRate >= 75) {
                insights.push({
                    title: 'High Asset Utilization',
                    description: `${data.assetUtilizationRate}% of fleet assets are actively in use.`,
                    type: 'positive',
                    trend: 'up',
                    action: "Great resource allocation! Consider preventive maintenance scheduling.",
                });
            } else if (data.assetUtilizationRate >= 50) {
                insights.push({
                    title: 'Moderate Fleet Usage',
                    description: `${data.assetUtilizationRate}% asset utilization rate.`,
                    type: 'neutral',
                    trend: 'stable',
                    action: "Opportunity to deploy idle assets for better ROI.",
                });
            } else if (data.assetUtilizationRate > 0) {
                insights.push({
                    title: 'Low Asset Utilization',
                    description: `Only ${data.assetUtilizationRate}% of assets in use.`,
                    type: 'warning',
                    trend: 'down',
                    action: "Review fleet deployment strategy immediately.",
                });
            }

            // Comparison insight
            if (data.todayTripCompletionRate > (data.overallTripCompletionRate + 10)) {
                insights.push({
                    title: 'Today Exceeds Average',
                    description: `Today's performance is ${Math.round(data.todayTripCompletionRate - data.overallTripCompletionRate)}% above historical average.`,
                    type: 'positive',
                    trend: 'up',
                    action: "Analyze what's working today and replicate it!",
                });
            }

            if (insights.length === 0) {
                insights.push({
                    title: 'System Operating Normally',
                    description: 'All metrics are within expected ranges.',
                    type: 'neutral',
                    trend: 'stable',
                    action: "Continue monitoring for optimal performance.",
                });
            }
        } catch (err) {
            console.error('Error generating insights:', err);
            insights.push({
                title: 'System Status',
                description: 'Unable to generate detailed insights at this moment.',
                type: 'neutral',
                trend: 'stable',
                action: "Check back later for detailed analysis.",
            });
        }

        return insights.slice(0, 3);
    }, []);

    // Fetch all necessary data from existing APIs
    const fetchAllData = useCallback(async () => {
        if (!isMountedRef.current) return;
        
        // Check connectivity first
        const isConnected = await checkConnectivity();
        if (!isConnected && !summaryData) {
            setError('No internet connection. Please check your network.');
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            setError(null);
            setShowMetrics(false);
            clearConversationTimeouts();
            
            // Clear previous messages and add loading indicator
            setMessages([{
                id: 'loading-' + Date.now(),
                text: "🤔 Analyzing your data...",
                isBot: true,
                timestamp: new Date(),
                type: 'greeting',
            }]);

            const tripStatsUrl = `${BASE_URL}/api/mobiledashboard/status-trip-counts`;
            const alertStatsUrl = `${BASE_URL}/api/mobile/alerts/daily-counts`;
            const assetStatsUrl = `${BASE_URL}/api/mobiledashboard/asset-utilization`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const [tripResponse, alertResponse, assetResponse] = await Promise.allSettled([
                fetch(tripStatsUrl, { signal: controller.signal }),
                fetch(alertStatsUrl, { signal: controller.signal }),
                fetch(assetStatsUrl, { signal: controller.signal }),
            ]);

            clearTimeout(timeoutId);

            // Process Trip Data with safe parsing
            let tripData = { today: {}, last_month: {}, last_6_months: {}, last_year: {} };
            if (tripResponse.status === 'fulfilled' && tripResponse.value && tripResponse.value.ok) {
                try {
                    const text = await tripResponse.value.text();
                    tripData = text ? JSON.parse(text) : tripData;
                } catch (parseErr) {
                    console.error('Error parsing trip data:', parseErr);
                }
            }

            // Process Alert Data
            let alertData = { data: [], totals: { overall: { generated: 0, closed: 0, pending: 0 }, today: { generated: 0, closed: 0, pending: 0 } } };
            if (alertResponse.status === 'fulfilled' && alertResponse.value && alertResponse.value.ok) {
                try {
                    const text = await alertResponse.value.text();
                    const alertJson = text ? JSON.parse(text) : null;
                    if (alertJson && alertJson.success) {
                        alertData = alertJson;
                    }
                } catch (parseErr) {
                    console.error('Error parsing alert data:', parseErr);
                }
            }

            // Process Asset Data
            let assetData = { pmd: { total: 0, in_use: 0 }, csd: { total: 0, in_use: 0 }, eseal: { total: 0, in_use: 0 } };
            if (assetResponse.status === 'fulfilled' && assetResponse.value && assetResponse.value.ok) {
                try {
                    const text = await assetResponse.value.text();
                    assetData = text ? JSON.parse(text) : assetData;
                } catch (parseErr) {
                    console.error('Error parsing asset data:', parseErr);
                }
            }

            // Calculate metrics with safe defaults
            interface TripData {
                planned?: number;
                started?: number;
                approved?: number;
                completed?: number;
            }
            const todayTrips: TripData = tripData.today || {};
            const todayTotalTrips = (todayTrips.planned || 0) + (todayTrips.started || 0) +
                (todayTrips.approved || 0) + (todayTrips.completed || 0);
            const todayCompletedTrips = todayTrips.completed || 0;
            const todayInProgressTrips = (todayTrips.started || 0) + (todayTrips.approved || 0);
            const todayTripCompletionRate = todayTotalTrips > 0 ? (todayCompletedTrips / todayTotalTrips) * 100 : 0;

            const periods = ['today', 'last_month', 'last_6_months', 'last_year'] as const;
            let overallTotalTrips = 0;
            let overallCompletedTrips = 0;
            let overallInProgressTrips = 0;

            periods.forEach((period) => {
                const periodData: TripData = (tripData as Record<string, TripData>)[period] || {};
                overallTotalTrips += (periodData.planned || 0) + (periodData.started || 0) +
                    (periodData.approved || 0) + (periodData.completed || 0);
                overallCompletedTrips += periodData.completed || 0;
                overallInProgressTrips += (periodData.started || 0) + (periodData.approved || 0);
            });
            const overallTripCompletionRate = overallTotalTrips > 0 ? (overallCompletedTrips / overallTotalTrips) * 100 : 0;

            const todayAlerts = alertData.totals?.today || { generated: 0, closed: 0, pending: 0 };
            const overallAlerts = alertData.totals?.overall || { generated: 0, closed: 0, pending: 0 };
            
            const todayAlertResolutionRate = todayAlerts.generated > 0 ? (todayAlerts.closed / todayAlerts.generated) * 100 : 0;
            const overallAlertResolutionRate = overallAlerts.generated > 0 ? (overallAlerts.closed / overallAlerts.generated) * 100 : 0;

            const totalAssets = (assetData.pmd?.total || 0) + (assetData.csd?.total || 0) + (assetData.eseal?.total || 0);
            const assetsInUse = (assetData.pmd?.in_use || 0) + (assetData.csd?.in_use || 0) + (assetData.eseal?.in_use || 0);
            const assetUtilizationRate = totalAssets > 0 ? (assetsInUse / totalAssets) * 100 : 0;

            // Generate insights with proper typing
            const rawInsights = generateInsights({
                todayTripCompletionRate,
                overallTripCompletionRate,
                todayAlertResolutionRate,
                overallAlertResolutionRate,
                assetUtilizationRate,
                todayInProgressTrips,
                overallInProgressTrips,
                todayAlertsPending: todayAlerts.pending,
                overallAlertsPending: overallAlerts.pending,
            });

            // Ensure insights have correct types
            const insights = rawInsights.map(insight => ({
                ...insight,
                type: (insight.type as 'positive' | 'warning' | 'neutral') || 'neutral',
                trend: (insight.trend as 'up' | 'down' | 'stable') || 'stable',
                action: insight.action || '',
            }));

            const newSummaryData: SummaryMetrics = {
                today: {
                    trips: {
                        total: todayTotalTrips,
                        completed: todayCompletedTrips,
                        inProgress: todayInProgressTrips,
                        completionRate: Math.round(todayTripCompletionRate),
                    },
                    alerts: {
                        generated: todayAlerts.generated,
                        resolved: todayAlerts.closed,
                        pending: todayAlerts.pending,
                        resolutionRate: Math.round(todayAlertResolutionRate),
                    },
                    assets: {
                        total: totalAssets,
                        inUse: assetsInUse,
                        utilizationRate: Math.round(assetUtilizationRate),
                    },
                },
                overall: {
                    trips: {
                        total: overallTotalTrips,
                        completed: overallCompletedTrips,
                        inProgress: overallInProgressTrips,
                        completionRate: Math.round(overallTripCompletionRate),
                    },
                    alerts: {
                        generated: overallAlerts.generated,
                        resolved: overallAlerts.closed,
                        pending: overallAlerts.pending,
                        resolutionRate: Math.round(overallAlertResolutionRate),
                    },
                    assets: {
                        total: totalAssets,
                        inUse: assetsInUse,
                        utilizationRate: Math.round(assetUtilizationRate),
                    },
                },
                insights,
                lastUpdated: new Date(),
            };

            setSummaryData(newSummaryData);
            setRetryCount(0);
            setIsOffline(false);
            
            // Remove loading message and add AI conversation
            setMessages([]);
            setIsBotTyping(true);
            
            // Build conversation with proper delays
            const buildConversation = async () => {
                try {
                    const { greeting, summary } = generateBotMessage(newSummaryData, 'today');
                    
                    const timeout1 = setTimeout(() => {
                        if (!isMountedRef.current) return;
                        setMessages([{
                            id: Date.now().toString(),
                            text: greeting,
                            isBot: true,
                            timestamp: new Date(),
                            type: 'greeting',
                        }]);
                        setIsBotTyping(false);
                        
                        const timeout2 = setTimeout(() => {
                            if (!isMountedRef.current) return;
                            setIsBotTyping(true);
                            
                            const timeout3 = setTimeout(() => {
                                if (!isMountedRef.current) return;
                                setMessages(prev => [...prev, {
                                    id: (Date.now() + 1).toString(),
                                    text: summary,
                                    isBot: true,
                                    timestamp: new Date(),
                                    type: 'summary',
                                }]);
                                setIsBotTyping(false);
                                
                                const timeout4 = setTimeout(() => {
                                    if (!isMountedRef.current) return;
                                    const insightMessages = generateInsightMessages(insights.slice(0, 3));
                                    
                                    insightMessages.forEach((insight, idx) => {
                                        const timeout5 = setTimeout(() => {
                                            if (!isMountedRef.current) return;
                                            setIsBotTyping(true);
                                            
                                            const timeout6 = setTimeout(() => {
                                                if (!isMountedRef.current) return;
                                                setMessages(prev => [...prev, {
                                                    id: (Date.now() + idx).toString(),
                                                    text: insight.description,
                                                    isBot: true,
                                                    timestamp: new Date(),
                                                    type: 'insight',
                                                    insightData: insight,
                                                }]);
                                                setIsBotTyping(false);
                                            }, 500);
                                            conversationTimeoutRef.current.push(timeout6);
                                        }, idx * 1500);
                                        conversationTimeoutRef.current.push(timeout5);
                                    });
                                    
                                    const timeout7 = setTimeout(() => {
                                        if (!isMountedRef.current) return;
                                        setIsBotTyping(true);
                                        
                                        const timeout8 = setTimeout(() => {
                                            if (!isMountedRef.current) return;
                                            setMessages(prev => [...prev, {
                                                id: (Date.now() + 99).toString(),
                                                text: "💡 Tap 'Quick Metrics' below to see detailed statistics!",
                                                isBot: true,
                                                timestamp: new Date(),
                                                type: 'action',
                                            }]);
                                            setIsBotTyping(false);
                                            setShowMetrics(true);
                                        }, 800);
                                        conversationTimeoutRef.current.push(timeout8);
                                    }, insights.length * 1500 + 500);
                                    conversationTimeoutRef.current.push(timeout7);
                                }, 500);
                                conversationTimeoutRef.current.push(timeout4);
                            }, 500);
                            conversationTimeoutRef.current.push(timeout3);
                        }, 800);
                        conversationTimeoutRef.current.push(timeout2);
                    }, 300);
                    conversationTimeoutRef.current.push(timeout1);
                } catch (err) {
                    console.error('Error building conversation:', err);
                    setIsBotTyping(false);
                    setMessages(prev => [...prev, {
                        id: 'error-' + Date.now(),
                        text: "I've analyzed your data. Check the metrics below for details.",
                        isBot: true,
                        timestamp: new Date(),
                        type: 'summary',
                    }]);
                    setShowMetrics(true);
                }
            };
            
            buildConversation();

        } catch (err: any) {
            console.error('AI Summary fetch error:', err);
            const errorMessage = err?.name === 'AbortError' 
                ? 'Request timeout. Please check your connection.' 
                : err?.message === 'Failed to fetch' 
                    ? 'Network error. Unable to reach the server.'
                    : 'Failed to load summary data. Please try again.';
            
            setError(errorMessage);
            
            if (retryCount < 2) {
                setRetryCount(prev => prev + 1);
                setTimeout(() => {
                    if (isMountedRef.current) fetchAllData();
                }, 2000);
            } else {
                setMessages([{
                    id: 'error-' + Date.now(),
                    text: "⚠️ I'm having trouble connecting to the server. Please check your internet connection and try again later.",
                    isBot: true,
                    timestamp: new Date(),
                    type: 'greeting',
                }]);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [BASE_URL, generateBotMessage, generateInsightMessages, generateInsights, checkConnectivity, clearConversationTimeouts, retryCount]);

    // Initial fetch
    useEffect(() => {
        isMountedRef.current = true;
        fetchAllData();
        
        return () => {
            isMountedRef.current = false;
            clearConversationTimeouts();
        };
    }, [fetchAllData, clearConversationTimeouts]);

    const handleRefresh = useCallback(() => {
        if (refreshing || isBotTyping) return;
        setRefreshing(true);
        setRetryCount(0);
        fetchAllData();
        onRefresh?.();
    }, [fetchAllData, onRefresh, refreshing, isBotTyping]);

    const handlePeriodChange = useCallback((period: 'today' | 'overall') => {
        if (!summaryData) return;
        
        setSelectedPeriod(period);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const currentData = period === 'today' ? summaryData.today : summaryData.overall;
        const periodText = period === 'today' ? "today's real-time" : "cumulative overall";
        
        const newMsg: Message = {
            id: Date.now().toString(),
            text: `📊 Showing ${periodText} data. ${period === 'today' ? 'Here are the latest metrics' : 'Here are your historical totals'}.`,
            isBot: true,
            timestamp: new Date(),
            type: 'summary',
        };
        setMessages(prev => [...prev, newMsg]);
        setTimeout(() => scrollToBottom(), 100);
    }, [summaryData, scrollToBottom]);

    const currentData = selectedPeriod === 'today' ? summaryData?.today : summaryData?.overall;

    // Typing message component
    const TypingMessage = React.memo(({ text, isTyping }: { text: string; isTyping: boolean }) => {
        const { displayText, isComplete } = useTypingAnimation(text, isTyping, 20);
        
        return (
            <View style={styles.messageBubble}>
                <Text style={styles.messageText}>{displayText}</Text>
                {isTyping && !isComplete && <AnimatedCursor />}
            </View>
        );
    });

    TypingMessage.displayName = 'TypingMessage';

    if (loading && !summaryData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Initializing AI Assistant...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* AI Avatar Header */}
            <LinearGradient
                colors={[Colors.secondary, '#2C2829']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            >
                <View style={styles.headerContent}>
                    <View style={styles.headerLeft}>
                        <View style={styles.aiAvatar}>
                            <MaterialCommunityIcons name="robot-happy" size={28} color={Colors.primary} />
                            {!isOffline && <View style={styles.onlineDot} />}
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>AI Analytics Assistant</Text>
                            <Text style={styles.headerSubtitle}>
                                {isOffline ? 'Offline Mode' : summaryData ? `Updated ${summaryData.lastUpdated?.toLocaleTimeString()}` : 'Analyzing...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        onPress={handleRefresh} 
                        style={styles.refreshBtn} 
                        disabled={refreshing || isBotTyping}
                    >
                        <Ionicons name="refresh" size={18} color={Colors.white} />
                    </TouchableOpacity>
                </View>

                {/* Period Toggle */}
                <View style={styles.periodToggle}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, selectedPeriod === 'today' && styles.toggleBtnActive]}
                        onPress={() => handlePeriodChange('today')}
                        disabled={!summaryData}
                    >
                        <Text style={[styles.toggleText, selectedPeriod === 'today' && styles.toggleTextActive]}>
                            📅 Today
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, selectedPeriod === 'overall' && styles.toggleBtnActive]}
                        onPress={() => handlePeriodChange('overall')}
                        disabled={!summaryData}
                    >
                        <Text style={[styles.toggleText, selectedPeriod === 'overall' && styles.toggleTextActive]}>
                            📈 Overall
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Chat Container */}
            <ScrollView 
                ref={scrollViewRef}
                style={styles.chatContainer}
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={handleRefresh} 
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* Error Banner */}
                {error && (
                    <View style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={18} color="#D32F2F" />
                        <Text style={styles.errorBannerText}>{error}</Text>
                        <TouchableOpacity onPress={handleRefresh}>
                            <Text style={styles.errorBannerRetry}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Messages */}
                {messages.map((message, index) => (
                    <View key={message.id} style={styles.messageWrapper}>
                        {message.isBot && (
                            <View style={styles.botAvatar}>
                                <MaterialCommunityIcons name="robot" size={16} color={Colors.primary} />
                            </View>
                        )}
                        <View style={[
                            styles.messageContainer,
                            message.isBot ? styles.botMessage : styles.userMessage,
                            message.type === 'insight' && styles.insightMessage,
                            message.type === 'action' && styles.actionMessage,
                        ]}>
                            {index === messages.length - 1 && isBotTyping && message === messages[messages.length - 1] ? (
                                <TypingMessage text={message.text} isTyping={true} />
                            ) : (
                                <>
                                    <Text style={[
                                        styles.messageText,
                                        message.type === 'insight' && styles.insightText,
                                        message.type === 'action' && styles.actionText,
                                    ]}>
                                        {message.text}
                                    </Text>
                                    {message.insightData && expandedInsight === message.id && (
                                        <View style={styles.insightAction}>
                                            <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
                                            <Text style={styles.insightActionText}>
                                                {message.insightData.action}
                                            </Text>
                                        </View>
                                    )}
                                    {message.insightData && (
                                        <TouchableOpacity 
                                            style={styles.expandInsightBtn}
                                            onPress={() => setExpandedInsight(expandedInsight === message.id ? null : message.id)}
                                        >
                                            <Text style={styles.expandInsightText}>
                                                {expandedInsight === message.id ? 'Show less' : 'Show recommendation'}
                                            </Text>
                                            <Ionicons 
                                                name={expandedInsight === message.id ? 'chevron-up' : 'chevron-down'} 
                                                size={12} 
                                                color={Colors.primary} 
                                            />
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </View>
                    </View>
                ))}

                {/* Typing indicator */}
                {isBotTyping && messages.length > 0 && (
                    <View style={styles.messageWrapper}>
                        <View style={styles.botAvatar}>
                            <MaterialCommunityIcons name="robot" size={16} color={Colors.primary} />
                        </View>
                        <View style={[styles.messageContainer, styles.botMessage, styles.typingIndicator]}>
                            <View style={styles.typingDot} />
                            <View style={[styles.typingDot, styles.typingDotMid]} />
                            <View style={[styles.typingDot, styles.typingDotSlow]} />
                        </View>
                    </View>
                )}

                <View ref={chatEndRef} style={styles.chatEnd} />
            </ScrollView>

            {/* Metrics Summary Card (Collapsible) */}
            {showMetrics && currentData && summaryData && (
                <Animated.View style={styles.metricsCard}>
                    <TouchableOpacity 
                        style={styles.metricsHeader}
                        onPress={() => setShowMetrics(!showMetrics)}
                    >
                        <View style={styles.metricsHeaderLeft}>
                            <Ionicons name="stats-chart" size={18} color={Colors.primary} />
                            <Text style={styles.metricsTitle}>Quick Metrics</Text>
                        </View>
                        <Ionicons name={showMetrics ? "chevron-up" : "chevron-down"} size={18} color={Colors.accent} />
                    </TouchableOpacity>

                    {showMetrics && (
                        <View style={styles.metricsGrid}>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricValue}>{currentData.trips.total.toLocaleString()}</Text>
                                <Text style={styles.metricLabel}>Total Trips</Text>
                                <View style={styles.metricBadge}>
                                    <Text style={styles.metricBadgeText}>{currentData.trips.completionRate}% done</Text>
                                </View>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricItem}>
                                <Text style={styles.metricValue}>{currentData.alerts.generated.toLocaleString()}</Text>
                                <Text style={styles.metricLabel}>Alerts</Text>
                                <View style={[styles.metricBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                    <Text style={[styles.metricBadgeText, { color: '#10B981' }]}>{currentData.alerts.resolutionRate}% resolved</Text>
                                </View>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricItem}>
                                <Text style={styles.metricValue}>{currentData.assets.total.toLocaleString()}</Text>
                                <Text style={styles.metricLabel}>Assets</Text>
                                <View style={[styles.metricBadge, { backgroundColor: 'rgba(239, 142, 51, 0.1)' }]}>
                                    <Text style={[styles.metricBadgeText, { color: Colors.primary }]}>{currentData.assets.utilizationRate}% in use</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: Colors.white,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    loadingContainer: {
        padding: 48,
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 24,
        marginHorizontal: 16,
        marginVertical: 12,
    },
    loadingText: {
        marginTop: 12,
        fontSize: responsiveFont(14),
        color: Colors.accent,
    },
    headerGradient: {
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 16,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    aiAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        position: 'relative',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
        borderWidth: 1.5,
        borderColor: Colors.secondary,
    },
    headerTitle: {
        fontSize: responsiveFont(16),
        fontWeight: '700',
        color: Colors.white,
    },
    headerSubtitle: {
        fontSize: responsiveFont(10),
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    refreshBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    periodToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 30,
        padding: 3,
        alignSelf: 'flex-start',
    },
    toggleBtn: {
        paddingHorizontal: 18,
        paddingVertical: 6,
        borderRadius: 28,
    },
    toggleBtnActive: {
        backgroundColor: Colors.primary,
    },
    toggleText: {
        fontSize: responsiveFont(11),
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    toggleTextActive: {
        color: Colors.white,
    },
    chatContainer: {
        flex: 1,
        maxHeight: 440,
        minHeight: 340,
    },
    chatContent: {
        padding: 16,
        paddingBottom: 20,
    },
    messageWrapper: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
    },
    botAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(239, 142, 51, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    messageContainer: {
        flex: 1,
        padding: 12,
        borderRadius: 18,
        maxWidth: '85%',
    },
    botMessage: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    userMessage: {
        backgroundColor: Colors.primary,
        marginLeft: 'auto',
        borderTopRightRadius: 4,
    },
    insightMessage: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderLeftWidth: 3,
        borderLeftColor: '#10B981',
    },
    actionMessage: {
        backgroundColor: 'rgba(239, 142, 51, 0.05)',
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    messageText: {
        fontSize: responsiveFont(13),
        lineHeight: 20,
        color: Colors.secondary,
    },
    insightText: {
        color: '#10B981',
    },
    actionText: {
        color: Colors.primary,
    },
    cursor: {
        marginLeft: 2,
    },
    cursorText: {
        fontSize: responsiveFont(13),
        color: Colors.primary,
    },
    messageBubble: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 4,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.accent,
        opacity: 0.6,
    },
    typingDotMid: {
        opacity: 0.4,
    },
    typingDotSlow: {
        opacity: 0.2,
    },
    insightAction: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        gap: 6,
    },
    insightActionText: {
        fontSize: responsiveFont(11),
        color: Colors.accent,
        flex: 1,
    },
    expandInsightBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
        alignSelf: 'flex-start',
    },
    expandInsightText: {
        fontSize: responsiveFont(10),
        color: Colors.primary,
        fontWeight: '600',
    },
    chatEnd: {
        height: 4,
    },
    metricsCard: {
        margin: 16,
        marginTop: 8,
        marginBottom: 16,
    },
    metricsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    metricsHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metricsTitle: {
        fontSize: responsiveFont(13),
        fontWeight: '600',
        color: Colors.secondary,
    },
    metricsGrid: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        padding: 16,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: '#F0F0F0',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#F0F0F0',
    },
    metricValue: {
        fontSize: responsiveFont(18),
        fontWeight: '800',
        color: Colors.secondary,
    },
    metricLabel: {
        fontSize: responsiveFont(10),
        color: Colors.accent,
        marginTop: 2,
    },
    metricBadge: {
        marginTop: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 142, 51, 0.1)',
    },
    metricBadgeText: {
        fontSize: responsiveFont(8),
        fontWeight: '600',
        color: Colors.primary,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
        gap: 8,
    },
    errorBannerText: {
        flex: 1,
        fontSize: responsiveFont(12),
        color: '#D32F2F',
    },
    errorBannerRetry: {
        fontSize: responsiveFont(12),
        color: Colors.primary,
        fontWeight: '600',
    },
});

export default AIChatSummary;