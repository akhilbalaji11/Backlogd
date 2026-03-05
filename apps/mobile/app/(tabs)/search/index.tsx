import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameCard } from '../../../src/components/game/GameCard';
import type { GameSearchResult } from '../../../src/domain/types';
import { gamesApi } from '../../../src/lib/api';
import { colors, radius, spacing, typography } from '../../../src/styles/tokens';

function useDebounce(value: string, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    const timeout = useCallback(
        (v: string) => {
            const t = setTimeout(() => setDebounced(v), delay);
            return () => clearTimeout(t);
        },
        [delay]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useState(() => timeout(value));
    const [, refresh] = useState(0);
    return debounced;
}

export default function SearchScreen() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // Debounce via effect
    useState(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 450);
        return () => clearTimeout(t);
    });

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['game-search', debouncedQuery],
        queryFn: () => gamesApi.search(debouncedQuery),
        enabled: debouncedQuery.length >= 2,
        staleTime: 1000 * 60 * 5,
        placeholderData: (prev) => prev,
    });

    const results: GameSearchResult[] = data?.results ?? [];

    return (
        <SafeAreaView style={styles.container}>
            {/* Search bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={colors.text.muted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search games…"
                    placeholderTextColor={colors.text.muted}
                    selectionColor={colors.purple[400]}
                    value={query}
                    onChangeText={(v) => {
                        setQuery(v);
                        setTimeout(() => setDebouncedQuery(v), 450);
                    }}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(''); setDebouncedQuery(''); }}>
                        <Ionicons name="close-circle" size={18} color={colors.text.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Results */}
            {isLoading || isFetching ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.purple[400]} />
                </View>
            ) : results.length > 0 ? (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.providerId}
                    renderItem={({ item }) => (
                        <GameCard
                            game={item}
                            onPress={() => router.push(`/game/${item.providerId}`)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            ) : debouncedQuery.length >= 2 ? (
                <View style={styles.center}>
                    <Ionicons name="game-controller-outline" size={48} color={colors.text.muted} />
                    <Text style={styles.emptyTitle}>No games found</Text>
                    <Text style={styles.emptyMsg}>Try a different title or spelling</Text>
                </View>
            ) : (
                <View style={styles.center}>
                    <Ionicons name="search" size={48} color={colors.text.muted} />
                    <Text style={styles.emptyTitle}>Find any game</Text>
                    <Text style={styles.emptyMsg}>Search by title to log, rate, and review</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: spacing.lg,
        paddingHorizontal: spacing.base,
        backgroundColor: colors.bg.secondary,
        borderRadius: radius.xl,
        borderWidth: 1.5,
        borderColor: colors.border,
        height: 48,
    },
    searchIcon: { marginRight: spacing.sm },
    searchInput: {
        flex: 1,
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: colors.text.primary,
        paddingVertical: 0,
    },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    separator: { height: spacing.sm },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    emptyTitle: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    emptyMsg: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textAlign: 'center' },
});
