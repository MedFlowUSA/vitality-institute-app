import { describe, expect, it } from "vitest";
import {
  getProviderPatientCenterRecommendation,
  getProviderQueueRecommendation,
} from "./providerWorkflow";

describe("providerWorkflow", () => {
  describe("getProviderPatientCenterRecommendation", () => {
    it("prioritizes profile completion before any deeper workflow step", () => {
      const recommendation = getProviderPatientCenterRecommendation({
        profileIsComplete: false,
        hasIntakeOnFile: true,
        hasActiveVisit: true,
        hasSoap: true,
        hasWoundAssessment: true,
        hasTreatmentPlan: true,
        hasPhotos: true,
        hasFiles: true,
        canFinalizeVisit: true,
      });

      expect(recommendation).toMatchObject({
        id: "review_intake",
        tab: "overview",
      });
    });

    it("prompts intake review before visit work when intake is missing", () => {
      const recommendation = getProviderPatientCenterRecommendation({
        profileIsComplete: true,
        hasIntakeOnFile: false,
        hasActiveVisit: true,
        hasSoap: true,
        hasWoundAssessment: true,
        hasTreatmentPlan: true,
        hasPhotos: true,
        hasFiles: true,
        canFinalizeVisit: true,
      });

      expect(recommendation).toMatchObject({
        id: "review_intake",
        tab: "wound",
      });
    });

    it("walks the provider into starting a visit before documentation exists", () => {
      const recommendation = getProviderPatientCenterRecommendation({
        profileIsComplete: true,
        hasIntakeOnFile: true,
        hasActiveVisit: false,
        hasSoap: false,
        hasWoundAssessment: false,
        hasTreatmentPlan: false,
        hasPhotos: false,
        hasFiles: false,
        canFinalizeVisit: false,
      });

      expect(recommendation).toMatchObject({
        id: "start_visit",
        tab: "overview",
      });
    });

    it("progresses from SOAP to wound assessment to plan to upload work", () => {
      expect(
        getProviderPatientCenterRecommendation({
          profileIsComplete: true,
          hasIntakeOnFile: true,
          hasActiveVisit: true,
          hasSoap: false,
          hasWoundAssessment: false,
          hasTreatmentPlan: false,
          hasPhotos: false,
          hasFiles: false,
          canFinalizeVisit: false,
        }).id
      ).toBe("create_soap");

      expect(
        getProviderPatientCenterRecommendation({
          profileIsComplete: true,
          hasIntakeOnFile: true,
          hasActiveVisit: true,
          hasSoap: true,
          hasWoundAssessment: false,
          hasTreatmentPlan: false,
          hasPhotos: false,
          hasFiles: false,
          canFinalizeVisit: false,
        }).id
      ).toBe("add_wound_assessment");

      expect(
        getProviderPatientCenterRecommendation({
          profileIsComplete: true,
          hasIntakeOnFile: true,
          hasActiveVisit: true,
          hasSoap: true,
          hasWoundAssessment: true,
          hasTreatmentPlan: false,
          hasPhotos: false,
          hasFiles: false,
          canFinalizeVisit: false,
        }).id
      ).toBe("create_treatment_plan");

      expect(
        getProviderPatientCenterRecommendation({
          profileIsComplete: true,
          hasIntakeOnFile: true,
          hasActiveVisit: true,
          hasSoap: true,
          hasWoundAssessment: true,
          hasTreatmentPlan: true,
          hasPhotos: false,
          hasFiles: false,
          canFinalizeVisit: false,
        }).id
      ).toBe("upload_photos");
    });

    it("returns finalize visit only when the encounter is truly ready", () => {
      const recommendation = getProviderPatientCenterRecommendation({
        profileIsComplete: true,
        hasIntakeOnFile: true,
        hasActiveVisit: true,
        hasSoap: true,
        hasWoundAssessment: true,
        hasTreatmentPlan: true,
        hasPhotos: true,
        hasFiles: false,
        canFinalizeVisit: true,
      });

      expect(recommendation).toMatchObject({
        id: "finalize_visit",
        tab: "overview",
      });
    });

    it("falls back to resume visit when documentation exists but completion is not ready", () => {
      const recommendation = getProviderPatientCenterRecommendation({
        profileIsComplete: true,
        hasIntakeOnFile: true,
        hasActiveVisit: true,
        hasSoap: true,
        hasWoundAssessment: true,
        hasTreatmentPlan: true,
        hasPhotos: true,
        hasFiles: true,
        canFinalizeVisit: false,
      });

      expect(recommendation).toMatchObject({
        id: "resume_visit",
        tab: "overview",
      });
    });
  });

  describe("getProviderQueueRecommendation", () => {
    it("starts a visit from an appointment when no visit exists yet", () => {
      const recommendation = getProviderQueueRecommendation({
        hasVisit: false,
        hasAppointment: true,
        hasSoap: false,
        isSoapSigned: false,
        isVisitClosed: false,
      });

      expect(recommendation).toMatchObject({
        id: "start_visit",
        tab: "overview",
      });
    });

    it("keeps providers in the SOAP flow until the SOAP is signed", () => {
      const noSoapRecommendation = getProviderQueueRecommendation({
        hasVisit: true,
        hasAppointment: true,
        hasSoap: false,
        isSoapSigned: false,
        isVisitClosed: false,
      });

      const draftSoapRecommendation = getProviderQueueRecommendation({
        hasVisit: true,
        hasAppointment: true,
        hasSoap: true,
        isSoapSigned: false,
        isVisitClosed: false,
      });

      expect(noSoapRecommendation).toMatchObject({
        id: "resume_visit",
        tab: "soap",
      });
      expect(draftSoapRecommendation).toMatchObject({
        id: "resume_visit",
        tab: "soap",
      });
    });

    it("opens the patient center once the visit exists and SOAP is signed", () => {
      const recommendation = getProviderQueueRecommendation({
        hasVisit: true,
        hasAppointment: true,
        hasSoap: true,
        isSoapSigned: true,
        isVisitClosed: false,
      });

      expect(recommendation).toMatchObject({
        id: "open_patient_center",
        tab: "overview",
      });
    });

    it("falls back to intake review once the encounter is already closed", () => {
      const recommendation = getProviderQueueRecommendation({
        hasVisit: true,
        hasAppointment: true,
        hasSoap: true,
        isSoapSigned: true,
        isVisitClosed: true,
      });

      expect(recommendation).toMatchObject({
        id: "review_intake",
        tab: "overview",
      });
    });
  });
});
