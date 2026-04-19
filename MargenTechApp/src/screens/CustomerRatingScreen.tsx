import { MotiView } from 'moti'
import { Pressable, Share, StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { customerRateUrl } from '../lib/inviteLinks'
import type { CustomerRatingProps } from '../navigation/types'
import { colors, layout, typography } from '../theme'

export function CustomerRatingScreen({ navigation, route }: CustomerRatingProps) {
  const insets = useSafeAreaInsets()
  const { ratingToken } = route.params
  const url = customerRateUrl(ratingToken)

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <MotiView
        from={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18 }}
        style={styles.inner}
      >
        <Text style={styles.kicker}>Margen</Text>
        <Text style={styles.title}>Customer rating</Text>
        <Text style={styles.body}>
          Have your customer scan this code on their phone. They submit the rating — you cannot submit it for them.
        </Text>

        <View style={styles.qrBox}>
          <QRCode value={url} size={220} backgroundColor="#ffffff" color="#111827" />
        </View>

        <Text style={styles.url} numberOfLines={3}>
          {url}
        </Text>

        <Pressable
          style={styles.btn}
          onPress={() => void Share.share({ message: `Rate your visit: ${url}` })}
        >
          <Text style={styles.btnTxt}>Share link</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => navigation.navigate('MainTabs')}>
          <Text style={styles.secondaryTxt}>Back to home</Text>
        </Pressable>
      </MotiView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: layout.pad,
  },
  inner: { flex: 1 },
  kicker: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { marginTop: 8, fontSize: 26, fontWeight: '800', color: colors.text },
  body: { marginTop: 12, fontSize: typography.body, color: colors.muted, lineHeight: 24 },
  qrBox: {
    marginTop: 28,
    alignSelf: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: layout.radius,
  },
  url: {
    marginTop: 20,
    fontSize: typography.caption,
    color: colors.muted,
    textAlign: 'center',
  },
  btn: {
    marginTop: 24,
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { color: colors.accentFg, fontWeight: '800', fontSize: typography.body },
  secondary: {
    marginTop: 12,
    minHeight: layout.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryTxt: { color: colors.muted, fontWeight: '600', fontSize: typography.body },
})
