export interface Topic {
  title: string;
  summary: string;
  sources: string[];
  youtube_views?: number;
  twitter_views?: number;
  ai_summary?: string;
}

export interface Trend {
  id: string;
  title: string;
  summary: string;
  engagement: number;
  category?: string;
  youtube_views?: number;
  twitter_likes?: number;
  twitter_retweets?: number;
  ai_summary?: string;
}

export interface Idea {
  narrative_template: string;
  template_reason: string;
  core_argument: string;
  angle: string;
  hook: string;
}

export type SceneMode = "image" | "chart" | "motion";

export type MotionStyle = "cinematic" | "data-animation" | "infographic";

export interface ChartSeries {
  name: string;
  data: number[];
  style: "volatile" | "smooth";
}

export interface ChartConfig {
  chartType: "line" | "bar";
  labels: string[];
  series: ChartSeries[];
}

export interface Scene {
  scene_number: number;
  scene_type: "image";
  description: string;
  narration: string;
  image_url?: string;
  /** Short MP4 for Motion mode (Ken Burns style clip). */
  motion_url?: string;
  audio_url?: string;
  audio_duration?: number;
  mode?: SceneMode;
  chartConfig?: ChartConfig;
  motionStyle?: MotionStyle;
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
