insert into public.vital_ai_pathways (slug, name, description, version, is_active, definition_json)
values
(
  'glp1',
  'GLP-1',
  'GLP-1 intake for weight-management screening, medication review, and baseline metabolic history.',
  1,
  true,
  $${
    "pathwayKey": "glp1",
    "title": "GLP-1",
    "description": "Share your weight-management history, medication background, and goals so the care team can review candidacy before the visit.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true }
        ]
      },
      {
        "key": "glp1_baseline",
        "title": "Weight and Goals",
        "description": "Tell us about your current baseline and what you want to accomplish.",
        "questions": [
          { "key": "current_weight", "label": "Current weight (lb)", "type": "number", "required": true },
          { "key": "height_inches", "label": "Height (inches)", "type": "number", "required": true },
          { "key": "goal_weight", "label": "Goal weight (lb)", "type": "number", "required": true },
          { "key": "weight_loss_history", "label": "Describe your prior weight-loss efforts", "type": "textarea", "required": true },
          { "key": "prior_glp1_use", "label": "Have you used a GLP-1 medication before?", "type": "boolean", "required": true }
        ]
      },
      {
        "key": "glp1_history",
        "title": "Clinical History",
        "description": "Provide the medical context needed for a safe review.",
        "questions": [
          {
            "key": "diabetes_status",
            "label": "Diabetes or prediabetes history",
            "type": "select",
            "required": true,
            "options": ["none", "prediabetes", "type 2 diabetes", "type 1 diabetes"]
          },
          { "key": "thyroid_history", "label": "Any thyroid history or thyroid cancer concerns?", "type": "boolean", "required": true },
          { "key": "pancreatitis_history", "label": "Any history of pancreatitis?", "type": "boolean", "required": true },
          { "key": "gallbladder_history", "label": "Any gallbladder history?", "type": "boolean", "required": true },
          { "key": "gi_symptoms", "label": "Current GI symptoms", "type": "textarea", "required": false },
          { "key": "current_medications", "label": "Current medications", "type": "textarea", "required": true },
          { "key": "medication_allergies", "label": "Medication allergies", "type": "textarea", "required": false }
        ]
      },
      {
        "key": "glp1_supporting_data",
        "title": "Supporting Data",
        "description": "Upload any recent records that will help the provider prepare.",
        "questions": [
          { "key": "labs_available", "label": "Do you have recent labs available?", "type": "boolean", "required": true },
          {
            "key": "recent_labs",
            "label": "Recent lab results",
            "type": "file",
            "required": true,
            "category": "recent_labs",
            "visibleWhen": [{ "key": "labs_available", "operator": "equals", "value": true }]
          },
          {
            "key": "prior_glp1_notes",
            "label": "If you used GLP-1 therapy before, describe your experience",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "prior_glp1_use", "operator": "equals", "value": true }]
          }
        ]
      },
      {
        "key": "consent",
        "title": "Consent",
        "description": "Confirm that the information you provided is accurate.",
        "questions": [
          { "key": "consent_ack", "label": "I confirm my intake details are accurate.", "type": "boolean", "required": true },
          { "key": "consent_signature", "label": "Type your full name", "type": "text", "required": true }
        ]
      }
    ]
  }$$::jsonb
),
(
  'wellness',
  'Wellness',
  'Wellness intake for baseline symptoms, lifestyle review, and health optimization goals.',
  1,
  true,
  $${
    "pathwayKey": "wellness",
    "title": "Wellness",
    "description": "Help us understand your wellness goals, current symptoms, and lifestyle baseline so the provider can prepare.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true }
        ]
      },
      {
        "key": "wellness_baseline",
        "title": "Baseline Wellness",
        "description": "Share how you have been feeling lately.",
        "questions": [
          {
            "key": "energy_level",
            "label": "Energy level",
            "type": "select",
            "required": true,
            "options": ["excellent", "good", "fair", "low"]
          },
          {
            "key": "sleep_quality",
            "label": "Sleep quality",
            "type": "select",
            "required": true,
            "options": ["excellent", "good", "fair", "poor"]
          },
          {
            "key": "stress_level",
            "label": "Stress level",
            "type": "select",
            "required": true,
            "options": ["low", "moderate", "high"]
          },
          {
            "key": "hydration_level",
            "label": "Hydration",
            "type": "select",
            "required": true,
            "options": ["well hydrated", "could improve", "often dehydrated"]
          },
          {
            "key": "exercise_frequency",
            "label": "Exercise frequency",
            "type": "select",
            "required": true,
            "options": ["daily", "3-5 days/week", "1-2 days/week", "rarely"]
          }
        ]
      },
      {
        "key": "wellness_goals",
        "title": "Goals and Concerns",
        "description": "Tell us what you want to improve and any symptoms you want reviewed.",
        "questions": [
          { "key": "health_goals", "label": "Primary health goals", "type": "textarea", "required": true },
          { "key": "symptom_concerns", "label": "Symptoms or concerns", "type": "textarea", "required": false },
          { "key": "interest_areas", "label": "Areas of interest", "type": "textarea", "required": false },
          { "key": "prior_labs_available", "label": "Do you have prior labs available?", "type": "boolean", "required": true }
        ]
      },
      {
        "key": "uploads",
        "title": "Uploads",
        "description": "Upload prior labs or records if you want the provider to review them.",
        "questions": [
          {
            "key": "prior_labs",
            "label": "Prior labs",
            "type": "file",
            "required": true,
            "category": "prior_labs",
            "visibleWhen": [{ "key": "prior_labs_available", "operator": "equals", "value": true }]
          }
        ]
      },
      {
        "key": "consent",
        "title": "Consent",
        "description": "Confirm that the information you provided is accurate.",
        "questions": [
          { "key": "consent_ack", "label": "I confirm my intake details are accurate.", "type": "boolean", "required": true },
          { "key": "consent_signature", "label": "Type your full name", "type": "text", "required": true }
        ]
      }
    ]
  }$$::jsonb
),
(
  'peptides',
  'Peptides',
  'Peptide intake for goal screening, prior use review, symptoms, and medication safety context.',
  1,
  true,
  $${
    "pathwayKey": "peptides",
    "title": "Peptides",
    "description": "Tell us about your goals, symptoms, and prior peptide history so the provider can review the right options.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true }
        ]
      },
      {
        "key": "peptide_goals",
        "title": "Peptide Goals",
        "description": "Help us understand what you are hoping to improve.",
        "questions": [
          {
            "key": "peptide_primary_goal",
            "label": "Primary goal",
            "type": "select",
            "required": true,
            "options": ["recovery", "inflammation", "fat loss", "performance", "anti-aging"]
          },
          { "key": "relevant_symptoms", "label": "Relevant symptoms", "type": "textarea", "required": false },
          { "key": "prior_peptide_use", "label": "Have you used peptides before?", "type": "boolean", "required": true },
          {
            "key": "prior_peptide_details",
            "label": "Describe prior peptide use",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "prior_peptide_use", "operator": "equals", "value": true }]
          }
        ]
      },
      {
        "key": "peptide_history",
        "title": "Medical Review",
        "description": "Provide the history the provider will need to review safety and fit.",
        "questions": [
          { "key": "current_medications", "label": "Current medications", "type": "textarea", "required": true },
          { "key": "medication_allergies", "label": "Medication allergies", "type": "textarea", "required": false },
          { "key": "provider_review_disclaimer", "label": "I understand peptide treatment requires provider review and approval.", "type": "boolean", "required": true }
        ]
      },
      {
        "key": "uploads",
        "title": "Uploads",
        "description": "Upload any labs or prior records that will help with review.",
        "questions": [
          {
            "key": "supporting_records",
            "label": "Supporting records",
            "type": "file",
            "required": false,
            "category": "supporting_records"
          }
        ]
      },
      {
        "key": "consent",
        "title": "Consent",
        "description": "Confirm that the information you provided is accurate.",
        "questions": [
          { "key": "consent_ack", "label": "I confirm my intake details are accurate.", "type": "boolean", "required": true },
          { "key": "consent_signature", "label": "Type your full name", "type": "text", "required": true }
        ]
      }
    ]
  }$$::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  version = excluded.version,
  is_active = excluded.is_active,
  definition_json = excluded.definition_json,
  updated_at = now();
