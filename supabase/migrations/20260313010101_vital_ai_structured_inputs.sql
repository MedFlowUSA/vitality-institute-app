insert into public.vital_ai_pathways (slug, name, description, version, is_active, definition_json)
values
(
  'wound-care',
  'Wound Care',
  'Wound care intake with structured wound history, symptom screening, and wound photo uploads.',
  2,
  true,
  $${
    "pathwayKey": "wound-care",
    "title": "Wound Care",
    "description": "Share details about the wound so the care team can review your case before the visit.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your basic information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true }
        ]
      },
      {
        "key": "wound_overview",
        "title": "Wound Overview",
        "description": "Describe the wound that needs to be reviewed.",
        "questions": [
          {
            "key": "wound_location",
            "label": "Where is the wound located?",
            "type": "select",
            "required": true,
            "options": ["foot", "leg", "ankle", "toe", "sacral", "abdomen", "arm", "other"]
          },
          {
            "key": "wound_location_other",
            "label": "Please describe the wound location",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "wound_location", "operator": "equals", "value": "other" }]
          },
          {
            "key": "wound_duration",
            "label": "How long has it been present?",
            "type": "select",
            "required": true,
            "options": ["less than 1 week", "1-2 weeks", "2-4 weeks", "1-3 months", "more than 3 months"]
          },
          { "key": "multiple_wounds", "label": "Are there multiple wounds?", "type": "boolean", "required": true },
          { "key": "drainage_present", "label": "Is there drainage?", "type": "boolean", "required": true },
          { "key": "infection_concern", "label": "Are you concerned about infection?", "type": "boolean", "required": true },
          { "key": "pain_level", "label": "Pain level (0-10)", "type": "number", "required": true }
        ]
      },
      {
        "key": "wound_details",
        "title": "Wound Details",
        "description": "Provide more detail so the provider can prepare.",
        "questions": [
          {
            "key": "wound_cause",
            "label": "What caused the wound?",
            "type": "select",
            "required": true,
            "options": ["pressure", "surgical", "traumatic injury", "diabetic ulcer", "venous ulcer", "arterial ulcer", "other"]
          },
          {
            "key": "wound_cause_other",
            "label": "Please describe the cause",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "wound_cause", "operator": "equals", "value": "other" }]
          },
          {
            "key": "current_dressing",
            "label": "Current dressing or wound care",
            "type": "select",
            "required": false,
            "options": ["gauze", "foam dressing", "hydrocolloid", "negative pressure wound therapy", "none", "other"]
          },
          {
            "key": "current_dressing_other",
            "label": "Tell us more about the current dressing",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "current_dressing", "operator": "equals", "value": "other" }]
          },
          {
            "key": "prior_treatments",
            "label": "Prior treatments",
            "type": "select",
            "required": false,
            "options": ["topical treatment", "oral antibiotics", "debridement", "skin substitute / graft", "home health wound care", "other"]
          },
          {
            "key": "prior_treatments_other",
            "label": "Please describe prior treatments",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "prior_treatments", "operator": "equals", "value": "other" }]
          },
          { "key": "wound_story", "label": "Please describe the wound story or history", "type": "textarea", "required": false },
          {
            "key": "secondary_wound_details",
            "label": "Describe any additional wounds",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "multiple_wounds", "operator": "equals", "value": true }]
          },
          {
            "key": "drainage_description",
            "label": "Describe the drainage",
            "type": "select",
            "required": true,
            "options": ["light", "moderate", "heavy", "bloody", "other"],
            "visibleWhen": [{ "key": "drainage_present", "operator": "equals", "value": true }]
          },
          {
            "key": "drainage_description_other",
            "label": "Please describe the drainage",
            "type": "text",
            "required": true,
            "visibleWhen": [
              { "key": "drainage_present", "operator": "equals", "value": true },
              { "key": "drainage_description", "operator": "equals", "value": "other" }
            ]
          },
          {
            "key": "infection_symptoms",
            "label": "Describe signs or symptoms of infection",
            "type": "select",
            "required": true,
            "options": ["redness", "warmth", "odor", "fever", "increased pain", "other"],
            "visibleWhen": [{ "key": "infection_concern", "operator": "equals", "value": true }]
          },
          {
            "key": "infection_symptoms_other",
            "label": "Please describe the infection concern",
            "type": "text",
            "required": true,
            "visibleWhen": [
              { "key": "infection_concern", "operator": "equals", "value": true },
              { "key": "infection_symptoms", "operator": "equals", "value": "other" }
            ]
          }
        ]
      },
      {
        "key": "uploads",
        "title": "Photos and Uploads",
        "description": "Upload clear images of the wound and any relevant documents.",
        "questions": [
          { "key": "wound_photo", "label": "Wound photo", "type": "image", "required": true, "category": "wound_photo" },
          { "key": "insurance_card", "label": "Insurance card", "type": "file", "required": false, "category": "insurance_card" },
          { "key": "extra_attachment", "label": "Additional attachment", "type": "file", "required": false, "category": "intake_attachment" }
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
  'glp1',
  'GLP-1',
  'GLP-1 intake for weight-management screening, medication review, and baseline metabolic history.',
  2,
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
          {
            "key": "glp1_primary_goal",
            "label": "Primary goal",
            "type": "select",
            "required": true,
            "options": ["weight loss", "glycemic support", "metabolic health", "something else"]
          },
          {
            "key": "glp1_primary_goal_other",
            "label": "Please describe your primary goal",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "glp1_primary_goal", "operator": "equals", "value": "something else" }]
          },
          {
            "key": "prior_weight_loss_method",
            "label": "Most recent weight-loss approach",
            "type": "select",
            "required": true,
            "options": ["nutrition / lifestyle", "personal trainer / exercise plan", "prescription medication", "commercial program", "something else"]
          },
          {
            "key": "prior_weight_loss_method_other",
            "label": "Tell us more about your prior weight-loss approach",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "prior_weight_loss_method", "operator": "equals", "value": "something else" }]
          },
          { "key": "weight_loss_history", "label": "Describe your weight-loss history", "type": "textarea", "required": true },
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
          {
            "key": "gi_symptom_category",
            "label": "GI symptom review",
            "type": "select",
            "required": false,
            "options": ["none", "nausea", "vomiting", "constipation", "bloating", "other"]
          },
          {
            "key": "gi_symptoms",
            "label": "Please describe the GI symptoms",
            "type": "text",
            "required": true,
            "visibleWhen": [
              { "key": "gi_symptom_category", "operator": "truthy" },
              { "key": "gi_symptom_category", "operator": "not_equals", "value": "none" }
            ]
          },
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
            "key": "prior_glp1_experience",
            "label": "Tell us more about your prior GLP-1 experience",
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
  2,
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
          { "key": "energy_level", "label": "Energy level", "type": "select", "required": true, "options": ["excellent", "good", "fair", "low"] },
          { "key": "sleep_quality", "label": "Sleep quality", "type": "select", "required": true, "options": ["excellent", "good", "fair", "poor"] },
          { "key": "stress_level", "label": "Stress level", "type": "select", "required": true, "options": ["low", "moderate", "high"] },
          { "key": "hydration_level", "label": "Hydration", "type": "select", "required": true, "options": ["well hydrated", "could improve", "often dehydrated"] },
          { "key": "exercise_frequency", "label": "Exercise frequency", "type": "select", "required": true, "options": ["daily", "3-5 days/week", "1-2 days/week", "rarely"] }
        ]
      },
      {
        "key": "wellness_goals",
        "title": "Goals and Concerns",
        "description": "Tell us what you want to improve and any symptoms you want reviewed.",
        "questions": [
          {
            "key": "health_goal_primary",
            "label": "Primary wellness goal",
            "type": "select",
            "required": true,
            "options": ["energy", "sleep", "stress resilience", "performance", "longevity", "other"]
          },
          {
            "key": "health_goal_primary_other",
            "label": "Please describe your primary goal",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "health_goal_primary", "operator": "equals", "value": "other" }]
          },
          { "key": "health_goals", "label": "Tell us more about your goals", "type": "textarea", "required": true },
          {
            "key": "symptom_focus",
            "label": "Main symptom focus",
            "type": "select",
            "required": false,
            "options": ["fatigue", "sleep issues", "brain fog", "stress", "hormone concerns", "other"]
          },
          {
            "key": "symptom_focus_other",
            "label": "Please describe the symptom focus",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "symptom_focus", "operator": "equals", "value": "other" }]
          },
          { "key": "symptom_concerns", "label": "Describe any symptoms or concerns", "type": "textarea", "required": false },
          {
            "key": "interest_area",
            "label": "Area of interest",
            "type": "select",
            "required": false,
            "options": ["lab review", "metabolic health", "nutrition", "recovery", "preventive wellness", "misc"]
          },
          {
            "key": "interest_area_other",
            "label": "Tell us more about the interest area",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "interest_area", "operator": "equals", "value": "misc" }]
          },
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
  2,
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
            "options": ["recovery", "inflammation", "fat loss", "performance", "anti-aging", "other"]
          },
          {
            "key": "peptide_primary_goal_other",
            "label": "Please describe your primary goal",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "peptide_primary_goal", "operator": "equals", "value": "other" }]
          },
          {
            "key": "relevant_symptom_focus",
            "label": "Main symptom focus",
            "type": "select",
            "required": false,
            "options": ["slow recovery", "joint pain", "fatigue", "body composition", "performance plateau", "misc"]
          },
          {
            "key": "relevant_symptom_focus_other",
            "label": "Tell us more about the symptom focus",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "relevant_symptom_focus", "operator": "equals", "value": "misc" }]
          },
          { "key": "relevant_symptoms", "label": "Describe any relevant symptoms", "type": "textarea", "required": false },
          { "key": "prior_peptide_use", "label": "Have you used peptides before?", "type": "boolean", "required": true },
          {
            "key": "prior_peptide_type",
            "label": "What type of peptide experience have you had?",
            "type": "select",
            "required": true,
            "options": ["recovery peptide", "fat-loss peptide", "performance peptide", "anti-aging peptide", "other"],
            "visibleWhen": [{ "key": "prior_peptide_use", "operator": "equals", "value": true }]
          },
          {
            "key": "prior_peptide_type_other",
            "label": "Please describe the prior peptide use",
            "type": "text",
            "required": true,
            "visibleWhen": [
              { "key": "prior_peptide_use", "operator": "equals", "value": true },
              { "key": "prior_peptide_type", "operator": "equals", "value": "other" }
            ]
          },
          {
            "key": "prior_peptide_details",
            "label": "Tell us more about your prior peptide use",
            "type": "textarea",
            "required": false,
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
          { "key": "supporting_records", "label": "Supporting records", "type": "file", "required": false, "category": "supporting_records" }
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
  'general-consult',
  'General Consultation',
  'General consultation intake with structured visit context, symptoms, and optional prior record uploads.',
  2,
  true,
  $${
    "pathwayKey": "general-consult",
    "title": "General Consultation",
    "description": "Tell us about your goals, symptoms, and any records you want your care team to review.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your basic information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true },
          { "key": "preferred_contact", "label": "Preferred contact method", "type": "select", "required": true, "options": ["phone", "text", "email"] }
        ]
      },
      {
        "key": "visit_reason",
        "title": "Visit Reason",
        "description": "Help us understand why you are reaching out.",
        "questions": [
          { "key": "visit_type", "label": "Visit type", "type": "select", "required": true, "options": ["general consultation", "follow-up"] },
          {
            "key": "care_interest_area",
            "label": "Primary area of interest",
            "type": "select",
            "required": true,
            "options": ["wellness", "weight management", "hormone / metabolic support", "preventive care", "something else"]
          },
          {
            "key": "care_interest_area_other",
            "label": "Please describe the area of interest",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "care_interest_area", "operator": "equals", "value": "something else" }]
          },
          { "key": "primary_concern", "label": "What is your main reason for reaching out today?", "type": "textarea", "required": true },
          { "key": "goals", "label": "What would you like to accomplish?", "type": "textarea", "required": true },
          {
            "key": "current_changes",
            "label": "What has changed since your last visit?",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "visit_type", "operator": "equals", "value": "follow-up" }]
          }
        ]
      },
      {
        "key": "history",
        "title": "History",
        "description": "Share any medical history or symptoms that will help the provider prepare.",
        "questions": [
          {
            "key": "symptom_focus",
            "label": "Primary symptom focus",
            "type": "select",
            "required": false,
            "options": ["fatigue", "pain", "GI concerns", "sleep issues", "stress", "other"]
          },
          {
            "key": "symptom_focus_other",
            "label": "Tell us more about the symptom focus",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "symptom_focus", "operator": "equals", "value": "other" }]
          },
          { "key": "symptoms", "label": "Current symptoms", "type": "textarea", "required": true },
          { "key": "medical_history", "label": "Relevant medical history", "type": "textarea", "required": false },
          { "key": "current_medications", "label": "Current medications", "type": "textarea", "required": false },
          { "key": "prior_records_available", "label": "Do you want to upload prior records?", "type": "boolean", "required": true }
        ]
      },
      {
        "key": "uploads",
        "title": "Uploads",
        "description": "Upload any documents that will help the team prepare.",
        "questions": [
          {
            "key": "prior_records",
            "label": "Prior records",
            "type": "file",
            "required": true,
            "category": "intake_attachment",
            "visibleWhen": [{ "key": "prior_records_available", "operator": "equals", "value": true }]
          },
          { "key": "photo_id", "label": "Photo ID", "type": "file", "required": false, "category": "photo_id" }
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
