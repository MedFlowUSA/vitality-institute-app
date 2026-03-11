export type WoundRiskInput = {
  created_at: string
  length_cm: number | null
  width_cm: number | null
  exudate?: string | null
  infection_signs?: boolean | null
  pain_score?: number | null
}

export type WoundRiskAlert = {
  level: "low" | "moderate" | "high"
  title: string
  message: string
}

function woundArea(length: number | null, width: number | null) {
  if (!length || !width) return null
  return length * width
}

export function analyzeWoundRisk(rows: WoundRiskInput[]): WoundRiskAlert[] {

  const alerts: WoundRiskAlert[] = []

  if (!rows || rows.length === 0) return alerts

  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const latest = sorted[sorted.length - 1]

  const firstArea = woundArea(sorted[0].length_cm, sorted[0].width_cm)
  const latestArea = woundArea(latest.length_cm, latest.width_cm)

  if (latest.infection_signs) {
    alerts.push({
      level: "high",
      title: "Possible Infection",
      message: "Signs of infection have been documented in the latest wound assessment."
    })
  }

  if ((latest.pain_score ?? 0) >= 7) {
    alerts.push({
      level: "moderate",
      title: "Elevated Pain",
      message: "Patient pain score is high and may indicate delayed healing or infection."
    })
  }

  if (latest.exudate === "heavy") {
    alerts.push({
      level: "moderate",
      title: "Heavy Exudate",
      message: "Heavy wound drainage observed which may delay healing."
    })
  }

  if (firstArea && latestArea) {
    const change = firstArea - latestArea
    const pct = (change / firstArea) * 100

    if (pct < 5) {
      alerts.push({
        level: "moderate",
        title: "Delayed Healing",
        message: "Wound size has not improved significantly across recent visits."
      })
    }

    if (pct < -5) {
      alerts.push({
        level: "high",
        title: "Wound Worsening",
        message: "Wound area has increased compared to earlier measurements."
      })
    }
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "low",
      title: "No Major Risk Flags",
      message: "Current wound data does not show major healing risks."
    })
  }

  return alerts
}
