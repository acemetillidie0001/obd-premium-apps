/**
 * OBD CRM Types (V3)
 * 
 * Type definitions for the OBD CRM application.
 * V3 scope: Contacts, Tags, Notes, Export
 */

// Contact Status
export type CrmContactStatus = "Lead" | "Active" | "Past" | "DoNotContact";

// Contact Source
export type CrmContactSource = "manual" | "scheduler" | "reviews" | "helpdesk" | "import";

// Contact Fields
export interface CrmContact {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  status: CrmContactStatus;
  source: CrmContactSource;
  tags: CrmTag[];
  lastNote?: string | null; // Preview of most recent note (optional, for list views)
  lastTouchAt?: string | null; // Timestamp of most recent activity/note (optional, for list views)
  activities?: CrmContactActivity[]; // Added for detail view
  nextFollowUpAt?: string | null; // Next follow-up date/time
  nextFollowUpNote?: string | null; // Optional note for follow-up
  createdAt: string;
  updatedAt: string;
}

// Tag
export interface CrmTag {
  id: string;
  businessId: string;
  name: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Note/Activity
export interface CrmContactNote {
  id: string;
  contactId: string;
  businessId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Contact Activity (V3 supports notes only, but structure supports future types)
export interface CrmContactActivity {
  id: string;
  contactId: string;
  businessId: string;
  type: "note";
  content: string;
  createdAt: string;
  updatedAt: string;
}

// API Request/Response Types

// Create Contact Request
export interface CreateContactRequest {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  status?: CrmContactStatus;
  source?: CrmContactSource;
  tagIds?: string[];
}

// Update Contact Request
export interface UpdateContactRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  status?: CrmContactStatus;
  tagIds?: string[];
}

// Contact List Query Parameters
export interface ContactListQuery {
  search?: string;
  status?: CrmContactStatus;
  tagId?: string;
  sort?: "updatedAt" | "createdAt" | "name";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// Contact List Response
export interface ContactListResponse {
  contacts: CrmContact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Export Request (includes filters)
export interface ExportContactsRequest {
  search?: string;
  status?: CrmContactStatus;
  tagId?: string;
}

// Create Tag Request
export interface CreateTagRequest {
  name: string;
  color?: string;
}

// Add Note Request
export interface AddNoteRequest {
  content: string;
}

