import { handleOpenRouterPost } from "@/lib/openrouter";
import { requireAccessToken } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = requireAccessToken(request);
  if ("response" in auth) {
    return auth.response;
  }
  return handleOpenRouterPost(request);
}
