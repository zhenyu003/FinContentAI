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

export interface NarrativeBeat {
  id: string;
  purpose: string;
  instruction: string;
}

/** AI-generated narrative spine (from Narrative Builder). */
export interface NarrativeStructure {
  name: string;
  tone: string;
  style_tags: string[];
  beats: NarrativeBeat[];
}

/** One block in a custom social post template (not video beats). */
export interface SocialPostTemplateSection {
  section: string;
  purpose: string;
  instruction: string;
}

/** LLM-generated structure for one cohesive social post. */
export interface SocialPostTemplate {
  name: string;
  structure: SocialPostTemplateSection[];
  tone: string;
  platform_style: string;
}

export interface Idea {
  narrative_template: string;
  template_reason: string;
  core_argument: string;
  angle: string;
  hook: string;
  suggested_platforms?: string[];
  /** Structured beats used for script generation when present. */
  narrative_structure?: NarrativeStructure;
  /** Single-post social template from /template/social-generate (social flow only). */
  social_post_template?: SocialPostTemplate;
}

export type SceneMode = "image" | "chart" | "motion";

/** Workspace visual mode (aligned with SceneMode). */
export type SceneVisualType = "image" | "chart" | "motion";

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
  /** Veo-generated MP4 for Motion mode. */
  motion_url?: string;
  audio_url?: string;
  audio_duration?: number;
  mode?: SceneMode;
  /** Same as mode for script/workstation; optional for older saved projects. */
  type?: SceneVisualType;
  chartConfig?: ChartConfig;
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
