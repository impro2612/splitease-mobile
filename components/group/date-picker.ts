import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"

/** Native Android date picker capped at today. */
export function openDatePicker(current: Date, onChange: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value: current,
    mode: "date",
    is24Hour: true,
    maximumDate: new Date(),
    onChange: (_, selected) => { if (selected) onChange(selected) },
  })
}
