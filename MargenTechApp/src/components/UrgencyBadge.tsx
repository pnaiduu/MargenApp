import { StyleSheet, Text, View } from 'react-native'
import { colors, typography } from '../theme'

const labels: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  emergency: 'Emergency',
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const u = urgency || 'normal'
  const bg =
    u === 'emergency' ? colors.danger : u === 'urgent' ? colors.urgent : u === 'high' ? colors.high : colors.surface2
  const fg = u === 'emergency' || u === 'urgent' || u === 'high' ? '#111827' : colors.muted

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Text style={[styles.txt, { color: fg }]}>{labels[u] ?? labels.normal}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 28,
    justifyContent: 'center',
  },
  txt: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
})
