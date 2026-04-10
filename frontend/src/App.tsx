import { createContext, useContext, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import type { ProjectState, Topic, Idea, Scene } from "./types";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import HomePage from "./pages/HomePage";
import TopicPage from "./pages/TopicPage";
import WorkspacePage from "./pages/WorkspacePage";
import PreviewPage from "./pages/PreviewPage";
import SocialIdeaPage from "./pages/SocialIdeaPage";
import SocialStudioPage from "./pages/SocialStudioPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import KnowledgePage from "./pages/KnowledgePage";

interface ProjectContextType {
  state: ProjectState;
  setTopic: (t: Topic) => void;
  setIdea: (i: Idea) => void;
  setUserOpinion: (o: string) => void;
  setQA: (questions: string[], answers: string[]) => void;
  setDuration: (d: string) => void;
  setAspectRatio: (a: string) => void;
  setScenes: (s: Scene[]) => void;
  updateScene: (index: number, patch: Partial<Scene>) => void;
  setVideoUrl: (url: string) => void;
  setMetadata: (patch: Partial<ProjectState["metadata"]>) => void;
}

const defaultState: ProjectState = {
  topic: null,
  idea: null,
  userOpinion: "",
  qaQuestions: [],
  qaAnswers: [],
  duration: "5min",
  aspectRatio: "16:9",
  scenes: [],
  videoUrl: null,
  metadata: {
    titles: [],
    selectedTitle: "",
    description: "",
    thumbnailUrl: null,
  },
};

export const ProjectContext = createContext<ProjectContextType>(null!);
export const useProject = () => useContext(ProjectContext);

function UserNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <button className="btn btn-sm" onClick={() => navigate("/auth")}>
        Sign In
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button className="btn btn-sm" onClick={() => navigate("/dashboard")}>
        Dashboard
      </button>
      <button className="btn btn-sm" onClick={() => navigate("/profile")}>
        Profile
      </button>
      <button className="btn btn-sm" onClick={() => navigate("/knowledge")}>
        Knowledge
      </button>
      <button
        className="btn btn-sm"
        style={{ opacity: 0.7 }}
        onClick={async () => { await signOut(); navigate("/"); }}
      >
        Sign Out
      </button>
    </div>
  );
}

function AppContent() {
  const [state, setState] = useState<ProjectState>(defaultState);

  const ctx: ProjectContextType = {
    state,
    setTopic: (t) => setState((s) => ({ ...s, topic: t })),
    setIdea: (i) => setState((s) => ({ ...s, idea: i })),
    setUserOpinion: (o) => setState((s) => ({ ...s, userOpinion: o })),
    setQA: (questions, answers) =>
      setState((s) => ({ ...s, qaQuestions: questions, qaAnswers: answers })),
    setDuration: (d) => setState((s) => ({ ...s, duration: d })),
    setAspectRatio: (a) => setState((s) => ({ ...s, aspectRatio: a })),
    setScenes: (scenes) => setState((s) => ({ ...s, scenes })),
    updateScene: (index, patch) =>
      setState((s) => ({
        ...s,
        scenes: s.scenes.map((sc, i) =>
          i === index ? { ...sc, ...patch } : sc
        ),
      })),
    setVideoUrl: (url) => setState((s) => ({ ...s, videoUrl: url })),
    setMetadata: (patch) =>
      setState((s) => ({ ...s, metadata: { ...s.metadata, ...patch } })),
  };

  return (
    <ProjectContext.Provider value={ctx}>
      <div className="app">
        <header className="app-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 onClick={() => (window.location.href = "/")}>FinContent AI</h1>
            <span className="tagline">
              AI-Powered Financial Content Production
            </span>
          </div>
          <UserNav />
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/topic" element={<TopicPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/social/idea" element={<SocialIdeaPage />} />
            <Route path="/social/studio" element={<SocialStudioPage />} />
          </Routes>
        </main>
      </div>
    </ProjectContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
