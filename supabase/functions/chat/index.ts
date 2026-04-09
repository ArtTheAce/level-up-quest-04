import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    console.log("chat env check", JSON.stringify({ hasLovableApiKey: Boolean(LOVABLE_API_KEY) }));
    if (!LOVABLE_API_KEY) {
      return json({ error: "Server configuration error: missing AI credentials." }, 500);
    }

    const payload = await req.json().catch(() => null);
    const messages = payload?.messages;
    const system = payload?.system;

    if (!Array.isArray(messages) || typeof system !== "string" || system.trim().length === 0) {
      return json({ error: "Invalid request body" }, 400);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 1000,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return json({ error: "Rate limited — please try again in a moment." }, 429);
      }
      if (response.status === 402) {
        return json({ error: "AI credits exhausted. Add funds in workspace settings." }, 402);
      }
      return json({
        error: "AI service error",
        details: errorText.slice(0, 500),
      }, 502);
    }

    if (!response.body) {
      return json({ error: "AI service returned no stream." }, 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
