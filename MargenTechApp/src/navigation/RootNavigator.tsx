import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CustomerRatingScreen } from '../screens/CustomerRatingScreen'
import { JobDetailScreen } from '../screens/JobDetailScreen'
import { LocationHistoryScreen } from '../screens/LocationHistoryScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen'
import { SplashScreen } from '../screens/SplashScreen'
import { colors } from '../theme'
import type { RootStackParamList } from './types'
import { MainTabs } from './MainTabs'

const Stack = createNativeStackNavigator<RootStackParamList>()

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.urgent,
  },
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job' }} />
        <Stack.Screen name="LocationHistory" component={LocationHistoryScreen} options={{ title: 'Location history' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy' }} />
        <Stack.Screen
          name="CustomerRating"
          component={CustomerRatingScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
