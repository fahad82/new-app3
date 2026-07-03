import { Colors } from '@/constants/theme';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { SlideInLeft } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';

interface Article {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

interface CategoryItem {
  id: number;
  title: string;
  icon: string;
  iconSet: React.ComponentType<any>;
  count: string;
  color: string;
}

const { width, height } = Dimensions.get('window');

// Responsive utilities matching Dashboard style
const responsiveWidth = (percentage: number) => (width * percentage) / 100;
const responsiveHeight = (percentage: number) => (height * percentage) / 100;
const responsiveFont = (size: number) => {
  const scaleFactor = Math.min(width / 375, 1.2);
  return Math.round(size * scaleFactor);
};

const isSmallDevice = width < 375;
const isTablet = width >= 768;

export default function AlertsScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 10;

  const featuredScrollRef = useRef<ScrollView>(null);
  const isFetchingRef = useRef(false);

  const BASE_URL = Constants.expoConfig?.extra?.baseUrl as string || 
                   process.env.EXPO_PUBLIC_BASE_URL || 
                   "https://vtssmartsolutions.com";
  const API_URL = `${BASE_URL}/api/news/list`;

  // Fetch news with pagination
  const fetchNews = useCallback(async (pageNum = 1, isRefreshing = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (pageNum > 1) setLoadingMore(true);

    try {
      const offset = (pageNum - 1) * LIMIT;
      const response = await axios.get(`${API_URL}?offset=${offset}&limit=${LIMIT}`);
      const newArticles = response.data.articles || [];

      setArticles(prev => {
        if (isRefreshing) return newArticles;
        const existingIds = new Set(prev.map(a => a.id));
        const filteredNew = newArticles.filter((a: Article) => !existingIds.has(a.id));
        return [...prev, ...filteredNew];
      });

      const total = response.data.total || 0;
      setHasMore(offset + newArticles.length < total);
    } catch (error) {
      console.error("Fetch Error:", error);
      Alert.alert("Error", "Failed to load articles");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [API_URL, LIMIT]);

  useEffect(() => {
    fetchNews(1);
  }, [fetchNews]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchNews(1, true);
  };

  const loadMoreData = () => {
    if (!loadingMore && hasMore && !refreshing) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNews(nextPage);
    }
  };

  const handleViewArticle = (article: Article) => {
    setSelectedArticle(article);
    setShowViewer(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: diffDays > 365 ? 'numeric' : undefined
      });
    }
  };

  // Categories data with theme colors
  const categories: CategoryItem[] = [
    {
      id: 1,
      title: 'All News',
      icon: 'newspaper',
      iconSet: Ionicons,
      count: articles.length.toString(),
      color: Colors.secondary
    },
    {
      id: 2,
      title: 'Recent',
      icon: 'time',
      iconSet: Ionicons,
      count: articles.filter(a => {
        const diffHours = (new Date().getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
        return diffHours < 24;
      }).length.toString(),
      color: Colors.accent
    },
    {
      id: 3,
      title: 'Today',
      icon: 'today',
      iconSet: Ionicons,
      count: articles.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length.toString(),
      color: Colors.primary
    }
  ];

  const LoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </View>
  );

  const renderArticleItem = ({ item, index }: { item: Article; index: number }) => (
    <Animated.View
      entering={SlideInLeft.delay(Math.min(index * 50, 400)).duration(400)}
      style={styles.articleItemWrapper}
    >
      <TouchableOpacity
        onPress={() => handleViewArticle(item)}
        activeOpacity={0.85}
        style={styles.articleCard}
      >
        <LinearGradient
          colors={[Colors.secondary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.articleGradient}
        >
          <View style={styles.articleIconWrapper}>
            <FontAwesome5 name="file-alt" size={20} color={Colors.primary} />
          </View>

          <View style={styles.articleContent}>
            <View style={styles.articleMeta}>
              <View style={styles.articleBadge}>
                <Text style={styles.articleBadgeText}>Latest</Text>
              </View>
              <Text style={styles.articleDate}>{formatDate(item.created_at)}</Text>
            </View>

            <Text style={styles.articleTitle} numberOfLines={1}>
              {item.title}
            </Text>

            <View style={styles.articlePreview}>
              <Ionicons name="reader-outline" size={12} color={Colors.primary} />
              <Text style={styles.articlePreviewText} numberOfLines={1}>
                {item.content.replace(/<[^>]*>/g, '').substring(0, 50)}...
              </Text>
            </View>
          </View>

          <View style={styles.articleArrow}>
            <Ionicons name="chevron-forward" size={16} color={Colors.white} />
          </View>

          <View style={styles.articleDecoration} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderListHeader = () => (
    <View>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} translucent={true} />

      {/* Welcome Section - Matching Dashboard style */}
      <View style={styles.welcomeSection}>
        <Text style={styles.greeting}>News Center</Text>
        <Text style={styles.userName}>Time for a quick update!</Text>
        <Text style={styles.welcomeSubtitle}>Here's what's happening today</Text>
      </View>

      {/* Header Banner - Using theme colors */}
      <LinearGradient
        colors={[Colors.primary, '#ef8e33']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.amberCard}
      >
        <View style={styles.amberCardContent}>
          <Text style={styles.cardTitle}>Latest Updates</Text>
          <Text style={styles.softwareDescription}>
            Stay informed with the latest news, announcements, and alerts from your fleet management system.
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Live Feed Active</Text>
          </View>
        </View>
        <View style={styles.cardGraphic}>
          <MaterialCommunityIcons name="newspaper-variant" size={28} color={Colors.white} />
          <Text style={styles.cardGraphicText}>{articles.length}</Text>
        </View>
      </LinearGradient>

      {/* Categories Section - Matching section header style */}
      <View style={styles.categoriesSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionIconWrapper}>
              <MaterialCommunityIcons name="shape" size={responsiveFont(18)} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>News Status</Text>
              <Text style={styles.sectionSubtitle}>Filter by category</Text>
            </View>
          </View>
          <Text style={styles.filterText}>Filter by</Text>
        </View>

        <ScrollView
          ref={featuredScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          {categories.map((category) => {
            const IconComponent = category.iconSet;
            return (
              <TouchableOpacity
                key={category.id}
                activeOpacity={0.7}
                style={[styles.categoryCard, { borderBottomColor: category.color }]}
              >
                <View style={styles.categoryCardHeader}>
                  <View style={[styles.categoryIconWrapper, { backgroundColor: `${category.color}15` }]}>
                    <IconComponent name={category.icon} size={22} color={category.color} />
                  </View>
                  <View>
                    <Text style={styles.categoryCount}>{category.count}</Text>
                    <Text style={styles.categoryItemsLabel}>Items</Text>
                  </View>
                </View>
                <Text style={styles.categoryTitle}>{category.title}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Articles Section Header */}
      <View style={styles.articlesHeaderSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionIconWrapper}>
              <Ionicons name="layers" size={responsiveFont(18)} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>All Articles</Text>
              <Text style={styles.sectionSubtitle}>{articles.length} updates available</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.optionsButton}>
            <Ionicons name="options-outline" size={20} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderListFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    if (!hasMore && articles.length > 0) {
      return <Text style={styles.noMoreText}>No more news to show</Text>;
    }
    return null;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="newspaper-outline" size={64} color={Colors.accent} />
      <Text style={styles.emptyStateTitle}>No articles found</Text>
      <Text style={styles.emptyStateSubtitle}>Pull down to refresh</Text>
    </View>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  const sanitizeHtmlString = (str: string) => {
    if (!str) return '';
    return str.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={articles}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        onEndReached={loadMoreData}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      />

      {/* Article Viewer Modal */}
      <Modal
        visible={showViewer}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowViewer(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

          <LinearGradient
            colors={[Colors.secondary, Colors.secondary]}
            style={styles.modalHeader}
          >
            <View style={styles.modalHeaderContent}>
              <TouchableOpacity
                style={styles.modalBackButton}
                onPress={() => setShowViewer(false)}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
                <Text style={styles.modalBackText}>Back to List</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalActionButton}>
                  <Ionicons name="share-outline" size={20} color={Colors.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalActionButton}>
                  <Ionicons name="bookmark-outline" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {selectedArticle && (
            <WebView
              originWhitelist={['*']}
              source={{
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                    <style>
                      :root {
                        --primary: #231F20;
                        --accent: #ef8e33;
                        --text-main: #1f2937;
                        --text-light: #6b7280;
                        --bg: #f8fafc;
                      }
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      
                      body {
                        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        background-color: var(--bg);
                        color: var(--text-main);
                        padding: 16px;
                        line-height: 1.6;
                      }

                      .main-card {
                        background: white;
                        border-radius: 28px;
                        padding: 24px;
                        box-shadow: 0 10px 25px rgba(35, 31, 32, 0.08);
                        border: 1px solid rgba(35, 31, 32, 0.05);
                      }

                      .badge {
                        display: inline-flex;
                        align-items: center;
                        background: linear-gradient(135deg, var(--primary), var(--primary));
                        color: white;
                        padding: 6px 14px;
                        border-radius: 10px;
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 16px;
                      }

                      .title {
                        font-size: 24px;
                        font-weight: 800;
                        color: var(--primary);
                        line-height: 1.2;
                        margin-bottom: 20px;
                      }

                      .meta-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        padding-bottom: 20px;
                        margin-bottom: 24px;
                        border-bottom: 1px dashed #e2e8f0;
                      }

                      .meta-pill {
                        background: #f1f5f9;
                        padding: 6px 12px;
                        border-radius: 8px;
                        font-size: 12px;
                        color: var(--primary);
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                      }

                      .article-content {
                        font-size: 16px;
                        color: #334155;
                      }

                      .article-content p { margin-bottom: 18px; }

                      .article-content h1, .article-content h2 {
                        color: var(--primary);
                        margin: 24px 0 12px 0;
                        font-size: 20px;
                      }

                      .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #f1f5f9;
                        text-align: center;
                        font-size: 12px;
                        color: var(--text-light);
                      }
                    </style>
                  </head>
                  <body>
                    <div class="main-card">
                      <div class="badge">News Update</div>
                      <h1 class="title">${sanitizeHtmlString(selectedArticle.title).replace(/'/g, "\\'")}</h1>
                      
                      <div class="meta-row">
                        <div class="meta-pill">📅 ${new Date(selectedArticle.created_at).toLocaleDateString()}</div>
                        <div class="meta-pill">⏰ ${new Date(selectedArticle.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>

                      <div class="article-content">
                        ${sanitizeHtmlString(selectedArticle.content)}
                      </div>

                      <div class="footer">
                        Official News System • ${new Date().getFullYear()}
                      </div>
                    </div>
                  </body>
                  </html>
                `
              }}
              style={styles.webview}
              showsVerticalScrollIndicator={false}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webviewLoader}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              )}
            />
          )}
        </SafeAreaView>
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
    marginVertical: responsiveHeight(4),
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
  cardTitle: {
    color: Colors.white,
    fontSize: responsiveFont(16),
    fontWeight: '500',
    opacity: 0.9,
  },
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
  cardGraphic: {
    width: responsiveWidth(15),
    height: responsiveWidth(15),
    borderRadius: responsiveWidth(7.5),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGraphicText: {
    color: Colors.white,
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
  },
  categoriesSection: {
    marginBottom: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(5),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(1.5),
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
  filterText: {
    color: Colors.accent,
    fontSize: responsiveFont(12),
    fontWeight: '500',
  },
  categoriesScrollContent: {
    paddingBottom: 10,
  },
  categoryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    minWidth: 130,
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.muted,
    borderBottomWidth: 3.5,
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryIconWrapper: {
    padding: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  categoryCount: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 18,
    lineHeight: 22,
  },
  categoryItemsLabel: {
    color: Colors.accent,
    fontSize: 10,
  },
  categoryTitle: {
    color: Colors.secondary,
    fontWeight: '600',
    fontSize: 13,
  },
  articlesHeaderSection: {
    paddingHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(1),
  },
  optionsButton: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  articleItemWrapper: {
    paddingHorizontal: responsiveWidth(5),
    marginBottom: 4,
  },
  articleCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  articleGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleIconWrapper: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 14,
  },
  articleContent: {
    flex: 1,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  articleBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  articleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
    textTransform: 'uppercase',
  },
  articleDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '500',
  },
  articleTitle: {
    color: Colors.white,
    fontSize: responsiveFont(15),
    fontWeight: 'bold',
    marginBottom: 4,
  },
  articlePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articlePreviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginLeft: 4,
    flex: 1,
  },
  articleArrow: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 20,
  },
  articleDecoration: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
  },
  emptyState: {
    paddingVertical: responsiveHeight(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: responsiveFont(16),
    fontWeight: '600',
    color: Colors.secondary,
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontSize: responsiveFont(12),
    color: Colors.accent,
    marginTop: 4,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noMoreText: {
    textAlign: 'center',
    color: Colors.accent,
    paddingVertical: 20,
    fontSize: responsiveFont(12),
    marginBottom: 30,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackText: {
    color: Colors.white,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: responsiveFont(14),
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalActionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  webviewLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
});