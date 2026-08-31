export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  professional_title: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  portfolio: string | null;
  photo_url: string | null;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}


export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaultFile {
  id: string;
  user_id: string;
  name: string;
  folder_id: string | null;
  storage_path: string | null;
  file_type: string | null;
  mime_type: string | null;
  size_bytes: number;
  category: string | null;
  description: string | null;
  favorite: boolean;
  ocr_text: string | null;
  metadata: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface ItemTag {
  id: string;
  user_id: string;
  tag_id: string;
  item_type: string;
  item_id: string;
  created_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  title: string;
  issuing_organization: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  certificate_id: string | null;
  credential_url: string | null;
  verification_url: string | null;
  category: string | null;
  attachment_path: string | null;
  notes: string | null;
  favorite: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  role: string | null;
  company: string | null;
  start_date: string | null;
  end_date: string | null;
  technologies: string[] | null;
  project_url: string | null;
  github_url: string | null;
  live_url: string | null;
  notes: string | null;
  favorite: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  target_role: string | null;
  version: string | null;
  file_path: string | null;
  notes: string | null;
  is_primary: boolean;
  favorite: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Credential {
  id: string;
  user_id: string;
  service: string;
  username: string | null;
  url: string | null;
  password_encrypted: string;
  notes: string | null;
  totp_secret_encrypted: string | null;
  recovery_info_encrypted: string | null;
  strength_score: number;
  favorite: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  user_id: string;
  nickname: string;
  bank: string | null;
  cardholder_name: string | null;
  last_four: string | null;
  number_encrypted: string | null;
  expiry_date: string | null;
  card_type: string | null;
  notes: string | null;
  favorite: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecureNote {
  id: string;
  user_id: string;
  title: string;
  content_encrypted: string;
  folder_id: string | null;
  favorite: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialProfile {
  id: string;
  user_id: string;
  platform: string;
  username: string | null;
  url: string | null;
  description: string | null;
  icon: string | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  item_type: string | null;
  item_id: string | null;
  details: string | null;
  sensitive: boolean;
  created_at: string;
}

export interface ShareLink {
  id: string;
  user_id: string;
  file_id: string;
  token: string;
  password_hash: string | null;
  expires_at: string | null;
  view_only: boolean;
  downloads: number;
  max_downloads: number | null;
  created_at: string;
}

export type SearchResult = {
  type: 'file' | 'certificate' | 'project' | 'resume' | 'credential' | 'card' | 'note' | 'social';
  id: string;
  title: string;
  subtitle: string | null;
  icon: string;
};
