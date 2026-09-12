-- ============================================================================
-- Felice Scratch Lab — fix the scratch-projects bucket leak
--
-- THE PROBLEM, exactly one policy:
--
--   "Allow users to read all files"  SELECT  USING (bucket_id = 'scratch-projects')
--
-- There is no owner check in it, so every signed-in student can read every
-- other student's .sb3. That is why listing the bucket root as a student showed
-- another user's folder.
--
-- The projects TABLE is already correct and is not touched by STEP 1.
--
-- CAREFUL: three features currently work *because of* this loose policy —
-- teachers opening student projects, students opening shared templates, and the
-- tutorial starter projects. Dropping it alone would break all three, so the
-- replacement below re-grants exactly those three cases and nothing more.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 — the fix.  One policy out, one policy in. Run as a single batch.
-- ----------------------------------------------------------------------------
BEGIN;

DROP POLICY IF EXISTS "Allow users to read all files" ON storage.objects;

CREATE POLICY "scratch_projects_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'scratch-projects'
        AND (
            -- a student's own folder
            (storage.foldername(name))[1] = auth.uid()::text

            -- teachers may open any student's work (read only; the Students tab
            -- has no Delete button, and writes stay owner-only below)
            OR auth.email() = 'john@felice.local'

            -- a project the teacher marked as a shared template.
            -- projects.file_path and storage.objects.name are the same string —
            -- saveProject() uploads to exactly the path it records — so Share
            -- makes the file readable and Unshare stops it, with no copying.
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.file_path = storage.objects.name
                  AND p.is_template = true
            )

            -- the tutorial starter projects for Code a Cartoon and
            -- Animate an Adventure Game
            OR (storage.foldername(name))[1] = 'tutorials'
        )
    );

COMMIT;

-- "Users manage own files" (FOR ALL, own folder) is left exactly as it is. It
-- already covers insert/update/delete correctly, and it keeps writes owner-only
-- for teachers too. Nothing else needs to change to close the leak.


-- ----------------------------------------------------------------------------
-- STEP 2 — verify, before you trust it
--
-- Signed in as the student 'test', in the browser console:
--
--   await supabase.storage.from('scratch-projects').list('');
--     -> expect ONLY that student's own folder, plus "tutorials"
--
--   await supabase.storage.from('scratch-projects').list('<another-user-id>');
--     -> expect []
--
-- Then, in the app:
--   * teacher -> Students tab -> Load a student project      (should work)
--   * teacher -> My Projects  -> Share one                   (should work)
--   * student -> Templates    -> Load the shared one         (should work)
--   * student -> Tutorials    -> Code a Cartoon              (should work)
-- ----------------------------------------------------------------------------
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;


-- ============================================================================
-- OPTIONAL — two smaller things found while reading the current policies.
-- Neither is the leak. Skip them before launch if you would rather not touch
-- anything else.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- OPTIONAL A — "Users can update own projects" has no WITH CHECK.
--
-- USING controls which rows you may update; WITH CHECK controls what they may
-- become. Without it a student can update their own row and set user_id to
-- someone else's, handing the row away. Nothing in the app does this, but the
-- database currently permits it.
-- ----------------------------------------------------------------------------
-- DROP POLICY "Users can update own projects" ON public.projects;
-- CREATE POLICY "Users can update own projects" ON public.projects
--     FOR UPDATE TO authenticated
--     USING (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- OPTIONAL B — check who "Users can view templates" applies to.
--
-- Run STEP 2's query with tablename = 'projects' and look at the roles column.
-- If it says {public}, then signed-OUT visitors can read shared template rows
-- (title, author_email, file_path), because the anon key ships in the JS
-- bundle. The storage fix above already stops them downloading the files.
-- To restrict the rows to signed-in users as well:
-- ----------------------------------------------------------------------------
-- DROP POLICY "Users can view templates" ON public.projects;
-- CREATE POLICY "Users can view templates" ON public.projects
--     FOR SELECT TO authenticated
--     USING (is_template = true);

-- ----------------------------------------------------------------------------
-- OPTIONAL C — a second teacher, later.
--
-- 'john@felice.local' is now hardcoded in one storage policy and one projects
-- policy. When a second teacher joins, either edit both, or move the check into
-- a table once:
-- ----------------------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS public.teachers (email text PRIMARY KEY);
-- ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;  -- no policies: only
--                                                         -- the function reads it
-- INSERT INTO public.teachers (email) VALUES ('john@felice.local')
--     ON CONFLICT DO NOTHING;
--
-- CREATE OR REPLACE FUNCTION public.is_teacher()
-- RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$ SELECT EXISTS (SELECT 1 FROM public.teachers WHERE email = auth.email()) $$;
-- REVOKE ALL ON FUNCTION public.is_teacher() FROM public;
-- GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
--
-- then replace `auth.email() = 'john@felice.local'` with `public.is_teacher()`
-- in both policies. Adding a teacher becomes one INSERT.
