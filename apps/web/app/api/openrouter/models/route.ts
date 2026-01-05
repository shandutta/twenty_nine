import { NextResponse } from "next/server";

type OpenRouterModel = {
  id?: string;
  supported_parameters?: unknown;
};

const supportsReasoning = (model: OpenRouterModel): boolean => {
  const params = model.supported_parameters;
  if (!Array.isArray(params)) return false;
  return params.includes("reasoning") || params.includes("include_reasoning");
};

export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "HTTP-Referer": "http://localhost",
        "X-Title": "TwentyNine",
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { models: [], error: "OpenRouter models request failed." },
        { status: response.status }
      );
    }

    const data = (await response.json().catch(() => null)) as { data?: OpenRouterModel[] } | null;
    const models = Array.isArray(data?.data) ? data!.data : [];
    const simplified = models
      .filter((model) => typeof model?.id === "string")
      .map((model) => ({
        id: model.id as string,
        supportsReasoning: supportsReasoning(model),
      }));

    return NextResponse.json({ models: simplified });
  } catch {
    return NextResponse.json({ models: [], error: "Unable to reach OpenRouter." }, { status: 502 });
  }
}
