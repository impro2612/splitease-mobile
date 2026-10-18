import { Linking } from "react-native"
import { API_BASE_URL } from "@/lib/api"

/** Public legal pages on the SplitIT website (also used in the store listings). */
export const PRIVACY_URL = `${API_BASE_URL}/privacy`
export const TERMS_URL = `${API_BASE_URL}/terms`

export const openPrivacy = () => Linking.openURL(PRIVACY_URL)
export const openTerms = () => Linking.openURL(TERMS_URL)
