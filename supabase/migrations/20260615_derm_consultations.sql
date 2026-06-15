-- Dermatologist escalation pathway: users can request a professional
-- review when AI analysis is insufficient or a concern feels urgent.
CREATE TABLE IF NOT EXISTS public.derm_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.skin_analyses(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'routine', -- 'routine', 'priority', 'urgent'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_review', 'responded', 'closed'
  dermatologist_notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_derm_consultations_user ON public.derm_consultations(user_id, created_at DESC);
CREATE INDEX idx_derm_consultations_status ON public.derm_consultations(status, created_at);

ALTER TABLE public.derm_consultations ENABLE ROW LEVEL SECURITY;

-- Admin flag used to gate the dermatologist response queue.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "Users can read own consultations"
  ON public.derm_consultations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own consultations"
  ON public.derm_consultations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all consultations"
  ON public.derm_consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can respond to consultations"
  ON public.derm_consultations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
