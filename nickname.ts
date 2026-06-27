export function getBirthCode(year: number): string {
  if (year >= 2000 && year <= 2009) {
    return "2" + (year % 10).toString();
  }
  return "2" + (year % 100).toString();
}

export function buildNickname(
  gender: "M" | "F",
  birthYear: number,
  joinCode: string,
  serial: number
): string {
  const prefix = gender === "M" ? "MHME" : "MHFE";
  const birthCode = getBirthCode(birthYear);
  return `${prefix}.IN-${birthCode}.${joinCode}${serial}`;
}
