import { handleOpenRouterConfig, handleOpenRouterPost } from "@/lib/openrouter";

export async function GET() {
  return handleOpenRouterConfig();
}

export async function POST(request: Request) {
  return handleOpenRouterPost(request);
}
