import { Colors } from '@/constants/theme';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive utilities
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFont = (size: number) => {
    const scaleFactor = Math.min(width / 375, 1.2);
    return Math.round(size * scaleFactor);
};

const isSmallDevice = width < 375;

interface Article {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export default function CreateScreen() {
    const router = useRouter();
    
    // Create state
    const [isCreating, setIsCreating] = useState(false);
    const [newArticle, setNewArticle] = useState({ title: '', content: '' });
    const [error, setError] = useState<string | null>(null);
    
    // Read/Search state
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchResults, setSearchResults] = useState<Article[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Update/Delete state
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    
    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const LIMIT = 10;

    const BASE_URL = Constants.expoConfig?.extra?.baseUrl as string || 
                     process.env.EXPO_PUBLIC_BASE_URL || 
                     "https://vtssmartsolutions.com";
    const API_URL = `${BASE_URL}/api/news/list`;
    const SAVE_API_URL = `${BASE_URL}/api/news/save`;
    const SEARCH_API_URL = `${BASE_URL}/api/news/search`;

    // ============ CREATE ============
    const handleCreateArticle = async () => {
        if (!newArticle.title.trim()) {
            Alert.alert("Missing Title", "Please enter an article title");
            return;
        }

        if (!newArticle.content.trim()) {
            Alert.alert("Missing Content", "Please write article content");
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(SAVE_API_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    title: newArticle.title.trim(),
                    content: newArticle.content.trim()
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            Alert.alert(
                "Success 🎉", 
                "Article published successfully!",
                [
                    {
                        text: "OK", 
                        onPress: () => {
                            setNewArticle({ title: '', content: '' });
                            fetchArticles(1, true);
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('Create error:', error);
            const errorMessage = error.name === 'AbortError' 
                ? 'Request timeout - server is not responding' 
                : error.message || 'Please check your connection and try again.';
            
            setError(errorMessage);
            Alert.alert("Publishing Failed", errorMessage);
        } finally {
            setIsCreating(false);
        }
    };

    // ============ READ ============
    const fetchArticles = useCallback(async (pageNum = 1, isRefreshing = false) => {
        try {
            if (pageNum > 1) setLoadingMore(true);
            
            const offset = (pageNum - 1) * LIMIT;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${API_URL}?offset=${offset}&limit=${LIMIT}`, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const newArticles = data.articles || [];

            setArticles(prev => {
                if (isRefreshing || pageNum === 1) return newArticles;
                const existingIds = new Set(prev.map(a => a.id));
                const filteredNew = newArticles.filter((a: Article) => !existingIds.has(a.id));
                return [...prev, ...filteredNew];
            });

            const total = data.total || 0;
            setHasMore(offset + newArticles.length < total);
            setError(null);
        } catch (error: any) {
            console.error("Fetch Error:", error);
            if (pageNum === 1) {
                setError(error.name === 'AbortError' ? 'Request timeout' : 'Failed to load articles');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [API_URL, LIMIT]);

    // ============ SEARCH ============
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert("Search", "Please enter a search term");
            return;
        }

        setIsSearching(true);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(searchQuery.trim())}`, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const results = await response.json();
            setSearchResults(results);
            setShowSearch(true);
            
            if (results.length === 0) {
                Alert.alert("No Results", `No articles found matching "${searchQuery}"`);
            }
        } catch (error: any) {
            console.error("Search error:", error);
            Alert.alert("Search Failed", error.name === 'AbortError' ? 'Request timeout' : 'Please try again');
        } finally {
            setIsSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
    };

    // ============ UPDATE ============
    const handleEditArticle = (article: Article) => {
        setSelectedArticle(article);
        setEditTitle(article.title);
        setEditContent(article.content);
        setShowEditModal(true);
        setShowViewModal(false);
        setShowSearch(false);
    };

    const handleSaveEdit = async () => {
        if (!editTitle.trim() || !editContent.trim()) {
            Alert.alert("Missing Fields", "Both title and content are required");
            return;
        }

        if (!selectedArticle) return;

        setIsSubmitting(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${BASE_URL}/api/news/${selectedArticle.id}`, {
                method: 'PUT',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    title: editTitle.trim(),
                    content: editContent.trim()
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const updatedArticle = { ...selectedArticle, title: editTitle.trim(), content: editContent.trim() };
            setArticles(prev => prev.map(a => a.id === selectedArticle.id ? updatedArticle : a));
            setSearchResults(prev => prev.map(a => a.id === selectedArticle.id ? updatedArticle : a));

            setShowEditModal(false);
            Alert.alert("Success", "Article updated successfully!");
            fetchArticles(1, true);
        } catch (error: any) {
            console.error("Update error:", error);
            Alert.alert(
                "Update Failed",
                error.name === 'AbortError' ? 'Request timeout' : error.message || 'Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============ DELETE ============
    const handleDeleteArticle = (article: Article) => {
        Alert.alert(
            "Delete Article",
            `Are you sure you want to delete "${article.title}"? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 15000);

                            const response = await fetch(`${BASE_URL}/api/news/${article.id}`, {
                                method: 'DELETE',
                                signal: controller.signal,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json'
                                }
                            });

                            clearTimeout(timeoutId);

                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({}));
                                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                            }

                            setArticles(prev => prev.filter(a => a.id !== article.id));
                            setSearchResults(prev => prev.filter(a => a.id !== article.id));
                            setShowViewModal(false);
                            
                            Alert.alert("Success", "Article deleted successfully!");
                        } catch (error: any) {
                            console.error("Delete error:", error);
                            Alert.alert(
                                "Delete Failed",
                                error.name === 'AbortError' ? 'Request timeout' : error.message || 'Please try again.'
                            );
                        }
                    }
                }
            ]
        );
    };

    const handleViewArticle = (article: Article) => {
        setSelectedArticle(article);
        setShowViewModal(true);
        setShowSearch(false);
    };

    useEffect(() => {
        fetchArticles(1);
    }, [fetchArticles]);

    const onRefresh = () => {
        setRefreshing(true);
        setPage(1);
        fetchArticles(1, true);
    };

    const loadMoreData = () => {
        if (!loadingMore && hasMore && !refreshing) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchArticles(nextPage);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const LoadingSkeleton = () => (
        <View style={styles.skeletonContainer}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
        </View>
    );

    // ============ RENDER FUNCTIONS ============
    
    // Render header component for FlatList
    const renderHeader = () => (
        <>
            {/* Welcome Header */}
            <View style={styles.welcomeSection}>
                <Text style={styles.greeting}>Create Article</Text>
                <Text style={styles.userName}>Write New Alert</Text>
                <Text style={styles.welcomeSubtitle}>Share important updates with your fleet</Text>
            </View>

            {/* Header Card */}
            <LinearGradient
                colors={[Colors.primary, '#ef8e33']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.amberCard}
            >
                <View style={styles.amberCardContent}>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>New Alert</Text>
                    </View>
                    <View style={styles.headerIconContainer}>
                        <View style={styles.headerIconWrapper}>
                            <Ionicons name="add-circle" size={28} color={Colors.white} />
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>Create Alert</Text>
                            <Text style={styles.headerSubtitle}>Share important updates instantly</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.cardGraphic}>
                    <MaterialCommunityIcons name="newspaper-plus" size={32} color={Colors.white} />
                </View>
            </LinearGradient>

            {/* Title Input */}
            <View style={styles.inputCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardIconWrapper}>
                        <MaterialIcons name="title" size={20} color={Colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.cardTitle}>Alert Headline</Text>
                        <Text style={styles.cardSubtitle}>Catchy and descriptive title</Text>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.titleInput}
                        placeholder="Enter a compelling headline..."
                        placeholderTextColor={Colors.accent}
                        value={newArticle.title}
                        onChangeText={(text) => setNewArticle({ ...newArticle, title: text })}
                        editable={!isCreating}
                        maxLength={80}
                    />
                    <View style={styles.charCounter}>
                        <Text style={styles.charCounterText}>{newArticle.title.length}/80</Text>
                    </View>
                </View>
            </View>

            {/* Content Input */}
            <View style={styles.inputCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardIconWrapper}>
                        <MaterialCommunityIcons name="text-box" size={20} color={Colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.cardTitle}>Alert Content</Text>
                        <Text style={styles.cardSubtitle}>Detailed information and context</Text>
                    </View>
                </View>

                <View style={styles.textInputContainer}>
                    <TextInput
                        style={styles.contentInput}
                        placeholder="Write detailed information here..."
                        placeholderTextColor={Colors.accent}
                        value={newArticle.content}
                        onChangeText={(text) => setNewArticle({ ...newArticle, content: text })}
                        multiline
                        textAlignVertical="top"
                        editable={!isCreating}
                        maxLength={5000}
                    />
                    <View style={styles.contentCharCounter}>
                        <Text style={styles.charCounterText}>{newArticle.content.length}/5000</Text>
                    </View>
                </View>

                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#D32F2F" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[styles.clearButton, (!newArticle.title.trim() && !newArticle.content.trim()) && styles.disabledButton]}
                        onPress={() => setNewArticle({ title: '', content: '' })}
                        disabled={isCreating || (!newArticle.title.trim() && !newArticle.content.trim())}
                    >
                        <Ionicons name="trash-outline" size={20} color={Colors.accent} />
                        <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.publishButton, (!newArticle.title.trim() || !newArticle.content.trim()) && styles.disabledButton]}
                        onPress={handleCreateArticle}
                        disabled={isCreating || !newArticle.title.trim() || !newArticle.content.trim()}
                    >
                        <LinearGradient
                            colors={[Colors.primary, '#ef8e33']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.publishGradient}
                        >
                            {isCreating ? (
                                <ActivityIndicator size="small" color={Colors.white} />
                            ) : (
                                <>
                                    <Text style={styles.publishButtonText}>Publish Alert</Text>
                                    <View style={styles.publishIcon}>
                                        <Feather name="arrow-right" size={12} color={Colors.white} />
                                    </View>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Section */}
            <View style={styles.searchSection}>
                <View style={styles.searchHeader}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIconWrapper}>
                            <Ionicons name="search" size={20} color={Colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.cardTitle}>Search Articles</Text>
                            <Text style={styles.cardSubtitle}>Find existing articles by title</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.searchContainer}>
                    <View style={styles.searchInputWrapper}>
                        <Ionicons name="search-outline" size={20} color={Colors.accent} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by title..."
                            placeholderTextColor={Colors.accent}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                                <Ionicons name="close-circle" size={20} color={Colors.accent} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity 
                        style={styles.searchButton}
                        onPress={handleSearch}
                        disabled={isSearching}
                    >
                        <LinearGradient
                            colors={[Colors.primary, '#ef8e33']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.searchGradient}
                        >
                            {isSearching ? (
                                <ActivityIndicator size="small" color={Colors.white} />
                            ) : (
                                <Text style={styles.searchButtonText}>Search</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Articles Section Header */}
            <View style={styles.articlesHeader}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                        <View style={styles.sectionIconWrapper}>
                            <Ionicons name="list" size={18} color={Colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.sectionTitle}>All Articles</Text>
                            <Text style={styles.sectionSubtitle}>{articles.length} total</Text>
                        </View>
                    </View>
                    {showSearch && searchResults.length > 0 && (
                        <TouchableOpacity onPress={clearSearch}>
                            <Text style={styles.clearSearchText}>Clear Results</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </>
    );

    // Render footer for FlatList
    const renderFooter = () => {
        if (loadingMore) {
            return (
                <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                </View>
            );
        }
        if (!hasMore && articles.length > 0 && !showSearch) {
            return (
                <View style={styles.endMessage}>
                    <Text style={styles.endMessageText}>No more articles to load</Text>
                </View>
            );
        }
        return null;
    };

    // Render empty state
    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.accent} />
            <Text style={styles.emptyText}>No articles found</Text>
            <Text style={styles.emptySubtext}>Create your first article above</Text>
        </View>
    );

    // Render article item
    const renderArticleItem = ({ item }: { item: Article }) => (
        <TouchableOpacity
            onPress={() => handleViewArticle(item)}
            activeOpacity={0.85}
            style={styles.articleItem}
        >
            <LinearGradient
                colors={[Colors.surface, Colors.white]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.articleCard}
            >
                <View style={styles.articleHeader}>
                    <View style={styles.articleBadge}>
                        <Text style={styles.articleBadgeText}>ID: {item.id}</Text>
                    </View>
                    <Text style={styles.articleDate}>{formatDate(item.created_at)}</Text>
                </View>
                
                <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                
                <View style={styles.articleFooter}>
                    <View style={styles.articleActions}>
                        <TouchableOpacity 
                            onPress={() => handleEditArticle(item)}
                            style={styles.actionButton}
                        >
                            <Feather name="edit-2" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => handleDeleteArticle(item)}
                            style={styles.actionButton}
                        >
                            <Feather name="trash-2" size={16} color="#D32F2F" />
                        </TouchableOpacity>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
            
            {/* Use FlatList instead of ScrollView to avoid nesting issues */}
            <FlatList
                data={showSearch ? searchResults : articles}
                renderItem={renderArticleItem}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                onEndReached={showSearch ? undefined : loadMoreData}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
            />

            {/* Edit Modal */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <LinearGradient
                            colors={[Colors.secondary, '#3a3536']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.modalHeader}
                        >
                            <Text style={styles.modalTitle}>Edit Article</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.white} />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalLabel}>Title</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editTitle}
                                onChangeText={setEditTitle}
                                placeholder="Enter title..."
                                placeholderTextColor={Colors.accent}
                            />

                            <Text style={styles.modalLabel}>Content</Text>
                            <TextInput
                                style={[styles.modalInput, styles.modalTextArea]}
                                value={editContent}
                                onChangeText={setEditContent}
                                placeholder="Enter content..."
                                placeholderTextColor={Colors.accent}
                                multiline
                                textAlignVertical="top"
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalCancelButton]}
                                    onPress={() => setShowEditModal(false)}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalSaveButton, (!editTitle.trim() || !editContent.trim()) && styles.disabledButton]}
                                    onPress={handleSaveEdit}
                                    disabled={isSubmitting || !editTitle.trim() || !editContent.trim()}
                                >
                                    <LinearGradient
                                        colors={[Colors.primary, '#ef8e33']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.modalSaveGradient}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator size="small" color={Colors.white} />
                                        ) : (
                                            <Text style={styles.modalSaveText}>Save Changes</Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* View Modal */}
            <Modal
                visible={showViewModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowViewModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <LinearGradient
                            colors={[Colors.secondary, '#3a3536']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.modalHeader}
                        >
                            <Text style={styles.modalTitle} numberOfLines={1}>Article Details</Text>
                            <TouchableOpacity onPress={() => setShowViewModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.white} />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {selectedArticle && (
                                <>
                                    <View style={styles.viewMeta}>
                                        <View style={styles.viewBadge}>
                                            <Text style={styles.viewBadgeText}>ID: {selectedArticle.id}</Text>
                                        </View>
                                        <Text style={styles.viewDate}>
                                            {new Date(selectedArticle.created_at).toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.viewTitle}>{selectedArticle.title}</Text>
                                    <View style={styles.viewDivider} />
                                    <Text style={styles.viewContent}>{selectedArticle.content}</Text>
                                    
                                    <View style={styles.viewActions}>
                                        <TouchableOpacity
                                            style={[styles.viewActionButton, styles.viewEditButton]}
                                            onPress={() => handleEditArticle(selectedArticle)}
                                        >
                                            <Feather name="edit-2" size={18} color={Colors.white} />
                                            <Text style={styles.viewActionText}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.viewActionButton, styles.viewDeleteButton]}
                                            onPress={() => handleDeleteArticle(selectedArticle)}
                                        >
                                            <Feather name="trash-2" size={18} color={Colors.white} />
                                            <Text style={styles.viewActionText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    flatListContent: {
        paddingBottom: responsiveHeight(4),
    },
    skeletonContainer: {
        flex: 1,
        backgroundColor: Colors.white,
        paddingHorizontal: responsiveWidth(5),
        paddingTop: responsiveHeight(2),
    },
    skeletonCard: {
        minHeight: responsiveHeight(28),
        backgroundColor: Colors.muted,
        borderRadius: responsiveFont(24),
        marginBottom: responsiveHeight(2),
    },
    welcomeSection: {
        paddingHorizontal: responsiveWidth(5),
        paddingTop: responsiveHeight(2),
        marginBottom: responsiveHeight(2),
    },
    greeting: {
        fontSize: responsiveFont(14),
        color: Colors.accent,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    userName: {
        fontSize: responsiveFont(isSmallDevice ? 24 : 28),
        fontWeight: '800',
        color: Colors.secondary,
        marginTop: responsiveHeight(0.5),
    },
    welcomeSubtitle: {
        fontSize: responsiveFont(14),
        color: Colors.accent,
        marginTop: 4,
    },
    amberCard: {
        marginHorizontal: responsiveWidth(5),
        marginBottom: responsiveHeight(3),
        padding: responsiveWidth(6),
        borderRadius: responsiveFont(24),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 8,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: responsiveHeight(1) },
        shadowOpacity: 0.3,
        shadowRadius: responsiveFont(15),
    },
    amberCardContent: {
        flex: 1,
    },
    badgeContainer: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    badgeText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    headerIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerIconWrapper: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: 12,
        borderRadius: 16,
        marginRight: 12,
    },
    headerTitle: {
        color: Colors.white,
        fontSize: responsiveFont(20),
        fontWeight: '700',
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: responsiveFont(11),
        marginTop: 2,
    },
    cardGraphic: {
        width: responsiveWidth(15),
        height: responsiveWidth(15),
        borderRadius: responsiveWidth(7.5),
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputCard: {
        marginHorizontal: responsiveWidth(5),
        marginBottom: responsiveHeight(2),
        backgroundColor: Colors.white,
        borderRadius: responsiveFont(20),
        padding: responsiveWidth(5),
        borderWidth: 1,
        borderColor: Colors.muted,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(239, 142, 51, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardTitle: {
        fontSize: responsiveFont(16),
        fontWeight: '700',
        color: Colors.secondary,
    },
    cardSubtitle: {
        fontSize: responsiveFont(11),
        color: Colors.accent,
        marginTop: 2,
    },
    inputContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    titleInput: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.muted,
        borderRadius: 16,
        padding: 16,
        fontSize: responsiveFont(14),
        color: Colors.secondary,
        fontWeight: '500',
        paddingRight: 60,
    },
    charCounter: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: Colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    charCounterText: {
        color: Colors.accent,
        fontSize: 10,
        fontWeight: '500',
    },
    textInputContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    contentInput: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.muted,
        borderRadius: 16,
        padding: 16,
        fontSize: responsiveFont(14),
        color: Colors.secondary,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    contentCharCounter: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        gap: 8,
    },
    errorText: {
        flex: 1,
        color: '#D32F2F',
        fontSize: responsiveFont(12),
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    clearButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: Colors.muted,
        backgroundColor: Colors.white,
        gap: 8,
    },
    clearButtonText: {
        color: Colors.accent,
        fontWeight: '600',
        fontSize: responsiveFont(13),
    },
    publishButton: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 14,
    },
    publishGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    publishButtonText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: responsiveFont(13),
    },
    publishIcon: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 4,
        borderRadius: 20,
    },
    disabledButton: {
        opacity: 0.5,
    },
    searchSection: {
        marginHorizontal: responsiveWidth(5),
        marginBottom: responsiveHeight(2),
    },
    searchHeader: {
        marginBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.muted,
        borderRadius: 14,
        paddingHorizontal: 12,
        position: 'relative',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: Colors.secondary,
        fontSize: responsiveFont(14),
    },
    clearSearchButton: {
        padding: 4,
    },
    searchButton: {
        overflow: 'hidden',
        borderRadius: 14,
    },
    searchGradient: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButtonText: {
        color: Colors.white,
        fontWeight: '600',
        fontSize: responsiveFont(13),
    },
    articlesHeader: {
        paddingHorizontal: responsiveWidth(5),
        marginBottom: responsiveHeight(1),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    clearSearchText: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: responsiveFont(12),
    },
    articleItem: {
        paddingHorizontal: responsiveWidth(5),
        marginBottom: 10,
    },
    articleCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.muted,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    articleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    articleBadge: {
        backgroundColor: 'rgba(239, 142, 51, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    articleBadgeText: {
        color: Colors.primary,
        fontSize: 10,
        fontWeight: '600',
    },
    articleDate: {
        color: Colors.accent,
        fontSize: 11,
    },
    articleTitle: {
        fontSize: responsiveFont(15),
        fontWeight: '600',
        color: Colors.secondary,
        marginBottom: 10,
    },
    articleFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    articleActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: Colors.surface,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: Colors.secondary,
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtext: {
        color: Colors.accent,
        fontSize: 13,
        marginTop: 4,
    },
    loadingMore: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    endMessage: {
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 30,
    },
    endMessageText: {
        color: Colors.accent,
        fontSize: 12,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        width: '90%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
    },
    modalTitle: {
        color: Colors.white,
        fontSize: responsiveFont(18),
        fontWeight: '700',
        flex: 1,
    },
    modalBody: {
        padding: 20,
        maxHeight: 500,
    },
    modalLabel: {
        color: Colors.secondary,
        fontWeight: '600',
        fontSize: responsiveFont(13),
        marginBottom: 6,
        marginTop: 12,
    },
    modalInput: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.muted,
        borderRadius: 12,
        padding: 12,
        fontSize: responsiveFont(14),
        color: Colors.secondary,
    },
    modalTextArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        marginBottom: 10,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: Colors.muted,
        alignItems: 'center',
    },
    modalCancelText: {
        color: Colors.accent,
        fontWeight: '600',
        fontSize: responsiveFont(13),
    },
    modalSaveButton: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 12,
    },
    modalSaveGradient: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalSaveText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: responsiveFont(13),
    },
    viewMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    viewBadge: {
        backgroundColor: 'rgba(239, 142, 51, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    viewBadgeText: {
        color: Colors.primary,
        fontSize: 11,
        fontWeight: '600',
    },
    viewDate: {
        color: Colors.accent,
        fontSize: 12,
    },
    viewTitle: {
        fontSize: responsiveFont(20),
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 12,
    },
    viewDivider: {
        height: 1,
        backgroundColor: Colors.muted,
        marginVertical: 12,
    },
    viewContent: {
        fontSize: responsiveFont(14),
        color: Colors.accent,
        lineHeight: 22,
        marginBottom: 20,
    },
    viewActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    viewActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    viewEditButton: {
        backgroundColor: Colors.primary,
    },
    viewDeleteButton: {
        backgroundColor: '#D32F2F',
    },
    viewActionText: {
        color: Colors.white,
        fontWeight: '600',
        fontSize: responsiveFont(13),
    },
});