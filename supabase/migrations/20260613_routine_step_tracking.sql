-- Routine step completion tracking for daily check-offs
CREATE TABLE IF NOT EXISTS public.routine_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL, -- 'morning', 'evening', 'weekly'
  step_index INTEGER NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, routine_id, step_type, step_index, completed_date)
);

CREATE INDEX idx_step_completions_user ON public.routine_step_completions(user_id, completed_date);

ALTER TABLE public.routine_step_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own step completions"
  ON public.routine_step_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own step completions"
  ON public.routine_step_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own step completions"
  ON public.routine_step_completions FOR DELETE
  USING (auth.uid() = user_id);
