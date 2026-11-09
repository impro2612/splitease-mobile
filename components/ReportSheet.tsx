import { useEffect, useState } from "react"
import { Modal, View, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useMutation } from "@tanstack/react-query"
import Toast from "react-native-toast-message"
import { Text, TextInput } from "@/components/ui/Typography"
import { reportsApi, REPORT_REASONS, type ReportPayload, type ReportReason } from "@/lib/api"
import { tokens, useTheme } from "@/lib/theme"

const DETAILS_MAX = 500

export type ReportTarget = {
  userId: string
  name: string
  messageId?: string
  groupMessageId?: string
  groupId?: string
  /** Decrypted message text, shown so the user can see what they're reporting */
  preview?: string
}

type Props = {
  visible: boolean
  onClose: () => void
  target: ReportTarget | null
  /** When given, a "Also block?" step follows a successful report */
  onBlock?: () => void
}

/**
 * Report a user or a single message (store UGC policy requirement). Centred card like the
 * other confirm dialogs; a second "Also block?" step appears after sending when the caller
 * can block, so report + block is one flow.
 */
export function ReportSheet({ visible, onClose, target, onBlock }: Props) {
  const C = useTheme()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState("")
  const [step, setStep] = useState<"form" | "block">("form")

  // Fresh form each time the sheet opens
  useEffect(() => {
    if (visible) { setReason(null); setDetails(""); setStep("form") }
  }, [visible])

  const mutation = useMutation({
    mutationFn: (data: ReportPayload) => reportsApi.create(data),
    onSuccess: () => {
      Toast.show({ type: "success", text1: "Report sent", text2: "Thanks, we'll review it" })
      if (onBlock) setStep("block")
      else onClose()
    },
    onError: (err: any) => {
      // Server returns a user-facing string for 400/429
      Toast.show({ type: "error", text1: "Couldn't send report", text2: err?.response?.data?.error ?? "Please try again" })
    },
  })

  if (!target) return null

  const isMessage = !!(target.messageId || target.groupMessageId)
  const canSubmit = !!reason && !mutation.isPending

  function submit() {
    if (!target || !reason) return
    const trimmed = details.trim()
    mutation.mutate({
      targetUserId: target.userId,
      reason,
      details: trimmed ? trimmed.slice(0, DETAILS_MAX) : undefined,
      messageId: target.messageId,
      groupMessageId: target.groupMessageId,
      groupId: target.groupId,
    })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", maxHeight: "90%", borderWidth: 1, borderColor: C.border }}>
            {step === "block" ? (
              <>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: tokens.negativeSoft, alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
                  <Ionicons name="ban-outline" size={26} color={C.negative} />
                </View>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Also block {target.name}?</Text>
                <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>
                  They won't be able to message or find you. You can unblock them later from Profile & settings.
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={onClose}
                    accessibilityLabel="Not now"
                    style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Not now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { onBlock?.(); onClose() }}
                    accessibilityLabel={`Block ${target.name}`}
                    style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Block</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
                  {isMessage ? "Report message" : `Report ${target.name}`}
                </Text>
                <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 16 }}>
                  {isMessage ? `From ${target.name}. ` : ""}Reports are confidential — they won't know it was you.
                </Text>

                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
                  {isMessage && !!target.preview && (
                    <View style={{ backgroundColor: C.bg, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: tokens.accent, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 }}>
                      <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 20, fontStyle: "italic" }} numberOfLines={2}>{target.preview}</Text>
                    </View>
                  )}

                  {REPORT_REASONS.map((opt, i) => {
                    const isSelected = reason === opt.key
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setReason(opt.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={opt.label}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: i === REPORT_REASONS.length - 1 ? 0 : 1, borderBottomColor: C.border, gap: 12 }}
                      >
                        <Ionicons name={isSelected ? "radio-button-on" : "radio-button-off"} size={22} color={isSelected ? tokens.accent : C.textMuted} />
                        <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: isSelected ? "700" : "400" }}>{opt.label}</Text>
                      </TouchableOpacity>
                    )
                  })}

                  <TextInput
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Anything else we should know? (optional)"
                    placeholderTextColor={C.textMuted}
                    multiline
                    maxLength={DETAILS_MAX}
                    textAlignVertical="top"
                    accessibilityLabel="Report details"
                    style={{ marginTop: 14, minHeight: 84, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.inputBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 14 }}
                  />
                  <Text style={{ color: C.textMuted, fontSize: 11, textAlign: "right", marginTop: 4 }}>{details.length}/{DETAILS_MAX}</Text>
                </ScrollView>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={onClose}
                    disabled={mutation.isPending}
                    accessibilityLabel="Cancel report"
                    style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={submit}
                    disabled={!canSubmit}
                    accessibilityLabel="Submit report"
                    accessibilityState={{ disabled: !canSubmit }}
                    style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: canSubmit ? tokens.accent : tokens.accentSoft, alignItems: "center", justifyContent: "center" }}
                  >
                    {mutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: canSubmit ? "#fff" : C.textMuted, fontWeight: "700", fontSize: 15 }}>Submit</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
