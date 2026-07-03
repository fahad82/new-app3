import { Ionicons } from "@expo/vector-icons";
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Internal Imports
import { Colors } from '@/constants/theme';
import { authStorage } from '@/utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FALLBACK_GIST = "https://gist.githubusercontent.com/fahad82/dc9eaf11fdc7f57e9143d2f46917bc49/raw/auth_config.json";

interface AuthConfig {
    ADMIN_EMAIL: string;
    ADMIN_PASSWORD: string;
    USER_EMAIL: string;
    USER_PASSWORD: string;
}

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [remoteAuth, setRemoteAuth] = useState<AuthConfig | null>(null);
    const [networkError, setNetworkError] = useState(false);

    const BASE_URL = process.env.EXPO_PUBLIC_BASE_GIST ||
        Constants.expoConfig?.extra?.baseGist ||
        FALLBACK_GIST;

    const initializeApp = useCallback(async () => {
        try {
            setCheckingAuth(true);
            setNetworkError(false);
            
            // Check if already logged in via SecureStore
            const loggedIn = await authStorage.isLoggedIn();
            if (loggedIn) {
                router.replace('/(tabs)' as any);
                return;
            }

            // Try to pre-fill email if saved
            const savedEmail = await authStorage.getEmail();
            if (savedEmail) {
                setEmail(savedEmail);
            }

            // Fetch auth config from Gist
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(BASE_URL, {
                signal: controller.signal,
                headers: { 
                    'Cache-Control': 'no-cache',
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data: AuthConfig = await response.json();
            
            // Validate the received data
            if (data?.ADMIN_EMAIL && data?.ADMIN_PASSWORD && data?.USER_EMAIL && data?.USER_PASSWORD) {
                setRemoteAuth(data);
            } else {
                throw new Error("Invalid auth configuration received");
            }
        } catch (error: any) {
            console.error("Initialization Failed:", error.message || error);
            setNetworkError(true);
            
            // Show error only if not a network issue
            if (error.name === 'AbortError') {
                Alert.alert(
                    "Connection Timeout",
                    "Unable to reach the security server. Please check your internet connection and try again.",
                    [{ text: "Retry", onPress: () => initializeApp() }]
                );
            }
        } finally {
            setCheckingAuth(false);
        }
    }, [BASE_URL]);

    useEffect(() => {
        initializeApp();
    }, [initializeApp]);

    const handleLogin = async () => {
        // Trim whitespace
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();

        if (!trimmedEmail || !trimmedPassword) {
            Alert.alert("Required", "Please provide both email and security key.");
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return;
        }

        if (!remoteAuth) {
            Alert.alert(
                "Connection Error", 
                "Unable to reach security server. Would you like to retry?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Retry", onPress: () => initializeApp() }
                ]
            );
            return;
        }

        setLoading(true);
        
        // Simulate network delay for security
        await new Promise(resolve => setTimeout(resolve, 600));

        let role: 'admin' | 'user' | null = null;
        
        // Compare credentials (case-insensitive for email)
        if (trimmedEmail === remoteAuth.ADMIN_EMAIL.toLowerCase() && 
            trimmedPassword === remoteAuth.ADMIN_PASSWORD) {
            role = 'admin';
        } else if (trimmedEmail === remoteAuth.USER_EMAIL.toLowerCase() && 
                   trimmedPassword === remoteAuth.USER_PASSWORD) {
            role = 'user';
        }

        if (role) {
            try {
                // Save credentials using SecureStore
                await authStorage.saveCredentials(trimmedEmail, trimmedPassword, true, role);
                router.replace('/(tabs)' as any);
            } catch (error) {
                Alert.alert(
                    "Error", 
                    "Failed to save credentials. Please try again.",
                    [{ text: "OK" }]
                );
                console.error("Save credentials error:", error);
            }
        } else {
            Alert.alert(
                "Access Denied", 
                "Invalid credentials. Please check your email and security key.",
                [{ text: "Try Again" }]
            );
            
            // Clear password field for security
            setPassword("");
        }
        
        setLoading(false);
    };

    const handleRetry = () => {
        setNetworkError(false);
        initializeApp();
    };

    // Loading State
    if (checkingAuth) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: Colors.secondary }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={[styles.loadingText, { color: Colors.white }]}>
                    Synchronizing Portal...
                </Text>
                <Text style={[styles.loadingSubtext, { color: Colors.accent }]}>
                    Establishing secure connection
                </Text>
            </View>
        );
    }

    // Network Error State
    if (networkError && !remoteAuth) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: Colors.secondary }]}>
                <Ionicons name="cloud-offline-outline" size={64} color={Colors.primary} />
                <Text style={[styles.loadingText, { color: Colors.white }]}>
                    Connection Failed
                </Text>
                <Text style={[styles.loadingSubtext, { color: Colors.accent }]}>
                    Unable to reach security server
                </Text>
                <TouchableOpacity 
                    style={[styles.retryButton, { backgroundColor: Colors.primary }]}
                    onPress={handleRetry}
                >
                    <Ionicons name="refresh" size={20} color={Colors.white} />
                    <Text style={styles.retryText}>Retry Connection</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    contentContainerStyle={{ flexGrow: 1 }} 
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header Section */}
                    <View style={[styles.header, { backgroundColor: Colors.primary }]}>
                        <Image
                            source={require('@/assets/images/nlc-logo-removebg-preview.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <View style={[styles.badge, { backgroundColor: Colors.secondary }]}>
                            <Text style={[styles.badgeText, { color: Colors.white }]}>
                                NEWS PORTAL
                            </Text>
                        </View>
                    </View>

                    {/* Form Content */}
                    <View style={styles.formContainer}>
                        <View style={[styles.card, { backgroundColor: Colors.white, shadowColor: Colors.secondary }]}>
                            <Text style={[styles.welcomeTitle, { color: Colors.secondary }]}>
                                Authorized Sign In
                            </Text>
                            <Text style={[styles.welcomeSub, { color: Colors.accent }]}>
                                Secure access for NLC personnel
                            </Text>

                            {/* Email Input */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: Colors.secondary }]}>
                                    Email Address
                                </Text>
                                <View style={[styles.inputWrapper, { backgroundColor: Colors.surface, borderColor: Colors.muted }]}>
                                    <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                                    <TextInput
                                        placeholder="Enter email"
                                        placeholderTextColor={Colors.accent}
                                        style={[styles.input, { color: Colors.text }]}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        autoComplete="email"
                                        textContentType="emailAddress"
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            {/* Password Input */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: Colors.secondary }]}>
                                    Security Key
                                </Text>
                                <View style={[styles.inputWrapper, { backgroundColor: Colors.surface, borderColor: Colors.muted }]}>
                                    <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} />
                                    <TextInput
                                        placeholder="••••••••"
                                        placeholderTextColor={Colors.accent}
                                        secureTextEntry={!isPasswordVisible}
                                        style={[styles.input, { color: Colors.text }]}
                                        value={password}
                                        onChangeText={setPassword}
                                        autoComplete="password"
                                        textContentType="password"
                                        editable={!loading}
                                    />
                                    <TouchableOpacity 
                                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                        style={styles.eyeButton}
                                        disabled={loading}
                                    >
                                        <Ionicons 
                                            name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                                            size={20} 
                                            color={Colors.accent} 
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.8}
                                style={[
                                    styles.loginButton, 
                                    { backgroundColor: loading ? Colors.accent : Colors.primary }
                                ]}
                            >
                                {loading ? (
                                    <View style={styles.loadingButtonContent}>
                                        <ActivityIndicator color={Colors.secondary} size="small" />
                                        <Text style={[styles.loginButtonText, { color: Colors.secondary, marginLeft: 8 }]}>
                                            VERIFYING...
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.loadingButtonContent}>
                                        <Ionicons name="lock-closed" size={18} color={Colors.secondary} />
                                        <Text style={[styles.loginButtonText, { color: Colors.secondary, marginLeft: 8 }]}>
                                            VERIFY & ACCESS
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Help Text */}
                            <Text style={[styles.helpText, { color: Colors.accent }]}>
                                Contact IT support if you need assistance
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1 
    },
    loadingContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: 20
    },
    loadingText: { 
        marginTop: 16, 
        fontWeight: '700',
        fontSize: 18
    },
    loadingSubtext: {
        marginTop: 8,
        fontSize: 14,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 110,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    logo: { 
        width: SCREEN_WIDTH * 0.6, 
        height: 75 
    },
    badge: {
        marginTop: 18,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 6,
    },
    badgeText: { 
        fontSize: 12, 
        fontWeight: '900', 
        letterSpacing: 2 
    },
    formContainer: { 
        paddingHorizontal: 24, 
        marginTop: -65 
    },
    card: {
        borderRadius: 28,
        padding: 30,
        elevation: 12,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
    },
    welcomeTitle: { 
        fontSize: 24, 
        fontWeight: '900' 
    },
    welcomeSub: { 
        fontSize: 14, 
        marginTop: 4, 
        marginBottom: 35 
    },
    inputGroup: { 
        marginBottom: 22 
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 10,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
        paddingVertical: 15,
        paddingHorizontal: 12,
        fontSize: 15,
        fontWeight: '600',
    },
    eyeButton: {
        padding: 4,
    },
    loginButton: {
        marginTop: 15,
        paddingVertical: 18,
        borderRadius: 14,
        alignItems: 'center',
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    loginButtonText: { 
        fontWeight: '900', 
        fontSize: 16, 
        letterSpacing: 1.5 
    },
    helpText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 12,
    },
});