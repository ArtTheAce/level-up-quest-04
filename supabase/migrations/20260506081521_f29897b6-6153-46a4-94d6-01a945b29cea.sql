REVOKE EXECUTE ON FUNCTION public.cast_task_curse(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_task_curse(uuid, text, text, text) TO authenticated;