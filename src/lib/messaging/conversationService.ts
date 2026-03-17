import { supabase } from "../supabase";
import { getSignedUrl, uploadPatientFile } from "../patientFiles";

export type ConversationStatus = "open" | "closed";
export type MessageVisibility = "patient_visible" | "staff_internal" | "system";
export type MessageType = "message" | "internal_note" | "system";

export type MessagingRole = "patient" | "provider" | "clinical_staff" | "location_admin" | "super_admin" | "billing" | "front_desk";

export type StaffDirectoryUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  active_location_id: string | null;
};

export type ConversationListItem = {
  id: string;
  title: string;
  status: ConversationStatus;
  location_id: string;
  appointment_id: string | null;
  intake_submission_id: string | null;
  context_type: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  patient_id: string | null;
  patient_name: string;
  unread: boolean;
  participant_names: string[];
};

export type ConversationAttachment = {
  id: string;
  file_name: string;
  file_url: string | null;
  mime_type: string | null;
  patient_file_id: string | null;
};

export type MessageMention = {
  id: string;
  mentioned_user_id: string;
  display_name: string;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_patient_id: string | null;
  sender_name: string;
  visibility: MessageVisibility;
  message_type: MessageType;
  body: string;
  created_at: string;
  edited_at: string | null;
  mentions: MessageMention[];
  attachments: ConversationAttachment[];
  metadata_json: Record<string, any> | null;
};

type PatientRow = {
  id: string;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  location_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  intake_submission_id: string | null;
  title: string | null;
  status: ConversationStatus;
  context_type: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
};

type ParticipantRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  participant_role: string;
  last_read_at: string | null;
  can_view_internal: boolean;
  can_post_internal: boolean;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_patient_id: string | null;
  visibility: MessageVisibility;
  message_type: MessageType;
  body: string;
  created_at: string;
  edited_at: string | null;
  reply_to_message_id: string | null;
  metadata_json: Record<string, any> | null;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  patient_file_id: string | null;
  file_name: string;
  file_url: string | null;
  mime_type: string | null;
};

type MentionRow = {
  id: string;
  message_id: string;
  mentioned_user_id: string;
};

const CONVERSATION_SELECT_FIELDS =
  "id,created_at,updated_at,location_id,patient_id,appointment_id,intake_submission_id,title,status,context_type,last_message_at,last_message_preview";
const PARTICIPANT_SELECT_FIELDS =
  "id,conversation_id,user_id,participant_role,last_read_at,can_view_internal,can_post_internal";
const MESSAGE_SELECT_FIELDS =
  "id,conversation_id,sender_user_id,sender_patient_id,visibility,message_type,body,created_at,edited_at,reply_to_message_id,metadata_json";
const ATTACHMENT_SELECT_FIELDS = "id,message_id,patient_file_id,file_name,file_url,mime_type";
const MENTION_SELECT_FIELDS = "id,message_id,mentioned_user_id";
const STAFF_ROLES = ["provider", "clinical_staff", "location_admin", "super_admin", "billing", "front_desk"] as const;

function displayName(firstName?: string | null, lastName?: string | null, fallback = "Unknown") {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || fallback;
}

function isPatientRole(role: string | null | undefined) {
  return role === "patient";
}

function staffParticipantRole(role: string | null | undefined) {
  if (role === "provider") return "provider";
  if (role === "location_admin" || role === "super_admin") return "admin";
  return "staff";
}

async function loadPatientRowForProfile(profileId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("id,profile_id,first_name,last_name")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as PatientRow | null) ?? null;
}

async function resolvePatientRow(candidateId: string) {
  const { data: byId, error: byIdErr } = await supabase
    .from("patients")
    .select("id,profile_id,first_name,last_name")
    .eq("id", candidateId)
    .maybeSingle();
  if (byIdErr) throw byIdErr;
  if (byId) return byId as PatientRow;

  const { data: byProfile, error: byProfileErr } = await supabase
    .from("patients")
    .select("id,profile_id,first_name,last_name")
    .eq("profile_id", candidateId)
    .maybeSingle();
  if (byProfileErr) throw byProfileErr;
  return (byProfile as PatientRow | null) ?? null;
}

async function ensureConversationParticipant(args: {
  conversationId: string;
  userId: string;
  participantRole: string;
  canViewInternal: boolean;
  canPostInternal: boolean;
}) {
  const { conversationId, userId, participantRole, canViewInternal, canPostInternal } = args;
  const { data: existing, error: existingErr } = await supabase
    .from("conversation_participants")
    .select(PARTICIPANT_SELECT_FIELDS)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing) return existing as ParticipantRow;

  const { data, error } = await supabase
    .from("conversation_participants")
    .insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        participant_role: participantRole,
        can_view_internal: canViewInternal,
        can_post_internal: canPostInternal,
      },
    ])
    .select(PARTICIPANT_SELECT_FIELDS)
    .maybeSingle();

  if (error) throw error;
  return data as ParticipantRow;
}

export async function joinConversationAsUser(args: {
  conversationId: string;
  userId: string;
  role: string | null | undefined;
}) {
  return ensureConversationParticipant({
    conversationId: args.conversationId,
    userId: args.userId,
    participantRole: isPatientRole(args.role) ? "patient" : staffParticipantRole(args.role),
    canViewInternal: !isPatientRole(args.role),
    canPostInternal: !isPatientRole(args.role),
  });
}

async function loadPatientNames(patientIds: string[]) {
  if (patientIds.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase
    .from("patients")
    .select("id,first_name,last_name")
    .in("id", Array.from(new Set(patientIds)));
  if (error) throw error;

  const map: Record<string, string> = {};
  ((data as Array<{ id: string; first_name: string | null; last_name: string | null }>) ?? []).forEach((row) => {
    map[row.id] = displayName(row.first_name, row.last_name, "Patient");
  });
  return map;
}

async function loadStaffNames(userIds: string[]) {
  if (userIds.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .in("id", Array.from(new Set(userIds)));
  if (error) throw error;

  const map: Record<string, string> = {};
  ((data as Array<{ id: string; first_name: string | null; last_name: string | null }>) ?? []).forEach((row) => {
    map[row.id] = displayName(row.first_name, row.last_name, "Care Team");
  });
  return map;
}

async function loadConversationParticipants(conversationIds: string[]) {
  if (conversationIds.length === 0) return [] as ParticipantRow[];
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(PARTICIPANT_SELECT_FIELDS)
    .in("conversation_id", Array.from(new Set(conversationIds)));
  if (error) throw error;
  return ((data as ParticipantRow[]) ?? []) as ParticipantRow[];
}

export async function loadStaffDirectory(activeLocationId?: string) {
  let query = supabase
    .from("profiles")
    .select("id,first_name,last_name,role,active_location_id")
    .in("role", [...STAFF_ROLES])
    .order("first_name");

  if (activeLocationId) query = query.eq("active_location_id", activeLocationId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as StaffDirectoryUser[]) ?? []).filter((item) => item.id);
}

export async function loadPatientConversationList(userId: string) {
  const patient = await loadPatientRowForProfile(userId);
  if (!patient?.id) return [];

  const { data, error } = await supabase
    .from("conversation_participants")
    .select(
      `last_read_at, conversations!inner(${CONVERSATION_SELECT_FIELDS})`
    )
    .eq("user_id", userId)
    .order("created_at", { foreignTable: "conversations", ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{ last_read_at: string | null; conversations: ConversationRow | ConversationRow[] }>;
  const conversations = rows
    .map((row) => {
      const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
      if (!conversation) return null;
      return {
        ...conversation,
        unread: Boolean(conversation.last_message_at && (!row.last_read_at || conversation.last_message_at > row.last_read_at)),
      };
    })
    .filter(Boolean) as Array<ConversationRow & { unread: boolean }>;

  const participants = await loadConversationParticipants(conversations.map((item) => item.id));
  const staffNames = await loadStaffNames(
    participants
      .filter((item) => item.participant_role !== "patient")
      .map((item) => item.user_id)
  );

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title?.trim() || "Conversation",
    status: conversation.status,
    location_id: conversation.location_id,
    appointment_id: conversation.appointment_id,
    intake_submission_id: conversation.intake_submission_id,
    context_type: conversation.context_type,
    last_message_at: conversation.last_message_at,
    last_message_preview: conversation.last_message_preview,
    created_at: conversation.created_at,
    patient_id: conversation.patient_id,
    patient_name: displayName(patient.first_name, patient.last_name, "You"),
    unread: conversation.unread,
    participant_names: participants
      .filter((item) => item.conversation_id === conversation.id && item.participant_role !== "patient")
      .map((item) => staffNames[item.user_id] ?? "Care Team"),
  })) as ConversationListItem[];
}

export async function loadProviderConversationList(args: {
  userId: string;
  locationIds: string[];
  activeLocationId?: string;
}) {
  const { userId, locationIds, activeLocationId } = args;
  if (locationIds.length === 0) return [];

  let query = supabase
    .from("conversations")
    .select(CONVERSATION_SELECT_FIELDS)
    .in("location_id", locationIds)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeLocationId) query = query.eq("location_id", activeLocationId);

  const { data, error } = await query;
  if (error) throw error;

  const conversations = ((data as ConversationRow[]) ?? []) as ConversationRow[];
  const participants = await loadConversationParticipants(conversations.map((item) => item.id));
  const patientNames = await loadPatientNames(conversations.map((item) => item.patient_id).filter(Boolean) as string[]);
  const staffNames = await loadStaffNames(participants.map((item) => item.user_id));
  const participantByConversation = new Map<string, ParticipantRow>();

  participants
    .filter((item) => item.user_id === userId)
    .forEach((item) => {
      participantByConversation.set(item.conversation_id, item);
    });

  return conversations.map((conversation) => {
    const mine = participantByConversation.get(conversation.id);
    return {
      id: conversation.id,
      title: conversation.title?.trim() || "Patient Conversation",
      status: conversation.status,
      location_id: conversation.location_id,
      appointment_id: conversation.appointment_id,
      intake_submission_id: conversation.intake_submission_id,
      context_type: conversation.context_type,
      last_message_at: conversation.last_message_at,
      last_message_preview: conversation.last_message_preview,
      created_at: conversation.created_at,
      patient_id: conversation.patient_id,
      patient_name: conversation.patient_id ? patientNames[conversation.patient_id] ?? "Patient" : "Patient",
      unread: Boolean(
        conversation.last_message_at &&
          (!mine?.last_read_at || conversation.last_message_at > mine.last_read_at)
      ),
      participant_names: participants
        .filter((item) => item.conversation_id === conversation.id && item.participant_role !== "patient")
        .map((item) => staffNames[item.user_id] ?? "Care Team"),
    };
  }) as ConversationListItem[];
}

export async function loadConversationMessages(args: {
  conversationId: string;
  role: string | null | undefined;
}) {
  const { conversationId, role } = args;
  let query = supabase
    .from("messages")
    .select(MESSAGE_SELECT_FIELDS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (isPatientRole(role)) query = query.in("visibility", ["patient_visible", "system"]);

  const { data, error } = await query;
  if (error) throw error;

  const messages = ((data as MessageRow[]) ?? []) as MessageRow[];
  const messageIds = messages.map((item) => item.id);
  const senderUserIds = messages.map((item) => item.sender_user_id).filter(Boolean) as string[];
  const senderPatientIds = messages.map((item) => item.sender_patient_id).filter(Boolean) as string[];

  const [attachmentsRes, mentionsRes, staffNames, patientNames] = await Promise.all([
    messageIds.length
      ? supabase.from("message_attachments").select(ATTACHMENT_SELECT_FIELDS).in("message_id", messageIds)
      : Promise.resolve({ data: [], error: null }),
    messageIds.length
      ? supabase.from("message_mentions").select(MENTION_SELECT_FIELDS).in("message_id", messageIds)
      : Promise.resolve({ data: [], error: null }),
    loadStaffNames(senderUserIds),
    loadPatientNames(senderPatientIds),
  ]);

  if (attachmentsRes.error) throw attachmentsRes.error;
  if (mentionsRes.error) throw mentionsRes.error;

  const mentionRows = ((mentionsRes.data as MentionRow[]) ?? []) as MentionRow[];
  const mentionNames = await loadStaffNames(mentionRows.map((item) => item.mentioned_user_id));

  return messages.map((message) => ({
    id: message.id,
    conversation_id: message.conversation_id,
    sender_user_id: message.sender_user_id,
    sender_patient_id: message.sender_patient_id,
    sender_name: message.sender_patient_id
      ? patientNames[message.sender_patient_id] ?? "Patient"
      : message.sender_user_id
      ? staffNames[message.sender_user_id] ?? (isPatientRole(role) ? "Clinic" : "Care Team")
      : "System",
    visibility: message.visibility,
    message_type: message.message_type,
    body: message.body,
    created_at: message.created_at,
    edited_at: message.edited_at,
    metadata_json: message.metadata_json ?? null,
    attachments: (((attachmentsRes.data as AttachmentRow[]) ?? []) as AttachmentRow[])
      .filter((item) => item.message_id === message.id)
      .map((item) => ({
        id: item.id,
        file_name: item.file_name,
        file_url: item.file_url,
        mime_type: item.mime_type,
        patient_file_id: item.patient_file_id,
      })),
    mentions: mentionRows
      .filter((item) => item.message_id === message.id)
      .map((item) => ({
        id: item.id,
        mentioned_user_id: item.mentioned_user_id,
        display_name: mentionNames[item.mentioned_user_id] ?? "Care Team",
      })),
  })) as ConversationMessage[];
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function ensureAppointmentConversation(args: {
  appointmentId: string;
  patientCandidateId: string;
  locationId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
  title?: string;
}) {
  const { appointmentId, patientCandidateId, locationId, actorUserId, actorRole, title } = args;
  const { data: existing, error: existingErr } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT_FIELDS)
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existingErr) throw existingErr;

  const patient = await resolvePatientRow(patientCandidateId);
  if (!patient?.id || !patient.profile_id) throw new Error("Patient record not found for messaging.");

  let conversation = existing as ConversationRow | null;

  if (!conversation) {
    const { data, error } = await supabase
      .from("conversations")
      .insert([
        {
          location_id: locationId,
          patient_id: patient.id,
          appointment_id: appointmentId,
          title: title ?? "Appointment conversation",
          status: "open",
          context_type: "appointment",
        },
      ])
      .select(CONVERSATION_SELECT_FIELDS)
      .maybeSingle();

    if (error) throw error;
    conversation = data as ConversationRow;
  }

  await ensureConversationParticipant({
    conversationId: conversation.id,
    userId: patient.profile_id,
    participantRole: "patient",
    canViewInternal: false,
    canPostInternal: false,
  });

  await ensureConversationParticipant({
    conversationId: conversation.id,
    userId: actorUserId,
    participantRole: isPatientRole(actorRole) ? "patient" : staffParticipantRole(actorRole),
    canViewInternal: !isPatientRole(actorRole),
    canPostInternal: !isPatientRole(actorRole),
  });

  return conversation.id;
}

export async function createPatientConversation(args: {
  userId: string;
  locationId: string;
  title?: string;
  intakeSubmissionId?: string | null;
}) {
  const patient = await loadPatientRowForProfile(args.userId);
  if (!patient?.id) throw new Error("Patient record not found.");

  const { data, error } = await supabase
    .from("conversations")
    .insert([
      {
        location_id: args.locationId,
        patient_id: patient.id,
        intake_submission_id: args.intakeSubmissionId ?? null,
        title: args.title ?? `Patient question - ${new Date().toLocaleDateString()}`,
        status: "open",
        context_type: args.intakeSubmissionId ? "intake" : "general",
      },
    ])
    .select(CONVERSATION_SELECT_FIELDS)
    .maybeSingle();

  if (error) throw error;

  await ensureConversationParticipant({
    conversationId: (data as ConversationRow).id,
    userId: args.userId,
    participantRole: "patient",
    canViewInternal: false,
    canPostInternal: false,
  });

  return (data as ConversationRow).id;
}

export async function closeConversation(conversationId: string) {
  const { error } = await supabase
    .from("conversations")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function countUnreadConversationsForPatient(userId: string) {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(`last_read_at, conversations!inner(id,last_message_at,status)`)
    .eq("user_id", userId);

  if (error) throw error;

  return ((data ?? []) as Array<{ last_read_at: string | null; conversations: ConversationRow | ConversationRow[] }>).reduce(
    (count, row) => {
      const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
      if (!conversation || conversation.status !== "open" || !conversation.last_message_at) return count;
      return !row.last_read_at || conversation.last_message_at > row.last_read_at ? count + 1 : count;
    },
    0
  );
}

export async function sendConversationMessage(args: {
  conversationId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
  body: string;
  visibility: MessageVisibility;
  mentionUserIds?: string[];
  files?: File[];
}) {
  const { conversationId, actorUserId, actorRole, visibility, mentionUserIds = [], files = [] } = args;
  const trimmedBody = args.body.trim();

  const { data: conversation, error: conversationErr } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT_FIELDS)
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationErr) throw conversationErr;
  if (!conversation) throw new Error("Conversation not found.");

  const isPatient = isPatientRole(actorRole);
  const patient = isPatient ? await loadPatientRowForProfile(actorUserId) : null;
  const mentionLabels = await loadStaffNames(mentionUserIds);

  const body =
    trimmedBody || (files.length > 0 ? (isPatient ? "Shared an attachment." : "Shared an attachment for review.") : "");

  if (!body) throw new Error("Add a message or attachment before sending.");

  const metadataJson =
    mentionUserIds.length > 0
      ? {
          mention_labels: mentionUserIds.map((id) => ({ user_id: id, label: mentionLabels[id] ?? "Care Team" })),
        }
      : {};

  const messageType: MessageType =
    visibility === "staff_internal" ? "internal_note" : visibility === "system" ? "system" : "message";

  const { data: message, error: messageErr } = await supabase
    .from("messages")
    .insert([
      {
        conversation_id: conversationId,
        sender_user_id: actorUserId,
        sender_patient_id: patient?.id ?? null,
        visibility,
        message_type: messageType,
        body,
        metadata_json: metadataJson,
      },
    ])
    .select(MESSAGE_SELECT_FIELDS)
    .maybeSingle();

  if (messageErr) throw messageErr;
  if (!message) throw new Error("Message was not created.");

  if (files.length > 0) {
    if (!conversation.patient_id) throw new Error("Conversation is missing a patient link for file upload.");

    for (const file of files) {
      const uploaded = await uploadPatientFile({
        patientId: conversation.patient_id,
        locationId: conversation.location_id,
        visitId: null,
        appointmentId: conversation.appointment_id,
        category: "chat_attachment",
        file,
      });

      let signedUrl: string | null = null;
      try {
        signedUrl = await getSignedUrl((uploaded as any).bucket, (uploaded as any).path);
      } catch {
        signedUrl = null;
      }

      const { error: attachmentErr } = await supabase.from("message_attachments").insert([
        {
          message_id: (message as MessageRow).id,
          patient_file_id: (uploaded as any).id ?? null,
          file_name: file.name,
          file_url: signedUrl,
          mime_type: file.type || null,
        },
      ]);

      if (attachmentErr) throw attachmentErr;
    }
  }

  if (mentionUserIds.length > 0) {
    const { error: mentionErr } = await supabase.from("message_mentions").insert(
      mentionUserIds.map((mentionedUserId) => ({
        message_id: (message as MessageRow).id,
        mentioned_user_id: mentionedUserId,
      }))
    );

    if (mentionErr) throw mentionErr;

    for (const mentionedUserId of mentionUserIds) {
      await ensureConversationParticipant({
        conversationId,
        userId: mentionedUserId,
        participantRole: "staff",
        canViewInternal: true,
        canPostInternal: true,
      });
    }
  }

  await ensureConversationParticipant({
    conversationId,
    userId: actorUserId,
    participantRole: isPatient ? "patient" : staffParticipantRole(actorRole),
    canViewInternal: !isPatient,
    canPostInternal: !isPatient,
  });

  const nowIso = new Date().toISOString();
  const { error: conversationUpdateErr } = await supabase
    .from("conversations")
    .update({
      status: "open",
      updated_at: nowIso,
      last_message_at: nowIso,
      last_message_preview: body.slice(0, 220),
    })
    .eq("id", conversationId);

  if (conversationUpdateErr) throw conversationUpdateErr;

  await markConversationRead(conversationId, actorUserId);
}
