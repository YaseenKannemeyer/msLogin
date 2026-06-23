export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  try {
    return await handler.GET(request);
  } catch (error) {
    console.error("[AUTH GET ERROR]", error);
    return new Response(
      JSON.stringify({ error: String(error), message: "Auth handler failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await handler.POST(request);
  } catch (error) {
    console.error("[AUTH POST ERROR]", error);
    return new Response(
      JSON.stringify({ error: String(error), message: "Auth handler failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
