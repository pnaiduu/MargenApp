import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type RootStackParamList = {
  Splash: undefined
  Login: undefined
  MainTabs: undefined
  JobDetail: { jobId: string }
  CustomerRating: { jobId: string; ratingToken: string }
  LocationHistory: undefined
  PrivacyPolicy: undefined
}

export type SplashProps = NativeStackScreenProps<RootStackParamList, 'Splash'>
export type LoginProps = NativeStackScreenProps<RootStackParamList, 'Login'>
export type JobDetailProps = NativeStackScreenProps<RootStackParamList, 'JobDetail'>
export type CustomerRatingProps = NativeStackScreenProps<RootStackParamList, 'CustomerRating'>
export type LocationHistoryProps = NativeStackScreenProps<RootStackParamList, 'LocationHistory'>
export type PrivacyPolicyProps = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>
