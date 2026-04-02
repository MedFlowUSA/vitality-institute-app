update public.vital_ai_pathways
set
  version = 5,
  definition_json = $${
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
          { "key": "email", "label": "Email", "type": "text", "required": false }
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
            "required": false,
            "options": ["nutrition / lifestyle", "personal trainer / exercise plan", "prescription medication", "commercial program", "something else"]
          },
          {
            "key": "prior_weight_loss_method_other",
            "label": "Tell us more about your prior weight-loss approach",
            "type": "text",
            "required": false,
            "visibleWhen": [{ "key": "prior_weight_loss_method", "operator": "equals", "value": "something else" }]
          },
          { "key": "weight_loss_history", "label": "Describe your weight-loss history", "type": "textarea", "required": false },
          { "key": "prior_glp1_use", "label": "Have you used a GLP-1 medication before?", "type": "boolean", "required": false }
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
          { "key": "thyroid_history", "label": "Any thyroid history or thyroid cancer concerns?", "type": "boolean", "required": false },
          { "key": "pancreatitis_history", "label": "Any history of pancreatitis?", "type": "boolean", "required": false },
          { "key": "gallbladder_history", "label": "Any gallbladder history?", "type": "boolean", "required": false },
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
          { "key": "current_medications", "label": "Current medications", "type": "textarea", "required": false },
          { "key": "medication_allergies", "label": "Medication allergies", "type": "textarea", "required": false }
        ]
      },
      {
        "key": "glp1_supporting_data",
        "title": "Supporting Data",
        "description": "Upload any recent records that will help the provider prepare.",
        "questions": [
          { "key": "labs_available", "label": "Do you have current or recent labs available?", "type": "boolean", "required": false },
          {
            "key": "labs_source",
            "label": "Where were those labs completed?",
            "type": "select",
            "required": true,
            "options": ["Labcorp", "Quest", "Other local lab"],
            "visibleWhen": [{ "key": "labs_available", "operator": "equals", "value": true }]
          },
          {
            "key": "labs_source_other",
            "label": "Tell us which lab source was used",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "labs_source", "operator": "equals", "value": "Other local lab" }]
          },
          {
            "key": "recent_labs",
            "label": "Upload recent lab results",
            "type": "file",
            "required": false,
            "category": "recent_labs",
            "visibleWhen": [{ "key": "labs_available", "operator": "equals", "value": true }]
          },
          {
            "key": "prior_glp1_experience",
            "label": "Tell us more about your prior GLP-1 experience",
            "type": "textarea",
            "required": false,
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
  }$$::jsonb,
  updated_at = now()
where slug = 'glp1';

update public.vital_ai_pathways
set
  version = 5,
  definition_json = $${
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
          { "key": "email", "label": "Email", "type": "text", "required": false }
        ]
      },
      {
        "key": "wellness_baseline",
        "title": "Baseline Wellness",
        "description": "Share how you have been feeling lately.",
        "questions": [
          { "key": "energy_level", "label": "Energy level", "type": "select", "required": false, "options": ["excellent", "good", "fair", "low"] },
          { "key": "sleep_quality", "label": "Sleep quality", "type": "select", "required": false, "options": ["excellent", "good", "fair", "poor"] },
          { "key": "stress_level", "label": "Stress level", "type": "select", "required": false, "options": ["low", "moderate", "high"] },
          { "key": "hydration_level", "label": "Hydration", "type": "select", "required": false, "options": ["well hydrated", "could improve", "often dehydrated"] },
          { "key": "exercise_frequency", "label": "Exercise frequency", "type": "select", "required": false, "options": ["daily", "3-5 days/week", "1-2 days/week", "rarely"] }
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
          { "key": "prior_labs_available", "label": "Do you have prior labs available?", "type": "boolean", "required": false },
          {
            "key": "prior_labs_source",
            "label": "Where were those labs completed?",
            "type": "select",
            "required": true,
            "options": ["Labcorp", "Quest", "Other local lab"],
            "visibleWhen": [{ "key": "prior_labs_available", "operator": "equals", "value": true }]
          },
          {
            "key": "prior_labs_source_other",
            "label": "Tell us which lab source was used",
            "type": "text",
            "required": true,
            "visibleWhen": [{ "key": "prior_labs_source", "operator": "equals", "value": "Other local lab" }]
          }
        ]
      },
      {
        "key": "uploads",
        "title": "Uploads",
        "description": "Upload prior labs or records if you want the provider to review them.",
        "questions": [
          {
            "key": "prior_labs",
            "label": "Upload prior labs",
            "type": "file",
            "required": false,
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
  }$$::jsonb,
  updated_at = now()
where slug = 'wellness';
