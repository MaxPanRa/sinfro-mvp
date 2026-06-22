export interface ProfileSkill {
  name: string;
  level: number;
}

export interface CvDocument {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  parseStatus: string;
}

export interface Profile {
  id: number;
  initials: string;
  name: string;
  role: string;
  email: string;
  english: string;
  location: string;
  modality: string;
  salary: string;
  cvStatus: string;
  description: string;
  keywords: string[];
  skills: ProfileSkill[];
  active?: boolean;
  cvDocument?: CvDocument | null;
}

export interface ProfileDraft extends Profile {
  active: boolean;
}

export type ProfilePayload = Omit<Profile, "id"> & { active: boolean };
