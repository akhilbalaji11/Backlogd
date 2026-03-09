import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCard } from '../../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import {
    AVAILABLE_GENRES,
    type GameSearchResult,
    type Platform,
    type SearchMatchType,
} from '../../../src/domain/types';
import { gamesApi } from '../../../src/lib/api';
import { useAppTheme } from '../../../src/theme/appTheme';

type SearchSort = 'best_match' | 'rating' | 'hypes' | 'first_release_date';
type ReleaseWindow = 'any' | 'modern' | 'late2010s' | 'millennium' | 'retro';

type SearchFilters = {
    scopes: SearchMatchType[];
    sort: SearchSort;
    genres: number[];
    platforms: Platform[];
    minRating?: number;
    maxRating?: number;
    releaseWindow: ReleaseWindow;
};

const SEARCH_SCOPE_OPTIONS: Array<{
    value: SearchMatchType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    { value: 'title', label: 'Games', icon: 'game-controller-outline' },
    { value: 'company', label: 'Studios', icon: 'business-outline' },
    { value: 'character', label: 'Characters', icon: 'person-outline' },
];

const SEARCH_SORT_OPTIONS: Array<{ value: SearchSort; label: string; copy: string }> = [
    { value: 'best_match', label: 'Best Match', copy: 'Keep relevance first for typed searches.' },
    { value: 'rating', label: 'Top Rated', copy: 'Push the strongest IGDB scores upward.' },
    { value: 'first_release_date', label: 'Newest', copy: 'Favor newer releases inside the result set.' },
];

const BROWSE_SORT_OPTIONS: Array<{ value: SearchSort; label: string; copy: string }> = [
    { value: 'rating', label: 'Top Rated', copy: 'Highest IGDB scores first.' },
    { value: 'hypes', label: 'Trending', copy: 'Live browse feed ordered by current hype.' },
    { value: 'first_release_date', label: 'Newest', copy: 'Fresh releases first.' },
];

const RELEASE_WINDOW_OPTIONS: Array<{ value: ReleaseWindow; label: string; copy: string }> = [
    { value: 'any', label: 'Any Time', copy: 'Pull from the full catalog.' },
    { value: 'modern', label: '2020+', copy: 'Recent console cycle and onward.' },
    { value: 'late2010s', label: '2010-2019', copy: 'Modern classics and the last generation.' },
    { value: 'millennium', label: '2000-2009', copy: 'Sixth and seventh generation staples.' },
    { value: 'retro', label: 'Before 2000', copy: 'Arcade, cartridge, and early 3D eras.' },
];

const PLATFORM_OPTIONS: Platform[] = ['PS5', 'PS4', 'Xbox', 'Switch', 'PC', 'iOS', 'Android', 'Other'];

const GENRE_LABEL_BY_ID = new Map(AVAILABLE_GENRES.map((genre) => [genre.id, genre.name]));

function createDefaultFilters(): SearchFilters {
    return {
        scopes: SEARCH_SCOPE_OPTIONS.map((option) => option.value),
        sort: 'best_match',
        genres: [],
        platforms: [],
        releaseWindow: 'any',
    };
}

function toggleArrayValue<T extends string | number>(items: T[], value: T): T[] {
    return items.includes(value)
        ? items.filter((item) => item !== value)
        : [...items, value];
}

function toggleScope(scopes: SearchMatchType[], value: SearchMatchType): SearchMatchType[] {
    if (!scopes.includes(value)) {
        return [...scopes, value];
    }

    if (scopes.length === 1) {
        return scopes;
    }

    return scopes.filter((scope) => scope !== value);
}

function parseOptionalRating(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(100, Math.max(0, Math.round(parsed)));
}

function normalizeFilters(filters: SearchFilters): SearchFilters {
    const normalizedScopes = filters.scopes.length > 0 ? filters.scopes : SEARCH_SCOPE_OPTIONS.map((option) => option.value);
    const minRating = typeof filters.minRating === 'number' ? Math.min(100, Math.max(0, filters.minRating)) : undefined;
    const maxRating = typeof filters.maxRating === 'number' ? Math.min(100, Math.max(0, filters.maxRating)) : undefined;

    if (
        typeof minRating === 'number' &&
        typeof maxRating === 'number' &&
        minRating > maxRating
    ) {
        return {
            ...filters,
            scopes: normalizedScopes,
            minRating: maxRating,
            maxRating: minRating,
        };
    }

    return {
        ...filters,
        scopes: normalizedScopes,
        minRating,
        maxRating,
    };
}

function getReleaseBounds(window: ReleaseWindow): { from?: string; to?: string } {
    switch (window) {
        case 'modern':
            return { from: '2020-01-01' };
        case 'late2010s':
            return { from: '2010-01-01', to: '2019-12-31' };
        case 'millennium':
            return { from: '2000-01-01', to: '2009-12-31' };
        case 'retro':
            return { to: '1999-12-31' };
        default:
            return {};
    }
}

function normalizePlatformBucket(platformName: string): Platform {
    const value = platformName.toLowerCase();

    if (value.includes('playstation 5') || value.includes('ps5')) return 'PS5';
    if (value.includes('playstation 4') || value.includes('ps4')) return 'PS4';
    if (value.includes('xbox')) return 'Xbox';
    if (value.includes('switch')) return 'Switch';
    if (
        value.includes('windows')
        || value.includes('pc')
        || value.includes('steam')
        || value.includes('linux')
        || value.includes('mac')
    ) {
        return 'PC';
    }
    if (value.includes('ios') || value.includes('iphone') || value.includes('ipad')) return 'iOS';
    if (value.includes('android')) return 'Android';
    return 'Other';
}

function getPlatformBuckets(platforms: string[]): Set<Platform> {
    return new Set(platforms.map(normalizePlatformBucket));
}

function matchesReleaseWindow(
    releaseDate: string | undefined,
    bounds: { from?: string; to?: string },
): boolean {
    if (!bounds.from && !bounds.to) return true;
    if (!releaseDate) return false;

    const releaseTime = new Date(releaseDate).getTime();
    if (Number.isNaN(releaseTime)) return false;

    const fromTime = bounds.from ? new Date(bounds.from).getTime() : undefined;
    const toTime = bounds.to ? new Date(bounds.to).getTime() : undefined;

    if (typeof fromTime === 'number' && releaseTime < fromTime) return false;
    if (typeof toTime === 'number' && releaseTime > toTime) return false;
    return true;
}

function sortResults(results: GameSearchResult[], sort: SearchSort, textSearchEnabled: boolean): GameSearchResult[] {
    if (textSearchEnabled && sort === 'best_match') {
        return results;
    }

    if (sort === 'hypes') {
        return results;
    }

    const next = [...results];

    if (sort === 'first_release_date') {
        next.sort((left, right) => {
            const leftTime = left.releaseDate ? new Date(left.releaseDate).getTime() : 0;
            const rightTime = right.releaseDate ? new Date(right.releaseDate).getTime() : 0;
            return rightTime - leftTime;
        });
        return next;
    }

    next.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0));
    return next;
}

function buildActiveFilterLabels(filters: SearchFilters, textSearchEnabled: boolean): string[] {
    const labels: string[] = [];

    if (textSearchEnabled && filters.scopes.length < SEARCH_SCOPE_OPTIONS.length) {
        const scopeLabels = SEARCH_SCOPE_OPTIONS
            .filter((option) => filters.scopes.includes(option.value))
            .map((option) => option.label);
        labels.push(`Search In: ${scopeLabels.join(', ')}`);
    }

    if (textSearchEnabled) {
        if (filters.sort === 'rating') labels.push('Sorted: Top Rated');
        if (filters.sort === 'first_release_date') labels.push('Sorted: Newest');
    } else {
        if (filters.sort === 'hypes') labels.push('Sorted: Trending');
        if (filters.sort === 'first_release_date') labels.push('Sorted: Newest');
    }

    if (filters.genres.length > 0) {
        const [firstGenre, ...restGenres] = filters.genres
            .map((id) => GENRE_LABEL_BY_ID.get(id))
            .filter((value): value is string => Boolean(value));
        if (firstGenre) {
            labels.push(restGenres.length > 0 ? `Genres: ${firstGenre} +${restGenres.length}` : `Genre: ${firstGenre}`);
        }
    }

    if (filters.platforms.length > 0) {
        const [firstPlatform, ...restPlatforms] = filters.platforms;
        labels.push(restPlatforms.length > 0 ? `Platforms: ${firstPlatform} +${restPlatforms.length}` : `Platform: ${firstPlatform}`);
    }

    if (typeof filters.minRating === 'number' || typeof filters.maxRating === 'number') {
        const min = filters.minRating ?? 0;
        const max = filters.maxRating ?? 100;
        labels.push(`Rating: ${min}-${max}`);
    }

    if (filters.releaseWindow !== 'any') {
        const releaseLabel = RELEASE_WINDOW_OPTIONS.find((option) => option.value === filters.releaseWindow)?.label;
        if (releaseLabel) labels.push(`Era: ${releaseLabel}`);
    }

    return labels;
}

function ChoiceChip({
    label,
    icon,
    active,
    onPress,
}: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    active: boolean;
    onPress: () => void;
}) {
    const { theme } = useAppTheme();

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            style={[
                styles.choiceChip,
                {
                    backgroundColor: active ? `${theme.colors.hero.primary}18` : theme.colors.surface.glassStrong,
                    borderColor: active ? `${theme.colors.hero.primary}42` : theme.colors.border,
                },
            ]}
        >
            {icon ? <Ionicons name={icon} size={14} color={active ? theme.colors.hero.primary : theme.colors.text.secondary} /> : null}
            <Text style={[styles.choiceChipText, { color: active ? theme.colors.hero.primary : theme.colors.text.secondary }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function FilterSection({
    title,
    copy,
    children,
}: {
    title: string;
    copy: string;
    children: ReactNode;
}) {
    const { theme } = useAppTheme();

    return (
        <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>{title}</Text>
            <Text style={[styles.sectionCopy, { color: theme.colors.text.secondary }]}>{copy}</Text>
            <View style={styles.sectionChoices}>{children}</View>
        </View>
    );
}

export default function SearchScreen() {
    const { theme } = useAppTheme();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>(() => createDefaultFilters());
    const [draftFilters, setDraftFilters] = useState<SearchFilters>(() => createDefaultFilters());
    const [draftMinRatingInput, setDraftMinRatingInput] = useState('');
    const [draftMaxRatingInput, setDraftMaxRatingInput] = useState('');

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQuery(query.trim()), 320);
        return () => clearTimeout(handle);
    }, [query]);

    const textSearchEnabled = debouncedQuery.length >= 2;
    const browseReleaseBounds = useMemo(() => getReleaseBounds(filters.releaseWindow), [filters.releaseWindow]);
    const appliedFilterLabels = useMemo(
        () => buildActiveFilterLabels(filters, textSearchEnabled),
        [filters, textSearchEnabled],
    );
    const filterCount = appliedFilterLabels.length;
    const selectedGenreNames = useMemo(
        () => new Set(filters.genres.map((id) => GENRE_LABEL_BY_ID.get(id)).filter((value): value is string => Boolean(value))),
        [filters.genres],
    );

    const browseSort = !textSearchEnabled
        ? (filters.sort === 'best_match' ? 'rating' : filters.sort)
        : 'rating';

    const { data: rawResults = [], isLoading } = useQuery<GameSearchResult[]>({
        queryKey: [
            'search-screen',
            textSearchEnabled ? 'search' : 'browse',
            debouncedQuery,
            textSearchEnabled ? '' : filters.genres.slice().sort((left, right) => left - right).join(','),
            textSearchEnabled ? '' : filters.minRating ?? '',
            textSearchEnabled ? '' : filters.maxRating ?? '',
            textSearchEnabled ? '' : browseReleaseBounds.from ?? '',
            textSearchEnabled ? '' : browseReleaseBounds.to ?? '',
            textSearchEnabled ? '' : browseSort,
        ],
        queryFn: async () => {
            if (textSearchEnabled) {
                const response = await gamesApi.search(debouncedQuery, 1);
                return response.results;
            }

            const response = await gamesApi.browse({
                genres: filters.genres.length > 0 ? filters.genres : undefined,
                minRating: filters.minRating,
                maxRating: filters.maxRating,
                dateFrom: browseReleaseBounds.from,
                dateTo: browseReleaseBounds.to,
                sort: browseSort,
                sortOrder: 'desc',
                limit: 36,
            });
            return response.results;
        },
        staleTime: 0,
    });

    const displayResults = useMemo(() => {
        const filtered = rawResults.filter((game) => {
            const matchType = game.matchType ?? 'title';

            if (textSearchEnabled && !filters.scopes.includes(matchType)) {
                return false;
            }

            if (selectedGenreNames.size > 0 && !game.genres.some((genre) => selectedGenreNames.has(genre))) {
                return false;
            }

            if (filters.platforms.length > 0) {
                const platformBuckets = getPlatformBuckets(game.platforms);
                if (!filters.platforms.some((platform) => platformBuckets.has(platform))) {
                    return false;
                }
            }

            if (typeof filters.minRating === 'number' && (typeof game.rating !== 'number' || game.rating < filters.minRating)) {
                return false;
            }

            if (typeof filters.maxRating === 'number' && (typeof game.rating !== 'number' || game.rating > filters.maxRating)) {
                return false;
            }

            if (!matchesReleaseWindow(game.releaseDate, browseReleaseBounds)) {
                return false;
            }

            return true;
        });

        const effectiveSort = textSearchEnabled && filters.sort === 'hypes'
            ? 'best_match'
            : filters.sort;

        return sortResults(filtered, effectiveSort, textSearchEnabled);
    }, [browseReleaseBounds, filters, rawResults, selectedGenreNames, textSearchEnabled]);

    const syncDraftState = (nextFilters: SearchFilters) => {
        setDraftFilters(nextFilters);
        setDraftMinRatingInput(nextFilters.minRating?.toString() ?? '');
        setDraftMaxRatingInput(nextFilters.maxRating?.toString() ?? '');
    };

    const openFilters = () => {
        syncDraftState(filters);
        setShowFilters(true);
    };

    const closeFilters = () => {
        syncDraftState(filters);
        setShowFilters(false);
    };

    const resetDraftFilters = () => {
        syncDraftState(createDefaultFilters());
    };

    const applyDraftFilters = () => {
        setFilters(normalizeFilters({
            ...draftFilters,
            minRating: parseOptionalRating(draftMinRatingInput),
            maxRating: parseOptionalRating(draftMaxRatingInput),
        }));
        setShowFilters(false);
    };

    const draftSortOptions = textSearchEnabled ? SEARCH_SORT_OPTIONS : BROWSE_SORT_OPTIONS;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.topRow}>
                    <Text style={[styles.headline, { color: theme.colors.text.primary }]}>Search</Text>
                    <ThemeModeToggle compact />
                </View>

                <View style={styles.searchRow}>
                    <View
                        style={[
                            styles.searchShell,
                            {
                                backgroundColor: theme.colors.surface.glassStrong,
                                borderColor: theme.colors.border,
                            },
                        ]}
                    >
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
                        {query.length > 0 ? (
                            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.88}>
                                <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        onPress={openFilters}
                        activeOpacity={0.92}
                        style={[
                            styles.filterButton,
                            {
                                backgroundColor: theme.colors.surface.glassStrong,
                                borderColor: theme.colors.border,
                            },
                        ]}
                    >
                        <Ionicons name="options-outline" size={18} color={theme.colors.text.primary} />
                        {filterCount > 0 ? (
                            <View style={[styles.filterBadge, { backgroundColor: theme.colors.hero.primary }]}>
                                <Text style={styles.filterBadgeText}>{filterCount}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <View style={styles.center}>
                        <Ionicons name="sync" size={24} color={theme.colors.hero.primary} />
                        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>Searching the catalog...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={displayResults}
                        keyExtractor={(item) => item.providerId}
                        renderItem={({ item }) => (
                            <GameCard game={item} onPress={() => router.push(`/game/${item.providerId}`)} />
                        )}
                        contentContainerStyle={styles.results}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.resultsHeader}>
                                <View>
                                    <Text style={[styles.resultsTitle, { color: theme.colors.text.primary }]}>
                                        {textSearchEnabled ? 'Search Results' : 'Browse Highlights'}
                                    </Text>
                                    <Text style={[styles.resultsSubtitle, { color: theme.colors.text.secondary }]}>
                                        {textSearchEnabled
                                            ? 'Search scopes, sort, and filters are all controlled from the menu.'
                                            : 'Open the filter menu to refine the live browse feed.'}
                                    </Text>
                                </View>
                                <Text style={[styles.resultsCount, { color: theme.colors.text.secondary }]}>
                                    {displayResults.length} results
                                </Text>
                            </View>
                        }
                        ListEmptyComponent={
                            <View
                                style={[
                                    styles.emptyCard,
                                    {
                                        backgroundColor: theme.colors.surface.glassStrong,
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                            >
                                <Ionicons name="planet-outline" size={28} color={theme.colors.text.muted} />
                                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No results yet</Text>
                                <Text style={[styles.emptyCopy, { color: theme.colors.text.secondary }]}>
                                    Try broadening the query or relaxing a few filters from the menu.
                                </Text>
                            </View>
                        }
                    />
                )}

                <Modal
                    visible={showFilters}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={closeFilters}
                >
                    <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.bg.primary }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity onPress={closeFilters} activeOpacity={0.88}>
                                <Text style={[styles.modalAction, { color: theme.colors.text.secondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>Filters</Text>
                            <TouchableOpacity onPress={applyDraftFilters} activeOpacity={0.88}>
                                <Text style={[styles.modalActionStrong, { color: theme.colors.hero.primary }]}>Apply</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.modalBody}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <FilterSection
                                title="Search Scope"
                                copy="Choose what typed searches should match."
                            >
                                {SEARCH_SCOPE_OPTIONS.map((option) => (
                                    <ChoiceChip
                                        key={option.value}
                                        label={option.label}
                                        icon={option.icon}
                                        active={draftFilters.scopes.includes(option.value)}
                                        onPress={() => setDraftFilters((current) => ({
                                            ...current,
                                            scopes: toggleScope(current.scopes, option.value),
                                        }))}
                                    />
                                ))}
                            </FilterSection>

                            <FilterSection
                                title="Sort"
                                copy={textSearchEnabled
                                    ? 'Best Match preserves relevance. Top Rated and Newest reshuffle the visible search results.'
                                    : 'Sort the live browse results before platform and scope refinements are applied.'}
                            >
                                {draftSortOptions.map((option) => (
                                    <ChoiceChip
                                        key={option.value}
                                        label={option.label}
                                        active={draftFilters.sort === option.value}
                                        onPress={() => setDraftFilters((current) => ({ ...current, sort: option.value }))}
                                    />
                                ))}
                            </FilterSection>

                            <FilterSection title="Genres" copy="Games matching any selected genre stay in the result set.">
                                {AVAILABLE_GENRES.map((genre) => (
                                    <ChoiceChip
                                        key={genre.id}
                                        label={genre.name}
                                        active={draftFilters.genres.includes(genre.id)}
                                        onPress={() => setDraftFilters((current) => ({
                                            ...current,
                                            genres: toggleArrayValue(current.genres, genre.id),
                                        }))}
                                    />
                                ))}
                            </FilterSection>

                            <FilterSection title="Platforms" copy="Buckets detailed IGDB platform names into console families and storefront-friendly groups.">
                                {PLATFORM_OPTIONS.map((platform) => (
                                    <ChoiceChip
                                        key={platform}
                                        label={platform}
                                        active={draftFilters.platforms.includes(platform)}
                                        onPress={() => setDraftFilters((current) => ({
                                            ...current,
                                            platforms: toggleArrayValue(current.platforms, platform),
                                        }))}
                                    />
                                ))}
                            </FilterSection>

                            <FilterSection title="Release Window" copy="Focus the catalog on a specific era of games.">
                                {RELEASE_WINDOW_OPTIONS.map((option) => (
                                    <ChoiceChip
                                        key={option.value}
                                        label={option.label}
                                        active={draftFilters.releaseWindow === option.value}
                                        onPress={() => setDraftFilters((current) => ({
                                            ...current,
                                            releaseWindow: option.value,
                                        }))}
                                    />
                                ))}
                            </FilterSection>

                            <FilterSection title="Rating Range" copy="Use IGDB scores from 0 to 100. Leave either side blank to keep it open-ended.">
                                <View style={styles.rangeRow}>
                                    <View
                                        style={[
                                            styles.rangeField,
                                            {
                                                backgroundColor: theme.colors.surface.glassStrong,
                                                borderColor: theme.colors.border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.rangeLabel, { color: theme.colors.text.secondary }]}>Min Rating</Text>
                                        <TextInput
                                            value={draftMinRatingInput}
                                            onChangeText={setDraftMinRatingInput}
                                            placeholder="70"
                                            placeholderTextColor={theme.colors.text.muted}
                                            keyboardType="number-pad"
                                            returnKeyType="done"
                                            selectTextOnFocus
                                            style={[styles.rangeInput, { color: theme.colors.text.primary }]}
                                        />
                                    </View>
                                    <View
                                        style={[
                                            styles.rangeField,
                                            {
                                                backgroundColor: theme.colors.surface.glassStrong,
                                                borderColor: theme.colors.border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.rangeLabel, { color: theme.colors.text.secondary }]}>Max Rating</Text>
                                        <TextInput
                                            value={draftMaxRatingInput}
                                            onChangeText={setDraftMaxRatingInput}
                                            placeholder="100"
                                            placeholderTextColor={theme.colors.text.muted}
                                            keyboardType="number-pad"
                                            returnKeyType="done"
                                            selectTextOnFocus
                                            style={[styles.rangeInput, { color: theme.colors.text.primary }]}
                                        />
                                    </View>
                                </View>
                            </FilterSection>

                            <TouchableOpacity
                                onPress={resetDraftFilters}
                                activeOpacity={0.9}
                                style={[
                                    styles.resetButton,
                                    {
                                        backgroundColor: theme.colors.surface.glassStrong,
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                            >
                                <Ionicons name="refresh" size={16} color={theme.colors.text.secondary} />
                                <Text style={[styles.resetButtonText, { color: theme.colors.text.secondary }]}>Reset Filters</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>
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
        alignItems: 'center',
        marginBottom: 16,
    },
    headline: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.3,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    searchShell: {
        flex: 1,
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
    filterButton: {
        width: 56,
        height: 56,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    filterBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: '#130d09',
        fontSize: 10,
        fontFamily: 'Inter_700Bold',
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
        paddingBottom: 24,
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    resultsTitle: {
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    resultsSubtitle: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Inter_400Regular',
        maxWidth: 240,
    },
    resultsCount: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        marginTop: 2,
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
    modal: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalAction: {
        fontSize: 15,
        fontFamily: 'Inter_500Medium',
    },
    modalActionStrong: {
        fontSize: 15,
        fontFamily: 'Inter_700Bold',
    },
    modalTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
    modalBody: {
        padding: 20,
        paddingBottom: 48,
        gap: 18,
    },
    sectionBlock: {
        gap: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
    sectionCopy: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
    },
    sectionChoices: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    choiceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    choiceChipText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    rangeRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    rangeField: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    rangeLabel: {
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    rangeInput: {
        marginTop: 8,
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        paddingVertical: 0,
    },
    resetButton: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 20,
        borderWidth: 1,
        paddingVertical: 14,
    },
    resetButtonText: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
    },
});
