import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// Standard Expo Imports
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';

interface AlertData {
    carrier_name: string;
    alert_category: string;
    generated: number;
    closed: number;
    pending: number;
}

interface TripTypeData {
    [trip_type: string]: AlertData[];
}

const ALERT_CATEGORIES_CONFIG: Record<string, { title: string; color: string }> = {
    UNUSUAL_HALT: { title: 'Unusual Halt', color: Colors.primary },
    ROUTE_DEVIATION: { title: 'Route Deviation', color: Colors.primary },
    DOOR_OPEN: { title: 'Door Open', color: Colors.primary },
    UNSYNC: { title: 'Device Unsync', color: Colors.primary },
    DEATTACH_DEVICE: { title: 'Device Detached', color: Colors.primary },
};

const TRIP_TYPES_CONFIG: Record<string, { title: string; color: string }> = {
    AT: { title: 'AT → Air Trip', color: Colors.primary },
    ATT: { title: 'ATT → Air Transit Trip', color: Colors.primary },
    IPM: { title: 'IP → Import Trip', color: Colors.primary },
    EPZ: { title: 'EPZ → Export Processing Zone', color: Colors.primary },
    TP: { title: 'TP → Transit Permit', color: Colors.primary },
    KEPZ: { title: 'KEPZ → Korangi Export Processing Zone', color: Colors.primary },  
};

interface SeeAllAlertsModalProps {
    visible: boolean;
    onClose: () => void;
}

const SeeAllAlertsModal: React.FC<SeeAllAlertsModalProps> = ({ visible, onClose }) => {
    // Environment config setup
    const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 
                     Constants.expoConfig?.extra?.baseUrl || 
                     "https://vtssmartsolutions.com";

    const API_URL = `${BASE_URL}/api/mobile/alerts/trip-type-counts`;

    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'web'>('table');
    const [tripTypeData, setTripTypeData] = useState<TripTypeData>({});
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
    });

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const formatDateForAPI = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchAlertsData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            let url = API_URL;
            const params: string[] = [];

            if (dateRange.startDate) {
                const startFormatted = formatDateForAPI(dateRange.startDate);
                if (startFormatted) params.push(`start_date=${startFormatted}`);
            }

            if (dateRange.endDate) {
                const endFormatted = formatDateForAPI(dateRange.endDate);
                if (endFormatted) params.push(`end_date=${endFormatted}`);
            }

            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            console.log('Fetching Trip Type URL:', url);

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

            if (data.success) {
                setTripTypeData(data.data || {});
            } else {
                setError(data.message || 'Failed to fetch alerts');
                setTripTypeData({});
            }
        } catch (err: any) {
            console.error("Fetch Error:", err);
            setError(err.name === 'AbortError' ? 'Request timeout' : 'Network error');
            setTripTypeData({});
        } finally {
            setLoading(false);
        }
    }, [API_URL, dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        if (visible) {
            fetchAlertsData();
        }
    }, [visible, fetchAlertsData]);

    const generateWebViewHTML = () => {
        const tripTypes = Object.keys(tripTypeData).sort();
        const startString = dateRange.startDate ? dateRange.startDate.toLocaleDateString() : 'All Time';
        const endString = dateRange.endDate ? dateRange.endDate.toLocaleDateString() : '';

        return `
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    padding: 15px; 
                    background: ${Colors.background}; 
                    color: ${Colors.text};
                }
                .header { 
                    text-align: center; 
                    color: ${Colors.secondary}; 
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid ${Colors.primary};
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 22px; 
                    font-weight: 600;
                }
                .header .subtitle { 
                    color: ${Colors.accent}; 
                    font-size: 14px; 
                    margin-top: 5px;
                }
                .date-range {
                    text-align: center;
                    color: ${Colors.accent};
                    font-size: 12px;
                    margin-bottom: 20px;
                    padding: 8px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .trip-section { 
                    margin-bottom: 25px; 
                    background: white; 
                    border-radius: 12px; 
                    padding: 15px; 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
                    border: 1px solid #eee; 
                }
                .trip-header { 
                    display: flex; 
                    align-items: center; 
                    margin-bottom: 15px; 
                    padding-bottom: 10px; 
                    border-bottom: 1px solid #eee; 
                }
                .trip-icon { 
                    width: 12px; 
                    height: 12px; 
                    border-radius: 50%; 
                    margin-right: 10px; 
                }
                .trip-title { 
                    font-size: 16px; 
                    font-weight: 600; 
                    color: ${Colors.secondary}; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    font-size: 12px;
                }
                th { 
                    text-align: left; 
                    color: ${Colors.accent}; 
                    font-size: 11px; 
                    text-transform: uppercase; 
                    padding: 8px 6px; 
                    border-bottom: 1px solid #eee; 
                    font-weight: 500;
                    background: ${Colors.surface};
                }
                td { 
                    padding: 10px 6px; 
                    border-bottom: 1px solid #f9f9f9; 
                    color: ${Colors.text}; 
                }
                .carrier-name { 
                    font-weight: 500; 
                    color: ${Colors.secondary};
                }
                .stats-cell { 
                    text-align: center; 
                    font-weight: 600; 
                }
                .generated { color: ${Colors.primary}; }
                .closed { color: #27ae60; }
                .pending { color: #e74c3c; }
                .empty-state { 
                    text-align: center; 
                    padding: 20px; 
                    color: ${Colors.accent}; 
                    font-style: italic; 
                }
                .section-divider { 
                    height: 1px; 
                    background: linear-gradient(to right, transparent, ${Colors.primary}, transparent); 
                    margin: 20px 0; 
                }
                @media (max-width: 600px) {
                    body { padding: 10px; }
                    .trip-section { padding: 12px; }
                    table { font-size: 11px; }
                    th, td { padding: 6px 4px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Carrier Alerts by Trip Type</h1>
                <div class="subtitle">Generated, Closed, and Pending Alerts Analysis</div>
            </div>
            
            <div class="date-range">
                ${startString} ${dateRange.startDate && dateRange.endDate ? '→' : ''} ${endString}
            </div>
            
            ${tripTypes.length === 0 ? `
                <div class="empty-state">No data available for the selected date range</div>
            ` : ''}
            
            ${tripTypes.map(tripType => {
                const tripConfig = TRIP_TYPES_CONFIG[tripType] || { title: tripType, color: Colors.accent };
                const alerts = tripTypeData[tripType] || [];

                return `
                <div class="trip-section">
                    <div class="trip-header">
                        <div class="trip-icon" style="background: ${tripConfig.color};"></div>
                        <div class="trip-title">${tripConfig.title} (${tripType})</div>
                    </div>
                    
                    ${alerts.length === 0 ? `
                        <div class="empty-state">No alerts for this trip type</div>
                    ` : `
                        <table>
                            <thead>
                                <tr>
                                    <th>Carrier</th>
                                    <th>Alert Type</th>
                                    <th class="stats-cell">Generated</th>
                                    <th class="stats-cell">Closed</th>
                                    <th class="stats-cell">Pending</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alerts.map(alert => {
                                    const alertConfig = ALERT_CATEGORIES_CONFIG[alert.alert_category] || { title: alert.alert_category, color: Colors.accent };
                                    return `
                                    <tr>
                                        <td class="carrier-name">${alert.carrier_name}</td>
                                        <td>${alertConfig.title}</td>
                                        <td class="stats-cell generated">${alert.generated}</td>
                                        <td class="stats-cell closed">${alert.closed}</td>
                                        <td class="stats-cell pending">${alert.pending}</td>
                                    </tr>
                                    `;
                                }).join('')}

                                <tr style="background: ${Colors.surface}; font-weight: bold;">
                                    <td colspan="2">TOTAL FOR ${tripType}</td>
                                    <td class="stats-cell generated">${alerts.reduce((sum, a) => sum + a.generated, 0)}</td>
                                    <td class="stats-cell closed">${alerts.reduce((sum, a) => sum + a.closed, 0)}</td>
                                    <td class="stats-cell pending">${alerts.reduce((sum, a) => sum + a.pending, 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    `}
                </div>
                ${tripTypes.indexOf(tripType) < tripTypes.length - 1 ? '<div class="section-divider"></div>' : ''}
                `;
            }).join('')}
        </body>
        </html>`;
    };

    return (
        <Modal visible={visible} animationType="slide">
            <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
                <LinearGradient colors={[Colors.secondary, Colors.secondary]} style={styles.topBar}>
                    <View style={styles.row}>
                        <TouchableOpacity onPress={onClose}>
                            <AntDesign name="arrow-left" size={24} color={Colors.white} />
                        </TouchableOpacity>
                        <Text style={[styles.titleText, { color: Colors.white }]}>Trip Type Analytics</Text>
                        <TouchableOpacity
                            onPress={() => setViewMode(viewMode === 'web' ? 'table' : 'web')}
                            style={[styles.modeBtn, { backgroundColor: Colors.primary }]}
                        >
                            <Text style={[styles.modeText, { color: Colors.white }]}>
                                {viewMode === 'web' ? 'LIST' : 'REPORT'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dateRow}>
    <TouchableOpacity
        onPress={() => setShowStartPicker(true)}
        style={[styles.dateInput, { borderColor: `${Colors.white}20` }]}
    >
        <Text style={[styles.dateLabel, { color: Colors.accent }]}>FROM</Text>
        <Text style={[styles.dateVal, { color: Colors.white }]}>
            {dateRange.startDate ? dateRange.startDate.toLocaleDateString() : 'Start'}
        </Text>
    </TouchableOpacity>
    <TouchableOpacity
        onPress={() => setShowEndPicker(true)}
        style={[styles.dateInput, { borderColor: `${Colors.white}20` }]}
    >
        <Text style={[styles.dateLabel, { color: Colors.accent }]}>TO</Text>
        <Text style={[styles.dateVal, { color: Colors.white }]}>
            {dateRange.endDate ? dateRange.endDate.toLocaleDateString() : 'End'}
        </Text>
    </TouchableOpacity>
</View>
                </LinearGradient>

                {loading ? (
                    <ActivityIndicator
                        size="large"
                        color={Colors.primary}
                        style={styles.loader}
                    />
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color={Colors.accent} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchAlertsData}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    viewMode === 'web' ? (
                        <WebView
                            originWhitelist={['*']}
                            source={{ html: generateWebViewHTML() }}
                            style={styles.webview}
                        />
                    ) : (
                        <ScrollView style={styles.listScroll}>
                            {Object.entries(tripTypeData).length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No data available</Text>
                                </View>
                            ) : (
                                Object.entries(tripTypeData).map(([tripType, alerts]) => (
                                    <View key={tripType} style={[styles.tripTypeSection, { backgroundColor: Colors.white }]}>
                                        <View style={styles.tripTypeHeader}>
                                            <View style={[
                                                styles.tripTypeIndicator,
                                                { backgroundColor: TRIP_TYPES_CONFIG[tripType]?.color || Colors.accent }
                                            ]} />
                                            <Text style={[styles.tripTypeTitle, { color: Colors.secondary }]}>
                                                {TRIP_TYPES_CONFIG[tripType]?.title || tripType}
                                            </Text>
                                        </View>

                                        {alerts.map((alert, idx) => (
                                            <View key={idx} style={styles.alertItem}>
                                                <View style={[
                                                    styles.alertIndicator,
                                                    { backgroundColor: ALERT_CATEGORIES_CONFIG[alert.alert_category]?.color || Colors.accent }
                                                ]} />
                                                <View style={styles.alertContent}>
                                                    <View style={styles.rowBetween}>
                                                        <Text style={[styles.carrierText, { color: Colors.secondary }]}>
                                                            {alert.carrier_name}
                                                        </Text>
                                                        <Text style={[styles.alertTypeText, { color: Colors.accent }]}>
                                                            {ALERT_CATEGORIES_CONFIG[alert.alert_category]?.title || alert.alert_category}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.statsRow}>
                                                        <View style={styles.statItem}>
                                                            <Text style={[styles.statLabel, { color: Colors.accent }]}>Generated</Text>
                                                            <Text style={[styles.statValueGenerated, { color: Colors.primary }]}>{alert.generated}</Text>
                                                        </View>
                                                        <View style={styles.statItem}>
                                                            <Text style={[styles.statLabel, { color: Colors.accent }]}>Closed</Text>
                                                            <Text style={styles.statValueClosed}>{alert.closed}</Text>
                                                        </View>
                                                        <View style={styles.statItem}>
                                                            <Text style={[styles.statLabel, { color: Colors.accent }]}>Pending</Text>
                                                            <Text style={styles.statValuePending}>{alert.pending}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                        
                                        {/* TOTAL SECTION */}
                                        <View style={styles.totalSection}>
                                            <View style={styles.statItem}>
                                                <Text style={[styles.statLabel, { color: Colors.text }]}>TOTAL GEN</Text>
                                                <Text style={[styles.statValueGenerated, { color: Colors.primary }]}>
                                                    {alerts.reduce((sum, a) => sum + a.generated, 0)}
                                                </Text>
                                            </View>
                                            <View style={styles.statItem}>
                                                <Text style={[styles.statLabel, { color: Colors.text }]}>TOTAL CLS</Text>
                                                <Text style={styles.statValueClosed}>
                                                    {alerts.reduce((sum, a) => sum + a.closed, 0)}
                                                </Text>
                                            </View>
                                            <View style={styles.statItem}>
                                                <Text style={[styles.statLabel, { color: Colors.text }]}>TOTAL PND</Text>
                                                <Text style={styles.statValuePending}>
                                                    {alerts.reduce((sum, a) => sum + a.pending, 0)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    )
                )}

                <DateTimePickerModal
                    isVisible={showStartPicker}
                    mode="date"
                    onConfirm={(date) => {
                        setDateRange(prev => ({ ...prev, startDate: date }));
                        setShowStartPicker(false);
                    }}
                    onCancel={() => setShowStartPicker(false)}
                />
                <DateTimePickerModal
                    isVisible={showEndPicker}
                    mode="date"
                    onConfirm={(date) => {
                        setDateRange(prev => ({ ...prev, endDate: date }));
                        setShowEndPicker(false);
                    }}
                    onCancel={() => setShowEndPicker(false)}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        padding: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    titleText: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    modeBtn: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8
    },
    modeText: {
        fontWeight: 'bold',
        fontSize: 12
    },
    dateRow: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 10
    },
    dateInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    dateLabel: {
        fontSize: 10,
        fontWeight: 'bold'
    },
    dateVal: {
        fontWeight: '600',
        fontSize: 14,
        marginTop: 2
    },
    loader: {
        marginTop: 40
    },
    webview: {
        flex: 1
    },
    listScroll: {
        padding: 15
    },
    tripTypeSection: {
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    tripTypeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.muted,
    },
    tripTypeIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    tripTypeTitle: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    alertItem: {
        flexDirection: 'row',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.muted,
    },
    alertIndicator: {
        width: 4,
        minHeight: 35,
        borderRadius: 2,
        marginRight: 12,
    },
    alertContent: {
        flex: 1,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    carrierText: {
        fontWeight: '600',
        fontSize: 14,
        flex: 1,
    },
    alertTypeText: {
        fontSize: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    totalSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: Colors.muted,
        backgroundColor: Colors.surface,
        padding: 5,
        borderRadius: 8
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        fontSize: 10,
        marginBottom: 2,
        fontWeight: '500',
    },
    statValueGenerated: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statValueClosed: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#27ae60',
    },
    statValuePending: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#e74c3c',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 14,
        color: Colors.accent,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: Colors.white,
        fontWeight: '600',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: Colors.accent,
    },
});

export default SeeAllAlertsModal;