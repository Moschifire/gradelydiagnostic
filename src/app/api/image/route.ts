const allowedHosts = new Set(["drive.google.com", "res.craft.do"]);

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return new Response("Missing image URL.", { status: 400 });

  let source: URL;
  try {
    source = new URL(url);
  } catch {
    return new Response("Invalid image URL.", { status: 400 });
  }

  if (source.protocol !== "https:" || !allowedHosts.has(source.hostname)) {
    return new Response("This image source is not allowed.", { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok || !upstream.body) return new Response("Image unavailable.", { status: upstream.status || 502 });

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Image unavailable.", { status: 502 });
  }
}
