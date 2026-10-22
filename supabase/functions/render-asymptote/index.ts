const allowedOrigin = "https://ogsanskar.github.io";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (origin && origin !== allowedOrigin) {
    return new Response("Origin not allowed", {
      status: 403,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response("Use POST with raw Asymptote source code.", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const source = await req.text();
    if (!source.trim()) {
      return new Response("Missing Asymptote source.", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (source.length > 20000) {
      return new Response("Asymptote source is too long (20,000 character limit).", {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const upstream = await fetch("https://asymptote.ualberta.ca:10007/?f=svg", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: source,
      signal: AbortSignal.timeout(25000),
    });

    const svg = await upstream.text();
    if (!upstream.ok) {
      return new Response("Asymptote compiler returned HTTP " + upstream.status, {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (!svg.trim().startsWith("<svg") && !svg.trim().startsWith("<?xml")) {
      return new Response("The Asymptote compiler did not return SVG. Check the source code.", {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(svg, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:;",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response("Could not reach the Asymptote compiler: " + message, {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
