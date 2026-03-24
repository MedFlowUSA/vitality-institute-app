$treatmentPath = "src/components/provider/TreatmentPlanSection.tsx"
$woundPath = "src/components/provider/WoundAssessmentPanel.tsx"

$treatment = Get-Content $treatmentPath -Raw
$treatment = $treatment.Replace(
  "import { useAuth } from ""../../auth/AuthProvider"";`r`nimport ProviderPrerequisiteCard from ""./ProviderPrerequisiteCard"";",
  "import { useAuth } from ""../../auth/AuthProvider"";`r`nimport { getErrorMessage } from ""../../lib/patientRecords"";`r`nimport type { TreatmentPlanData, TreatmentPlanRecord, TreatmentPlanStatus, WoundAssessmentRecord } from ""../../lib/provider/types"";`r`nimport ProviderPrerequisiteCard from ""./ProviderPrerequisiteCard"";"
)
$planTypeReplacement = @'
type PlanRow = TreatmentPlanRecord;

type LatestWoundAssessmentRow = Pick<
  WoundAssessmentRecord,
  | "id"
  | "wound_label"
  | "body_site"
  | "laterality"
  | "wound_type"
  | "stage"
  | "length_cm"
  | "width_cm"
  | "depth_cm"
  | "exudate"
  | "odor"
  | "infection_signs"
  | "pain_score"
  | "notes"
>;
'@
$treatment = [regex]::Replace($treatment, 'type PlanRow = \{.*?\};\r\n\r\ntype LatestWoundAssessmentRow = \{.*?\};', $planTypeReplacement, 'Singleline')
$treatment = $treatment.Replace('type TreatmentPlanStatus = "draft" | "active" | "completed";' + "`r`n`r`n", "")
$treatment = $treatment.Replace("function pretty(v: any) {", "function pretty(v: TreatmentPlanData) {")
$treatment = $treatment.Replace("  const buildPlanJson = () => ({", "  const buildPlanJson = (): TreatmentPlanData => ({")
$planDefaults = @'
    const p: TreatmentPlanData = r.plan ?? {
      dressing_plan: null,
      frequency: null,
      offloading: null,
      follow_up_days: null,
      orders: null,
      medications: null,
    };
'@
$treatment = $treatment.Replace("    const p = r.plan ?? {};", $planDefaults.TrimEnd("`n"))
$treatment = $treatment.Replace(
  '    } catch (e: any) {' + "`r`n" + '      setErr(e?.message ?? "Failed to load treatment plan.");',
  '    } catch (error: unknown) {' + "`r`n" + '      setErr(getErrorMessage(error, "Failed to load treatment plan."));'
)
$treatment = $treatment.Replace(
  '    } catch (e: any) {' + "`r`n" + '      setErr(e?.message ?? "Failed to save treatment plan.");',
  '    } catch (error: unknown) {' + "`r`n" + '      setErr(getErrorMessage(error, "Failed to save treatment plan."));'
)
$treatment = $treatment.Replace(
  '    } catch (e: any) {' + "`r`n" + '      setErr(e?.message ?? "Failed to sign treatment plan.");',
  '    } catch (error: unknown) {' + "`r`n" + '      setErr(getErrorMessage(error, "Failed to sign treatment plan."));'
)
[System.IO.File]::WriteAllText((Resolve-Path $treatmentPath), $treatment, [System.Text.UTF8Encoding]::new($false))

$wound = Get-Content $woundPath -Raw
$wound = $wound.Replace(
  "import { auditWrite } from ""../../lib/audit"";`r`nimport ProviderPrerequisiteCard from ""./ProviderPrerequisiteCard"";",
  "import { auditWrite } from ""../../lib/audit"";`r`nimport { getErrorMessage } from ""../../lib/patientRecords"";`r`nimport type { WoundAssessmentRecord, WoundExudateLevel, WoundLaterality } from ""../../lib/provider/types"";`r`nimport ProviderPrerequisiteCard from ""./ProviderPrerequisiteCard"";"
)
$wound = [regex]::Replace($wound, 'type WoundRow = \{.*?\};', 'type WoundRow = WoundAssessmentRecord;' + "`r`n" + 'type InsertedWoundAssessmentRow = Pick<WoundAssessmentRecord, "id">;', 'Singleline')
$wound = $wound.Replace('const [laterality, setLaterality] = useState<"left" | "right" | "bilateral" | "">("");', 'const [laterality, setLaterality] = useState<WoundLaterality>("");')
$wound = $wound.Replace('const [exudate, setExudate] = useState<"none" | "low" | "moderate" | "high" | "">("");', 'const [exudate, setExudate] = useState<WoundExudateLevel>("");')
$wound = $wound.Replace(
  '    } catch (e: any) {' + "`r`n" + '      setErr(e?.message ?? "Failed to load wound assessments.");',
  '    } catch (error: unknown) {' + "`r`n" + '      setErr(getErrorMessage(error, "Failed to load wound assessments."));'
)
$wound = $wound.Replace('    setLaterality((r.laterality as any) ?? "");', '    setLaterality(r.laterality ?? "");')
$wound = $wound.Replace('    setExudate((r.exudate as any) ?? "");', '    setExudate(r.exudate ?? "");')
$wound = $wound.Replace('.insert([payload]).select("id").maybeSingle();', '.insert([payload]).select("id").maybeSingle<InsertedWoundAssessmentRow>();')
$wound = $wound.Replace('        const newId = (data as any)?.id as string | undefined;', '        const newId = data?.id;')
$wound = $wound.Replace(
  '    } catch (e: any) {' + "`r`n" + '      setErr(e?.message ?? "Failed to save wound assessment.");',
  '    } catch (error: unknown) {' + "`r`n" + '      setErr(getErrorMessage(error, "Failed to save wound assessment."));'
)
$wound = $wound.Replace(
  '    } catch (e: any) {' + "`r`n" + '      setErr(e?.message ?? "Failed to delete wound assessment.");',
  '    } catch (error: unknown) {' + "`r`n" + '      setErr(getErrorMessage(error, "Failed to delete wound assessment."));'
)
$wound = $wound.Replace('setLaterality(e.target.value as any)', 'setLaterality(e.target.value as WoundLaterality)')
$wound = $wound.Replace('setExudate(e.target.value as any)', 'setExudate(e.target.value as WoundExudateLevel)')
[System.IO.File]::WriteAllText((Resolve-Path $woundPath), $wound, [System.Text.UTF8Encoding]::new($false))
