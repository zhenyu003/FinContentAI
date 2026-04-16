import { createContext, useContext, useState, useEffect, useRef } from "react";
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
import ProfilePage from "./pages/ProfilePage";
import KnowledgePage from "./pages/KnowledgePage";
import MotionStudioPage from "./pages/MotionStudioPage";

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

  const navBtn: React.CSSProperties = {
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = "var(--accent)";
    e.currentTarget.style.background = "var(--bg-card)";
  };
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = "var(--border)";
    e.currentTarget.style.background = "var(--bg-input)";
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        style={{ ...navBtn, borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 }}
        onClick={() => navigate("/")}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-input)"; }}
      >
        + Create
      </button>
      <button style={navBtn} onClick={() => navigate("/account")} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        Account
      </button>
      <button style={navBtn} onClick={() => navigate("/knowledge")} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        Knowledge
      </button>
      <button
        style={navBtn}
        onClick={async () => { await signOut(); navigate("/"); }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        Sign Out
      </button>
    </div>
  );
}

const SESSION_KEY = "fincontent_project";

function loadSessionState(): ProjectState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectState;
      // Sanity check: must have the expected shape
      if (parsed && typeof parsed === "object" && "scenes" in parsed) {
        return { ...defaultState, ...parsed };
      }
    }
  } catch {
    // Corrupted data — ignore
  }
  return defaultState;
}

function AppContent() {
  const [state, setState] = useState<ProjectState>(loadSessionState);
  const isFirstRender = useRef(true);

  // Persist state to sessionStorage on every change (skip first render to avoid overwriting with defaults)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — ignore
    }
  }, [state]);

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
            <Route path="/account" element={<ProfilePage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/topic" element={<TopicPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/workspace/motion/:sceneIndex" element={<MotionStudioPage />} />
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
