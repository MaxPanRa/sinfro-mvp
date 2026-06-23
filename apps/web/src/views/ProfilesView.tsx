import { Plus, UserRound } from "lucide-react";
import type { Profile, ProfileDraft } from "../types/profile";
import { ProfileDetail } from "../components/profiles/ProfileDetail";
import { ProfileEditorModal } from "../components/profiles/ProfileEditorModal";
import { ProfileList } from "../components/profiles/ProfileList";
import { Button } from "../components/ui/Button";

interface ProfilesViewProps {
  profiles: Profile[];
  profilesLimit: number;
  keywordsLimit: number;
  activeId: number;
  activeProfile: Profile;
  draft: ProfileDraft | null;
  editorOpen: boolean;
  usesAi: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onEdit: () => void;
  onCloseEditor: () => void;
  onSave: (draft: ProfileDraft) => void;
  onDelete: (id: number) => void;
  onProfileUpdated: (profile: Profile) => void;
}

export function ProfilesView({ profiles, profilesLimit, keywordsLimit, activeId, activeProfile, draft, editorOpen, usesAi, onSelect, onNew, onEdit, onCloseEditor, onSave, onDelete, onProfileUpdated }: ProfilesViewProps) {
  const isEmpty = profiles.length === 0;
  const atLimit = profiles.length >= profilesLimit;
  return (
    <div className="view">
      <div className="view-inner">
        <div className="view-title-row">
          <h2>Perfiles de busqueda</h2>
          <span className="mono faint" style={{ fontSize: 12 }}>{profiles.length}/{profilesLimit} {profilesLimit === 1 ? "perfil" : "perfiles"} de tu plan</span>
          <div className="spacer" />
          <span data-tour="new-profile" title={atLimit ? `Tu plan permite hasta ${profilesLimit} ${profilesLimit === 1 ? "perfil" : "perfiles"}` : undefined}>
            <Button onClick={onNew} disabled={atLimit} icon={<Plus size={14} />}>Nuevo perfil</Button>
          </span>
        </div>

        {isEmpty ? (
          <div className="profiles-empty">
            <UserRound size={30} color="var(--faint)" />
            <h3 style={{ margin: "14px 0 6px", fontSize: 16 }}>Aún no tienes perfiles</h3>
            <p className="muted" style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.55, maxWidth: 360 }}>
              Crea tu primer perfil para empezar a comparar vacantes con tu CV. Puedes subir tu currículum y autollenar la mayoría de los campos.
            </p>
            <Button variant="primary" onClick={onNew} icon={<Plus size={14} />}>Crear mi primer perfil</Button>
          </div>
        ) : (
          <div className="profiles-grid">
            <ProfileList profiles={profiles} activeId={activeId} onSelect={onSelect} />
            <ProfileDetail profile={activeProfile} onEdit={onEdit} />
          </div>
        )}
      </div>
      <ProfileEditorModal
        open={editorOpen}
        draft={draft}
        usesAi={usesAi}
        keywordsLimit={keywordsLimit}
        existing={draft ? profiles.some((profile) => profile.id === draft.id) : false}
        onClose={onCloseEditor}
        onSave={onSave}
        onDelete={onDelete}
        onProfileUpdated={onProfileUpdated}
      />
    </div>
  );
}
