import type { User as AuthUser } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { AuthModal } from "./components/AuthModal";
import { LandingPage } from "./components/LandingPage";
import { Workspace } from "./components/Workspace";
import {
  signOutUser,
  fetchUserProfile,
  fetchUserWorkspaces,
  type Profile,
  type WorkspaceWithRole
} from "./lib/auth";

type View = "home" | "workspace";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithRole | null>(null);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    async function loadUserData(user: AuthUser | null) {
      if (!user) {
        setSessionUser(null);
        setProfile(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
        return;
      }

      setSessionUser(user);
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);

      const userWs = await fetchUserWorkspaces(user.id);
      setWorkspaces(userWs);
      if (userWs.length > 0) {
        setActiveWorkspace(userWs[0]);
      }
    }

    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        loadUserData(user);
      });

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        loadUserData(session?.user || null);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const handleOpenWorkspace = () => {
    if (!sessionUser && isSupabaseConfigured) {
      setAuthModalOpen(true);
    } else {
      setView("workspace");
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setView("home");
  };

  if (view === "workspace") {
    return (
      <Workspace
        user={sessionUser}
        profile={profile}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        onRefreshWorkspaces={async () => {
          if (sessionUser) {
            const ws = await fetchUserWorkspaces(sessionUser.id);
            setWorkspaces(ws);
          }
        }}
        onExit={() => setView("home")}
        onSignOut={handleSignOut}
        onOpenAuth={() => setAuthModalOpen(true)}
      />
    );
  }
  return (
    <>
      <LandingPage
        sessionUser={sessionUser}
        profile={profile}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenAuth={() => setAuthModalOpen(true)}
        onGoWorkspace={() => setView("workspace")}
        onGoHome={() => setView("home")}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        setMode={setAuthMode}
        onSuccess={() => {
          setAuthModalOpen(false);
          setView("workspace");
        }}
      />
    </>
  );
}
