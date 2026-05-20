import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { layout, typography } from '../theme'

export function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.page }]}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 32, paddingTop: 12 }}
    >
      <Text style={[styles.title, { color: colors.text }]}>Privacy policy (Technician)</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.h, { color: colors.text }]}>What data is collected</Text>
        <Text style={[styles.p, { color: colors.muted }]}>
          - Your GPS location (latitude/longitude){'\n'}
          - A timestamp for each location update
        </Text>

        <Text style={[styles.h, { color: colors.text }]}>When location is collected</Text>
        <Text style={[styles.p, { color: colors.muted }]}>
          Location sharing is collected and transmitted only while you are clocked in. When you clock out, location
          sharing stops immediately.
        </Text>

        <Text style={[styles.h, { color: colors.text }]}>How often</Text>
        <Text style={[styles.p, { color: colors.muted }]}>While clocked in, the app sends location updates about every 60 seconds.</Text>

        <Text style={[styles.h, { color: colors.text }]}>Who can see it</Text>
        <Text style={[styles.p, { color: colors.muted }]}>
          - You can view your own location history for the day.{'\n'}
          - The owner can only see your live location during work hours (while clocked in). No historical location
          trail is shown to the owner.
        </Text>

        <Text style={[styles.h, { color: colors.text }]}>Why</Text>
        <Text style={[styles.p, { color: colors.muted }]}>
          This helps dispatch, routing, and lets the owner see which technician is actively heading to time-sensitive
          jobs.
        </Text>
      </View>
    </ScrollView>
  )
}

export default PrivacyPolicyScreen

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  card: {
    marginTop: 14,
    borderRadius: layout.radius,
    borderWidth: 1,
    padding: 14,
  },
  h: { marginTop: 10, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  p: { marginTop: 6, fontSize: typography.body, lineHeight: 22 },
})
