# Vitality Institute App User Guide

## 1. Introduction

The Vitality Institute app supports the full patient and provider journey across booking, intake, communication, clinical review, treatment follow-up, and physician protocol approval.

Patients use the app to request care, complete intake, message the clinic, review labs, and follow treatment instructions. Providers, staff, and physicians use the app to review intake, manage queues, work from the correct clinic location, review Vital AI submissions, and complete physician sign-off when protocol approval is required.

This guide is designed to function as a real onboarding and training manual for live use.

## 2. Patient Guide

### Entry Points

Patients usually begin in one of three places:

#### Services

Use `Services` when the patient wants to browse care options, understand available treatment categories, or decide what type of visit may be appropriate.

#### Book Visit

Use `Book Visit` when the patient is ready to request a visit and wants to move directly into service, location, and time selection.

#### Start with Vital AI

Use `Start with Vital AI` when the patient wants a guided intake experience before the clinic determines the next step.

### Account And Access

1. The patient visits the public site and chooses a starting path.
2. The patient signs up or logs in through the access flow.
3. If onboarding is incomplete, the app prompts the patient to finish profile setup.
4. After login, the patient is routed into `Patient Home`.
5. `Patient Home` acts as the patient dashboard for next steps, active requests, messages, labs, and treatment follow-up.

### Core Actions

#### Booking A Visit

Steps:

1. Open `Book Visit` from the public site, `Patient Home`, or `Services`.
2. Choose a location.
3. Choose a service.
4. Choose a date and available time.
5. Add notes if needed.
6. Submit the request.

What the patient sees:

- service and location options
- appointment availability
- a request confirmation state

Expected outcome:

- the visit request is saved
- the clinic receives the request for review
- the patient can continue follow-up from `Patient Home`

#### Completing Intake

Steps:

1. Open `Vital AI / Intake` from the dashboard or from an intake prompt after booking.
2. Answer the guided intake questions.
3. Review the final answers.
4. Submit the intake.

What the patient sees:

- guided questions
- a review step before submission
- a completion message

Expected outcome:

- the intake is stored for clinic review
- the clinic can determine the next step
- provider review may be required before care advances

#### Using The Vital AI Intake Flow

Steps:

1. Start from the public `Vital AI` entry point or signed-in intake flow.
2. Choose the correct live location or preferred market.
3. Complete the guided questions.
4. Review the summary.
5. Submit the intake.

What the patient sees:

- a guided intake experience
- a review summary
- a final confirmation state

Expected outcome:

- the submission enters the clinic review workflow
- the clinic receives structured intake information
- if physician review is later required, the provider workflow handles it

#### Sending Messages

Steps:

1. Open `Messages`.
2. Select the current conversation or clinic thread.
3. Type the message.
4. Send it.

What the patient sees:

- conversation history
- secure message thread
- a message composer

Expected outcome:

- the care team receives the message
- the patient can continue communication inside the app

#### Viewing Labs

Steps:

1. Open `Labs`.
2. Review recent lab entries or uploaded lab information.
3. Open the item if more detail is available.

What the patient sees:

- lab summaries
- uploads or review areas depending on workflow stage

Expected outcome:

- the patient can review posted lab-related information
- the patient can stay aligned with treatment follow-up

#### Viewing Treatments

Steps:

1. Open `Treatments`.
2. Review current care instructions and past visits.
3. Open a treatment detail if more information is needed.

What the patient sees:

- current treatment items
- prior visit history
- care summaries and instructions

Expected outcome:

- the patient understands the current plan
- the patient can refer back to previous care guidance

### Required Patient Scenarios

#### 1. First-Time Patient Starting With Booking

1. Open the public site.
2. Choose `Book Visit`.
3. Select a service, location, and time.
4. Submit the visit request.
5. Create an account or sign in if prompted.
6. Complete onboarding if needed.
7. Open `Patient Home`.
8. Complete intake if the clinic requires additional information.

Final outcome:

- the visit request is recorded
- the patient gains dashboard access
- the clinic can review and continue the case

#### 2. First-Time Patient Starting With Vital AI

1. Open the public site.
2. Choose `Start with Vital AI`.
3. Complete the guided intake flow.
4. Submit the intake.
5. Create an account or sign in if prompted.
6. Open `Patient Home`.
7. Watch for follow-up, additional intake needs, or booking guidance.

Final outcome:

- the intake is submitted
- the clinic receives structured information
- the patient is set up for follow-up inside the app

#### 3. Returning Patient Checking Results Or Messaging

1. Sign in.
2. Open `Patient Home`.
3. Choose `Labs` to review results or `Messages` to contact the clinic.
4. Review dashboard notices for any next steps.

Final outcome:

- the patient sees current updates
- the patient can continue care coordination without restarting intake

#### 4. Patient Completing Intake After Booking

1. Sign in.
2. Open `Patient Home`.
3. Find the intake prompt related to the booking.
4. Open the intake flow.
5. Complete and submit the guided questions.
6. Return to the dashboard.

Final outcome:

- the booking now includes intake information
- the clinic can review the request with the patient context attached

### System Behavior Notes

- After a booking request is submitted, the clinic reviews it before the visit is finalized.
- After intake is submitted, provider review may be required before care advances.
- Some submissions automatically create the next internal task for the clinic.
- `Patient Home` is the best place for the patient to check what should happen next.

### Important Patient Limitations

- `Basket & Payments` is placeholder-only and does not run live checkout.
- Some locations may appear in public-facing flows as coming-soon or expansion markets, but they are not active care locations.
- Not every submission creates an immediate finalized appointment. Clinic review may come first.

## 3. Provider Guide

### Login And Context

1. Sign in with a provider, staff, or physician account.
2. Enter the provider workspace.
3. Confirm the active clinic location before beginning operational work.
4. Work from the correct location scope when reviewing queue items, intake, labs, and protocol tasks.

Why location matters:

- provider workflows are clinic-aware and location-aware
- queue visibility depends on clinic and location scope
- the correct live site must be active before work begins

### Core Areas

#### Provider Dashboard

Purpose:

- daily overview
- main launch point for provider work

What the provider sees:

- overview panels
- quick links into queue, command center, messages, labs, and patient workflows

Exact actions:

1. Open the dashboard.
2. Review active work and current priorities.
3. Launch the next workflow from the dashboard.

Expected result:

- the provider is oriented to the day’s work and can enter the correct workflow quickly

#### Command Center

Purpose:

- location-based operational triage
- schedule and intake monitoring

What the provider sees:

- location-aware schedule context
- active triage panels
- launch points into visit and intake workflows

Exact actions:

1. Confirm the active location.
2. Review schedule and triage items.
3. Open the relevant workflow for the next case.

Expected result:

- the provider or staff can route work into the proper operational path

#### Provider Queue

Purpose:

- active encounter worklist

What the provider sees:

- queue items filtered by active location
- the current encounter work to pick up

Exact actions:

1. Open `Provider Queue`.
2. Select the correct patient encounter.
3. Move into patient chart or visit work.

Expected result:

- the selected encounter becomes the active working case

#### Patient Center

Purpose:

- active patient chart and encounter management

What the provider sees:

- patient chart context
- visit information
- documentation and treatment planning areas

Exact actions:

1. Open a patient from queue or patient list.
2. Review the chart and current visit context.
3. Continue documentation and planning.

Expected result:

- the provider can manage the active encounter from one workspace

#### Visit Builder

Purpose:

- connect appointment context to visit creation

What the provider sees:

- appointment-linked visit setup flow

Exact actions:

1. Open `Visit Builder`.
2. Confirm patient and appointment details.
3. Create or continue the visit.

Expected result:

- the visit is prepared for clinical documentation

#### Intake Review

Purpose:

- review submitted intake before care advances

What the provider sees:

- intake list
- status context
- intake details and uploads

Exact actions:

1. Open `Intake Review`.
2. Select a submission.
3. Review the content.
4. Update status or move the case forward.

Expected result:

- the intake is triaged and prepared for the next clinical step

#### Messages

Purpose:

- secure clinical communication

What the provider sees:

- patient conversations
- active threads

Exact actions:

1. Open a conversation.
2. Review patient messages.
3. Respond or coordinate internally as needed.

Expected result:

- communication remains inside the care workflow

#### Labs

Purpose:

- lab-related review and follow-up

What the provider sees:

- lab data, uploads, and review context

Exact actions:

1. Open `Labs`.
2. Review recent results or uploads.
3. Use this information to support care planning.

Expected result:

- lab information is incorporated into the active case

#### Vital AI Requests

Purpose:

- review AI-assisted intake submissions and determine next steps

What the provider sees:

- submitted request queue
- structured intake summaries
- handoff options into scheduling or follow-up

Exact actions:

1. Open `Vital AI Requests`.
2. Select a submission.
3. Review the structured intake summary.
4. Determine the next clinical or operational step.

Expected result:

- the AI-guided intake becomes an actionable case

#### Protocol Approval Queue

Purpose:

- physician review queue for AI-assisted protocol suggestions

What the provider sees:

- pending protocol suggestions
- review status
- case summaries

Exact actions:

1. Open the protocol queue.
2. Select the next pending case.
3. Launch protocol review.

Expected result:

- the case moves into physician decision-making

#### Protocol Review Screen

Purpose:

- physician-reviewed decision point for AI-assisted protocol suggestions

What the provider sees:

- the AI recommendation
- editable final recommendation fields
- actions for `Approve`, `Save Modifications`, and `Reject`

Exact actions:

1. Review the AI suggestion.
2. Confirm the clinical context.
3. Choose one of three actions:
   - `Approve`
   - `Save Modifications`
   - `Reject`
4. Sign off as required.

Expected result:

- the physician-reviewed decision is recorded
- workflow advances only after the correct sign-off

### Critical Rule

`AI suggests -> physician decides -> workflow advances`

This means:

- AI never finalizes treatment
- AI never replaces physician judgment
- physician approval is required before downstream action based on protocol review

### Required Provider Workflows

#### 1. Reviewing A New Intake

1. Open `Intake Review`.
2. Select the new submission.
3. Review answers, uploads, and status.
4. Determine whether the submission is complete.
5. Advance, hold, or route the case to the next internal step.

Final outcome:

- the intake is reviewed and triaged

#### 2. Moving From Queue To Patient Chart

1. Open `Provider Queue`.
2. Select the active encounter.
3. Open `Patient Center`.
4. Continue chart review and visit work.

Final outcome:

- the patient chart becomes the active work area

#### 3. Reviewing A Vital AI-Generated Intake

1. Open `Vital AI Requests`.
2. Select the request.
3. Review the structured intake summary.
4. Decide whether the patient should be scheduled, followed up, or reviewed further.
5. Continue into protocol review if that layer is required.

Final outcome:

- the guided intake converts into an actionable clinical next step

#### 4. Handling Missing Information

1. Open the intake or request.
2. Identify the missing information.
3. Hold or route the case appropriately.
4. Use messages or internal workflow to request clarification.

Final outcome:

- the case does not advance without required information

#### 5. Approving A Protocol

1. Open the case from `Protocol Approval Queue`.
2. Review the AI-assisted suggestion.
3. Confirm the recommendation is acceptable as written.
4. Approve and sign.

Final outcome:

- the AI recommendation is accepted as the physician-reviewed final decision

#### 6. Modifying A Protocol

1. Open the case from `Protocol Approval Queue`.
2. Review the AI-assisted suggestion.
3. Edit the recommendation fields that need physician adjustment.
4. Save modifications and sign.

Final outcome:

- the physician-edited recommendation becomes the final protocol on file

#### 7. Rejecting A Protocol

1. Open the case from `Protocol Approval Queue`.
2. Review the recommendation.
3. Decide that it should not advance.
4. Reject and sign.

Final outcome:

- the protocol is rejected
- the review is recorded
- the case is removed from the pending approval queue

## 4. Role Distinctions

### Staff / General Provider Actions

- intake review
- communication with patients
- documentation support
- chart prep
- schedule and queue triage
- gathering missing information
- moving cases into the correct review path

### Physician-Only Actions

- approving an AI-assisted protocol
- modifying an AI recommendation into the physician-final protocol
- rejecting a protocol
- final sign-off that allows protocol-driven downstream workflow

## 5. End-To-End Workflow Examples

### 1. Patient -> Intake -> Provider Review -> Protocol Approval

1. The patient starts with Vital AI or completes intake after booking.
2. The intake is submitted.
3. The provider reviews the intake.
4. If protocol support is generated, the case enters `Protocol Approval Queue`.
5. The physician opens protocol review.
6. The physician approves, modifies, or rejects.
7. Workflow advances only after the physician decision is recorded.

Final outcome:

- a reviewed and signed clinical direction is on file

### 2. Patient -> Booking -> Intake -> Visit -> Follow-Up

1. The patient requests a visit.
2. The patient completes intake if prompted.
3. The clinic reviews the request.
4. The provider prepares the visit.
5. The visit is created and managed in the provider workflow.
6. The patient later reviews treatments, messages, labs, and follow-up instructions.

Final outcome:

- the patient moves from request to active care and post-visit follow-up

### 3. Vital AI -> Provider -> Approval -> Future Fulfillment-Ready State

1. The patient submits a Vital AI intake.
2. The provider reviews the case.
3. An AI-assisted protocol suggestion is generated when applicable.
4. The physician signs off through protocol review.
5. The reviewed outcome becomes ready for downstream operational use when those workflows are active.

Final outcome:

- the case is physician-cleared and ready for the next operational phase

## 6. Quick Route Summary

### Patient Routes

- `/patient/home`: patient dashboard for next steps, appointments, labs, treatments, and messages
- `/patient/services`: service discovery and treatment browsing
- `/patient/book`: patient visit request flow
- `/patient/chat`: patient messaging with the clinic
- `/patient/labs`: patient lab review area
- `/patient/treatments`: treatment plans and follow-up
- `/patient/billing`: basket and payment placeholder
- `/intake`: Vital AI and intake entry point

### Provider Routes

- `/provider`: provider dashboard and launch point
- `/provider/command`: command center for triage and schedule review
- `/provider/queue`: provider encounter worklist
- `/provider/patients`: provider patient list and patient center access
- `/provider/intakes`: intake review workspace
- `/provider/chat`: provider messaging
- `/provider/labs`: provider lab review
- `/provider/vital-ai`: Vital AI request queue
- `/provider/protocol-queue`: physician approval queue for AI-assisted protocols
- `/provider/protocol-review/:assessmentId`: physician review and sign-off screen

## 7. Troubleshooting / Common Questions

### Patient Questions

#### What if intake is incomplete?

Return to the intake prompt and finish the remaining questions before expecting full review.

#### What if no labs appear yet?

Labs may not have been posted yet or may not be part of the current workflow stage.

#### What if the patient is waiting after submission?

The clinic may still be reviewing the request or intake. The best place to check for next steps is `Patient Home`.

#### What if the patient needs help before the next step?

Use `Messages` to contact the clinic care team.

### Provider Questions

#### What if patient information is incomplete?

Hold the case and request missing details before advancing it.

#### What if no labs are uploaded?

Continue the workflow based on available information and follow clinic process for missing lab data.

#### What if a protocol is rejected?

The rejection is recorded and the case should not continue through the approval queue as an approved protocol.

#### What if the wrong location is active?

Change location scope before continuing queue, intake, lab, or protocol work.

## 8. Important Notes And Limitations

- Coming-soon markets may appear in public flows but are not operational care locations.
- `Basket & Payments` is not live.
- Provider workflows are location-aware.
- Protocol approval requires physician sign-off.
- AI-assisted suggestions do not replace clinical judgment.
- Some workflows may continue to evolve as the platform grows.
