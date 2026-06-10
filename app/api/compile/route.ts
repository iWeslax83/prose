import { NextResponse } from "next/server";
import { CompileError, providerLabel, selectProvider } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let source = "";
  try {
    const body = (await req.json()) as { source?: string };
    source = (body.source ?? "").toString();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (!source.trim()) {
    return NextResponse.json({ error: "Boş niyet — bir cümle yazın." }, { status: 400 });
  }

  try {
    const provider = selectProvider();
    const graph = await provider.compile(source);
    return NextResponse.json({ graph, provider: providerLabel() });
  } catch (err) {
    if (err instanceof CompileError) {
      return NextResponse.json(
        { error: err.message, atValue: err.atValue, kind: "compile" },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Derleme hatası." },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json({ provider: providerLabel() });
}
