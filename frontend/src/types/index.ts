export interface Topic {
  title: string;
  summary: string;
  sources: string[];
}

export interface Idea {
  narrative_template: string;
  template_reason: string;
  core_argument: string;
  angle: string;
  hook: string;
}

export interface Scene {
  scene_number: number;
  scene_type: "image";
  description: string;
  narration: string;
  image_url?: string;
  audio_url?: string;
  audio_duration?: number;
}

export interface ProjectState {
  topic: Topic | null;
  idea: Idea | null;
  userOpinion: string;
  qaQuestions: string[];
  qaAnswers: string[];
  duration: string;
  aspectRatio: string;
  scenes: Scene[];
  videoUrl: string | null;
  metadata: {
    titles: string[];
    selectedTitle: string;
    description: string;
    thumbnailUrl: string | null;
  };
}
