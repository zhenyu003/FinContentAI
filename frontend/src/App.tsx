import { createContext, useContext, useState } from "react";
import { Routes, Route } from "react-router-dom";
import type { ProjectState, Topic, Idea, Scene } from "./types";
import HomePage from "./pages/HomePage";
import TopicPage from "./pages/TopicPage";
import WorkspacePage from "./pages/WorkspacePage";
import PreviewPage from "./pages/PreviewPage";

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

export default function App() {
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
          <h1 onClick={() => (window.location.href = "/")}>FinContent AI</h1>
          <span className="tagline">
            AI-Powered Financial Video Production
          </span>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/topic" element={<TopicPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/preview" element={<PreviewPage />} />
          </Routes>
        </main>
      </div>
    </ProjectContext.Provider>
  );
}
