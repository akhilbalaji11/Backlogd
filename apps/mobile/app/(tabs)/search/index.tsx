import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCard } from '../../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import { AVAILABLE_GENRES, type GameSearchResult } from '../../../src/domain/types';
import { gamesApi } from '../../../src/lib/api';
import { useAppTheme } from '../../../src/theme/appTheme';

const SORT_PRESETS = [
    { label: 'Top Rated', value: 'rating' as const },
    { label: 'Trending', value: 'hypes' as const },
    { label: 'New', value: 'first_release_date' as const },
];

export default function SearchScreen() {
    const { theme } = useAppTheme();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
    const [sort, setSort] = useState<'rating' | 'hypes' | 'first_release_date' | null>('rating');

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQuery(query.trim()), 320);
        return () => clearTimeout(handle);
    }, [query]);

    const textSearchEnabled = debouncedQuery.length >= 2;

    const { data: results = [], isLoading } = useQuery<GameSearchResult[]>({
        queryKey: ['search-screen', debouncedQuery, selectedGenres, sort],
        queryFn: async () => {
            if (textSearchEnabled) {
                const response = await gamesApi.search(debouncedQuery, 1);
                return response.results;
            }

            const response = await gamesApi.browse({
                genres: selectedGenres.length > 0 ? selectedGenres : undefined,
                sort: sort ?? 'rating',
                sortOrder: 'desc',
                limit: 24,
            });
            return response.results;
        },
        staleTime: 0,
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.topRow}>
                    <View>
                        <Text style={[styles.kicker, { color: theme.colors.hero.secondary }]}>Studio + Character Search</Text>
                        <Text style={[styles.headline, { color: theme.colors.text.primary }]}>Search</Text>
                    </View>
                    <ThemeModeToggle compact />
                </View>

                <View style={[styles.searchShell, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                    <Ionicons name="search" size={18} color={theme.colors.text.secondary} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search games, studios, or characters"
                        placeholderTextColor={theme.colors.text.muted}
                        style={[styles.searchInput, { color: theme.colors.text.primary }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={[styles.helperText, { color: theme.colors.text.secondary }]}>
                    Try `fromsoftware`, `bethesda`, `geralt`, or `ellie`.
                </Text>

                <View style={styles.filterStack}>
                    <FlatChipRow
                        items={SORT_PRESETS.map((preset) => ({
                            key: preset.value,
                            label: preset.label,
                            active: sort === preset.value,
                            onPress: () => setSort(preset.value),
                        }))}
                    />
                    <FlatChipRow
                        items={AVAILABLE_GENRES.slice(0, 8).map((genre) => ({
                            key: String(genre.id),
                            label: genre.name,
                            active: selectedGenres.includes(genre.id),
                            onPress: () => setSelectedGenres((current) => (
                                current.includes(genre.id)
                                    ? current.filter((id) => id !== genre.id)
                                    : [...current, genre.id]
                            )),
                        }))}
                    />
                </View>

                {isLoading ? (
                    <View style={styles.center}>
                        <Ionicons name="sync" size={24} color={theme.colors.hero.primary} />
                        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>Searching the catalog...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.providerId}
                        renderItem={({ item }) => (
                            <GameCard game={item} onPress={() => router.push(`/game/${item.providerId}`)} />
                        )}
                        contentContainerStyle={styles.results}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.resultsHeader}>
                                <Text style={[styles.resultsTitle, { color: theme.colors.text.primary }]}>
                                    {textSearchEnabled ? 'Matches' : 'Browse Highlights'}
                                </Text>
                                <Text style={[styles.resultsCount, { color: theme.colors.text.secondary }]}>
                                    {results.length} results
                                </Text>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                                <Ionicons name="planet-outline" size={28} color={theme.colors.text.muted} />
                                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No results yet</Text>
                                <Text style={[styles.emptyCopy, { color: theme.colors.text.secondary }]}>
                                    Broaden the search or swap to a studio or character name.
                                </Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

function FlatChipRow({
    items,
}: {
    items: Array<{ key: string; label: string; active: boolean; onPress: () => void }>;
}) {
    const { theme } = useAppTheme();

    return (
        <View style={styles.chipRow}>
            {items.map((item) => (
                <TouchableOpacity
                    key={item.key}
                    onPress={item.onPress}
                    style={[
                        styles.chip,
                        {
                            backgroundColor: item.active ? `${theme.colors.hero.primary}18` : theme.colors.surface.glassStrong,
                            borderColor: item.active ? `${theme.colors.hero.primary}40` : theme.colors.border,
                        },
                    ]}
                >
                    <Text style={[styles.chipText, { color: item.active ? theme.colors.hero.primary : theme.colors.text.secondary }]}>
                        {item.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    kicker: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    headline: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.3,
    },
    searchShell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 16,
        minHeight: 56,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Inter_500Medium',
        paddingVertical: 14,
    },
    helperText: {
        marginTop: 10,
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
    },
    filterStack: {
        gap: 12,
        marginTop: 18,
        marginBottom: 16,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    chipText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
    },
    results: {
        gap: 10,
        paddingBottom: 20,
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    resultsTitle: {
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    resultsCount: {
        fontSize: 12,
        fontFamily: 'Inter_500Medium',
    },
    emptyCard: {
        borderRadius: 26,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
        marginTop: 40,
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    emptyCopy: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        fontFamily: 'Inter_400Regular',
    },
});
