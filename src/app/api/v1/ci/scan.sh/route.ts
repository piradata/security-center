import { renderScanScript } from "@/lib/ci/pipeline";
import { authenticateServiceBearer } from "@/lib/service-token";

export async function GET(request: Request) {
  if (
    !(await authenticateServiceBearer(request.headers.get("authorization")))
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new Response(renderScanScript(), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="scan.sh"',
    },
  });
}
