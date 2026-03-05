import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../../styles/tokens';

interface StarRatingProps {
    value: number;   // 0 to 5, increments of 0.5
    onChange?: (rating: number) => void;
    size?: number;
    readonly?: boolean;
}

export function StarRating({ value, onChange, size = 24, readonly = false }: StarRatingProps) {
    const [hovered, setHovered] = useState<number>(0);
    const display = hovered > 0 ? hovered : value;

    const handlePress = (starIndex: number, half: boolean) => {
        if (readonly || !onChange) return;
        const newRating = half ? starIndex - 0.5 : starIndex;
        onChange(newRating === value ? 0 : newRating);
    };

    const getStarIcon = (starIndex: number): 'star' | 'star-half' | 'star-outline' => {
        if (display >= starIndex) return 'star';
        if (display >= starIndex - 0.5) return 'star-half';
        return 'star-outline';
    };

    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((star) => (
                <View key={star} style={styles.starWrapper}>
                    <Ionicons
                        name={getStarIcon(star)}
                        size={size}
                        color={display >= star - 0.5 ? colors.star : colors.text.muted}
                        style={styles.starIcon}
                    />
                    {!readonly && onChange && (
                        <>
                            {/* Left Half (Half star) */}
                            <TouchableOpacity
                                style={styles.halfLeft}
                                onPress={() => handlePress(star, true)}
                                activeOpacity={0.7}
                            />
                            {/* Right Half (Full star) */}
                            <TouchableOpacity
                                style={styles.halfRight}
                                onPress={() => handlePress(star, false)}
                                activeOpacity={0.7}
                            />
                        </>
                    )}
                </View>
            ))}
            {value > 0 && !readonly && (
                <Text style={[styles.ratingText, { fontSize: size * 0.6 }]}>{value.toFixed(1)}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    starWrapper: { position: 'relative' },
    starIcon: { padding: spacing.xs },
    halfLeft: {
        position: 'absolute',
        left: 0, top: 0, bottom: 0, width: '50%',
        zIndex: 2,
    },
    halfRight: {
        position: 'absolute',
        right: 0, top: 0, bottom: 0, width: '50%',
        zIndex: 2,
    },
    ratingText: { fontFamily: 'Inter_600SemiBold', color: colors.star, marginLeft: spacing.sm },
});
