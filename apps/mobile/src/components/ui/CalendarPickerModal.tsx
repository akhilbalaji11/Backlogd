import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { radius, spacing, typography } from '../../styles/tokens';
import { useAppTheme } from '../../theme/appTheme';

interface CalendarPickerModalProps {
    visible: boolean;
    value: Date;
    maxDate: Date;
    onChange: (date: Date) => void;
    onRequestClose: () => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(left: Date, right: Date) {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

function buildCalendarDays(month: Date) {
    const firstDay = startOfMonth(month);
    const leadingBlankDays = firstDay.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days: Array<Date | null> = [];

    for (let index = 0; index < leadingBlankDays; index += 1) {
        days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        days.push(new Date(month.getFullYear(), month.getMonth(), day));
    }

    while (days.length % 7 !== 0) {
        days.push(null);
    }

    return days;
}

export function CalendarPickerModal({
    visible,
    value,
    maxDate,
    onChange,
    onRequestClose,
}: CalendarPickerModalProps) {
    const { theme } = useAppTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [displayMonth, setDisplayMonth] = useState(startOfMonth(value));

    const normalizedValue = startOfDay(value);
    const normalizedMaxDate = startOfDay(maxDate);

    useEffect(() => {
        if (visible) {
            setDisplayMonth(startOfMonth(value));
        }
    }, [value, visible]);

    const monthDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1);
    const canMoveForward = nextMonth <= startOfMonth(normalizedMaxDate);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onRequestClose}
        >
            <Pressable style={styles.overlay} onPress={onRequestClose}>
                <Pressable
                    style={[styles.sheet, { backgroundColor: theme.colors.bg.primary, borderColor: theme.colors.border }]}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text.primary }]}>Choose a date</Text>
                        <Pressable style={styles.closeButton} onPress={onRequestClose}>
                            <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
                        </Pressable>
                    </View>

                    <View style={styles.monthRow}>
                        <Pressable
                            style={[styles.monthButton, { backgroundColor: theme.colors.surface.glassStrong }]}
                            onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
                        >
                            <Ionicons name="chevron-back" size={18} color={theme.colors.text.primary} />
                        </Pressable>
                        <Text style={[styles.monthLabel, { color: theme.colors.text.primary }]}>
                            {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </Text>
                        <Pressable
                            style={[
                                styles.monthButton,
                                { backgroundColor: theme.colors.surface.glassStrong },
                                !canMoveForward && styles.disabledMonthButton,
                            ]}
                            onPress={() => {
                                if (!canMoveForward) return;
                                setDisplayMonth(nextMonth);
                            }}
                        >
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.text.primary} />
                        </Pressable>
                    </View>

                    <View style={styles.weekdayRow}>
                        {WEEKDAY_LABELS.map((label) => (
                            <Text key={label} style={[styles.weekdayLabel, { color: theme.colors.text.muted }]}>
                                {label}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.grid}>
                        {monthDays.map((day, index) => {
                            if (!day) {
                                return <View key={`empty-${index}`} style={styles.dayCell} />;
                            }

                            const normalizedDay = startOfDay(day);
                            const isSelected = isSameDay(normalizedDay, normalizedValue);
                            const isToday = isSameDay(normalizedDay, normalizedMaxDate);
                            const isFuture = normalizedDay > normalizedMaxDate;

                            return (
                                <Pressable
                                    key={day.toISOString()}
                                    style={[
                                        styles.dayCell,
                                        styles.dayButton,
                                        { borderColor: theme.colors.border },
                                        isSelected && { backgroundColor: theme.colors.hero.primary, borderColor: theme.colors.hero.primary },
                                        isToday && !isSelected && { borderColor: theme.colors.hero.secondary },
                                        isFuture && styles.disabledDay,
                                    ]}
                                    disabled={isFuture}
                                    onPress={() => {
                                        onChange(normalizedDay);
                                        onRequestClose();
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.dayLabel,
                                            { color: isSelected ? theme.colors.bg.primary : theme.colors.text.primary },
                                            isFuture && { color: theme.colors.text.muted, opacity: 0.45 },
                                        ]}
                                    >
                                        {day.getDate()}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Text style={[styles.helperText, { color: theme.colors.text.secondary }]}>
                            Diary entries can only be logged up to today.
                        </Text>
                        <Pressable
                            style={[styles.todayButton, { backgroundColor: theme.colors.surface.glassStrong }]}
                            onPress={() => {
                                onChange(normalizedMaxDate);
                                onRequestClose();
                            }}
                        >
                            <Text style={[styles.todayButtonText, { color: theme.colors.hero.primary }]}>Use Today</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme']) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(8, 12, 18, 0.52)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    sheet: {
        width: '100%',
        maxWidth: 420,
        borderRadius: radius.xl,
        borderWidth: 1,
        padding: spacing.lg,
        gap: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: typography.size.lg,
        fontFamily: 'Inter_700Bold',
    },
    closeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface.glassStrong,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    monthButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledMonthButton: {
        opacity: 0.35,
    },
    monthLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
    },
    weekdayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    weekdayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: typography.size.xs,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    dayCell: {
        width: '13.4%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayButton: {
        borderRadius: radius.md,
        borderWidth: 1,
    },
    disabledDay: {
        opacity: 0.45,
    },
    dayLabel: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_600SemiBold',
    },
    footer: {
        borderTopWidth: 1,
        paddingTop: spacing.md,
        gap: spacing.sm,
    },
    helperText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        lineHeight: 20,
    },
    todayButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
    },
    todayButtonText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_700Bold',
    },
});
