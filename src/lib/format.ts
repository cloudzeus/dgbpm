/**
 * Ντετερμινιστική μορφοποίηση ημερομηνιών — ίδιο αποτέλεσμα σε server & client
 * (σταθερό locale el-GR + σταθερό timezone), ώστε να μη σπάει το hydration.
 */

const TZ = "Europe/Athens";

const dateFmt = new Intl.DateTimeFormat("el-GR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

const dateTimeFmt = new Intl.DateTimeFormat("el-GR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export function formatDate(value: Date | string | number): string {
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: Date | string | number): string {
  return dateTimeFmt.format(new Date(value));
}
