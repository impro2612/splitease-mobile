import { View } from "react-native"
// This screen is never navigated to — the More tab button is intercepted
// in _layout.tsx via tabBarButton to show a bottom sheet overlay instead.
export default function MorePlaceholder() {
  return <View />
}
