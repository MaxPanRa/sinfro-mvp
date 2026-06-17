import { Plus } from "lucide-react";
import type { Profile, ProfileDraft } from "../types/profile";
import { ProfileDetail } from "../components/profiles/ProfileDetail";
import { ProfileEditorModal } from "../components/profiles/ProfileEditorModal";
import { ProfileList } from "../components/profiles/ProfileList";
import { Button } from "../components/ui/Button";

interface ProfilesViewProps {
  profiles: Profile[];
  activeId: number;
  activeProfile: Profile;
  draft: ProfileDraft | null;
  editorOpen: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onEdit: () => void;
  onCloseEditor: () => void;
  onSave: (draft: ProfileDraft) => void;
}

export function ProfilesView({ profiles, activeId, activeProfile, draft, editorOpen, onSelect, onNew, onEdit, onCloseEditor, onSave }: ProfilesViewProps) {
  return (
    <div className="view">
      <div className="view-inner">
        <div className="view-title-row">
          <h2>Perfiles de busqueda</h2>
          <span className="mono faint" style={{ fontSize: 12 }}>{profiles.length} perfiles · 1 activo</span>
          <div className="spacer" />
          <Button onClick={onNew} icon={<Plus size={14} />}>Nuevo perfil</Button>
        </div>

        <div className="profiles-grid">
          <ProfileList profiles={profiles} activeId={activeId} onSelect={onSelect} />
          <ProfileDetail profile={activeProfile} onEdit={onEdit} />
        </div>
      </div>
      <ProfileEditorModal open={editorOpen} draft={draft} onClose={onCloseEditor} onSave={onSave} />
    </div>
  );
}
