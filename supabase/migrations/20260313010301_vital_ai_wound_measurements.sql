insert into public.vital_ai_pathways (slug, name, description, version, is_active, definition_json)
values
(
  'wound-care',
  'Wound Care',
  'Wound care intake with structured wound history, symptom screening, wound measurements, and wound photo uploads.',
  4,
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
          { "key": "email", "label": "Email", "type": "text", "required": false }
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
          { "key": "wound_length_cm", "label": "Wound length (cm)", "type": "number", "required": true },
          { "key": "wound_width_cm", "label": "Wound width (cm)", "type": "number", "required": true },
          { "key": "wound_depth_cm", "label": "Wound depth (cm) - optional", "type": "number", "required": false },
          { "key": "multiple_wounds", "label": "Are there multiple wounds?", "type": "boolean", "required": false },
          { "key": "drainage_present", "label": "Is there drainage?", "type": "boolean", "required": false },
          { "key": "infection_concern", "label": "Are you concerned about infection?", "type": "boolean", "required": false },
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
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  version = excluded.version,
  is_active = excluded.is_active,
  definition_json = excluded.definition_json,
  updated_at = now();
