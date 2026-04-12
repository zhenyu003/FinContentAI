import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ydtppzcbnlerbfzutrux.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkdHBwemNibmxlcmJmenV0cnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDY2MTksImV4cCI6MjA5MTQyMjYxOX0.UBDCOLJ-CVrVCNMBnCDKZYFtOrXoZPM19-O1cKDtCuQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
