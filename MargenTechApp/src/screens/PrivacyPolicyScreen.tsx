import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, layout, typography } from '../theme'

export function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 32, paddingTop: insets.top + 12 }}
    >
      <Text style={styles.title}>Privacy policy (Technician)</Text>

      <View style={styles.card}>
        <Text style={styles.h}>What data is collected</Text>
        <Text style={styles.p}>
          - Your GPS location (latitude/longitude){'\n'}
          - A timestamp for each location update
        </Text>

        <Text style={styles.h}>When location is collected</Text>
        <Text style={styles.p}>
          Location sharing is collected and transmitted only while you are clocked in. When you clock out, location
          sharing stops immediately.
        </Text>

        <Text style={styles.h}>How often</Text>
        <Text style={styles.p}>While clocked in, the app sends location updates about every 60 seconds.</Text>

        <Text style={styles.h}>Who can see it</Text>
        <Text style={styles.p}>
          - You can view your own location history for the day.{'\n'}
          - The owner can only see your live location during work hours (while clocked in). No historical location
          trail is shown to the owner.
        </Text>

        <Text style={styles.h}>Why</Text>
        <Text style={styles.p}>
          This helps dispatch, routing, and lets the owner see which technician is actively heading to time-sensitive
          jobs.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  card: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  h: { marginTop: 10, fontSize: typography.caption, fontWeight: '800', color: colors.text, textTransform: 'uppercase' },
  p: { marginTop: 6, fontSize: typography.body, color: colors.muted, lineHeight: 22 },
})

