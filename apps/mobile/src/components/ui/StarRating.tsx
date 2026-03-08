import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../theme/appTheme';

interface StarRatingProps {
    value: number;
    onChange?: (rating: number) => void;
    onCommit?: (rating: number) => void;
    size?: number;
    readonly?: boolean;
}

function GlowStar({
    filled,
    halfFilled,
    size,
    glowIntensity,
    activeColor,
    inactiveColor,
}: {
    filled: boolean;
    halfFilled: boolean;
    size: number;
    glowIntensity: Animated.Value;
    activeColor: string;
    inactiveColor: string;
}) {
    const getIcon = (): 'star' | 'star-half-full' | 'star-o' => {
        if (filled) return 'star';
        if (halfFilled) return 'star-half-full';
        return 'star-o';
    };

    const isActive = filled || halfFilled;

    return (
        <Animated.View
            style={[
                styles.starContainer,
                isActive && {
                    shadowColor: activeColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: glowIntensity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.25, 0.7],
                    }),
                    shadowRadius: glowIntensity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 12],
                    }),
                },
            ]}
        >
            <FontAwesome
                name={getIcon()}
                size={size}
                color={isActive ? activeColor : inactiveColor}
            />
        </Animated.View>
    );
}

export function StarRating({ value, onChange, onCommit, size = 30, readonly = false }: StarRatingProps) {
    const { theme } = useAppTheme();
    const display = value;
    const touchSize = size + 8;
    const trackWidthRef = useRef(0);
    const startLocalXRef = useRef(0);
    const glowAnim = useRef(new Animated.Value(0.5)).current;
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const onCommitRef = useRef(onCommit);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onCommitRef.current = onCommit;
    }, [onCommit]);

    useEffect(() => {
        if (readonly || !onChange) return;

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: false,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.5,
                    duration: 1500,
                    useNativeDriver: false,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, [glowAnim, onChange, readonly]);

    const resolveRatingFromLocalX = (localX: number): number => {
        const width = trackWidthRef.current;
        if (width <= 0) return Math.max(0.5, Math.min(5, valueRef.current || 0.5));

        const clamped = Math.max(0, Math.min(width, localX));
        const slotWidth = width / 5;
        const starIndex = Math.min(5, Math.max(1, Math.floor(clamped / slotWidth) + 1));
        const inSlotX = clamped - (starIndex - 1) * slotWidth;

        return inSlotX < slotWidth / 2 ? starIndex - 0.5 : starIndex;
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !readonly && !!onChangeRef.current,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: () => !readonly && !!onChangeRef.current,
            onMoveShouldSetPanResponderCapture: () => false,
            onPanResponderGrant: (event) => {
                if (readonly || !onChangeRef.current) return;
                startLocalXRef.current = event.nativeEvent.locationX;
                onChangeRef.current(resolveRatingFromLocalX(startLocalXRef.current));
            },
            onPanResponderMove: (_event, gestureState) => {
                if (readonly || !onChangeRef.current) return;
                onChangeRef.current(resolveRatingFromLocalX(startLocalXRef.current + gestureState.dx));
            },
            onPanResponderRelease: (_event, gestureState) => {
                if (readonly || !onChangeRef.current) return;
                const next = resolveRatingFromLocalX(startLocalXRef.current + gestureState.dx);
                onChangeRef.current(next);
                onCommitRef.current?.(next);
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderTerminate: (_event, gestureState) => {
                if (readonly || !onChangeRef.current) return;
                const next = resolveRatingFromLocalX(startLocalXRef.current + gestureState.dx);
                onChangeRef.current(next);
                onCommitRef.current?.(next);
            },
            onShouldBlockNativeResponder: () => true,
        })
    ).current;

    if (readonly) {
        return (
            <View style={styles.row}>
                <View style={styles.track}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <View
                            key={star}
                            pointerEvents="none"
                            style={[styles.starWrapper, { height: touchSize }]}
                        >
                            <FontAwesome
                                name={display >= star ? 'star' : display >= star - 0.5 ? 'star-half-full' : 'star-o'}
                                size={size}
                                color={display >= star - 0.5 ? theme.colors.star : theme.colors.starEmpty}
                            />
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.row}>
            <View
                style={styles.track}
                onLayout={(event) => {
                    trackWidthRef.current = event.nativeEvent.layout.width;
                }}
                {...panResponder.panHandlers}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <View
                        key={star}
                        pointerEvents="none"
                        style={[styles.starWrapper, { height: touchSize }]}
                    >
                        <GlowStar
                            filled={display >= star}
                            halfFilled={display >= star - 0.5 && display < star}
                            size={size}
                            glowIntensity={glowAnim}
                            activeColor={theme.colors.star}
                            inactiveColor={theme.colors.starEmpty}
                        />
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { width: '100%' },
    track: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    starWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 1,
        borderRadius: 9999,
    },
    starContainer: {},
});
