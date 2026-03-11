export type WoundMeasurement = {
  created_at: string
  length_cm: number | null
  width_cm: number | null
  depth_cm?: number | null
  exudate?: string | null
  infection_signs?: boolean | null
  pain_score?: number | null
}

export type WoundProgressionResult = {
  trajectory:
    | "Improving"
    | "Slow Improvement"
    | "Stalled"
    | "Worsening"
    | "Insufficient Data"
  confidence: "Low" | "Moderate" | "High"
  improvement_pct: number | null
  reasoning: string
  suggested_action: string
}

function woundArea(length: number | null, width: number | null) {
  if (!length || !width) return null
  return length * width
}

export function analyzeWoundProgression(
  rows: WoundMeasurement[]
): WoundProgressionResult {

  if (!rows || rows.length < 2) {
    return {
      trajectory: "Insufficient Data",
      confidence: "Low",
      improvement_pct: null,
      reasoning:
        "Not enough wound measurements to determine healing trajectory.",
      suggested_action:
        "Continue documenting wound measurements during upcoming visits."
    }
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const first = sorted[0]
  const latest = sorted[sorted.length - 1]

  const firstArea = woundArea(first.length_cm, first.width_cm)
  const latestArea = woundArea(latest.length_cm, latest.width_cm)

  if (!firstArea || !latestArea) {
    return {
      trajectory: "Insufficient Data",
      confidence: "Low",
      improvement_pct: null,
      reasoning: "Wound measurements are incomplete.",
      suggested_action:
        "Ensure wound length and width are recorded consistently."
    }
  }

  const change = firstArea - latestArea
  const pct = (change / firstArea) * 100

  let trajectory: WoundProgressionResult["trajectory"] = "Stalled"

  if (pct >= 20) trajectory = "Improving"
  else if (pct >= 5) trajectory = "Slow Improvement"
  else if (pct > -5) trajectory = "Stalled"
  else trajectory = "Worsening"

  let confidence: WoundProgressionResult["confidence"] = "Low"

  if (rows.length >= 4) confidence = "High"
  else if (rows.length >= 3) confidence = "Moderate"

  let reasoning = `Wound area changed ${pct.toFixed(
    1
  )}% across ${rows.length} measurements.`

  if (latest.infection_signs) {
    reasoning += " Signs of infection are present."
  }

  if (latest.exudate === "heavy") {
    reasoning += " Heavy exudate noted."
  }

  if ((latest.pain_score ?? 0) >= 6) {
    reasoning += " Patient pain remains elevated."
  }

  let suggested = "Continue monitoring."

  if (trajectory === "Slow Improvement") {
    suggested = "Monitor closely and reassess treatment effectiveness."
  }

  if (trajectory === "Stalled") {
    suggested =
      "Consider evaluating wound care protocol or advanced therapies."
  }

  if (trajectory === "Worsening") {
    suggested =
      "Escalate care and evaluate infection, offloading, and vascular status."
  }

  return {
    trajectory,
    confidence,
    improvement_pct: pct,
    reasoning,
    suggested_action: suggested
  }
}
