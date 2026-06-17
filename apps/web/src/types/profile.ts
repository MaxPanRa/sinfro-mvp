export interface ProfileSkill {
  name: string;
  level: number;
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
}

export interface ProfileDraft extends Profile {
  active: boolean;
}
