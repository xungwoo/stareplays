import { buildApiUrl } from "@/lib/api/url";

interface ActionOptions {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

async function fetchApiActionJson<T>(
  path: string,
  options: ActionOptions,
  init: RequestInit
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  const response = await fetchImpl(buildApiUrl(path, options.apiBaseUrl), {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let message: string | null = null;

    try {
      const errorPayload = (await response.json()) as { error?: unknown; message?: unknown };
      const errorMessage = errorPayload.error ?? errorPayload.message;

      if (typeof errorMessage === "string" && errorMessage.trim()) {
        message = errorMessage.trim();
      }
    } catch {
      // Fall through to a generic error below.
    }

    throw new Error(message || `API request failed: ${path}`);
  }

  return (await response.json()) as T;
}

export async function postApiJson<T>(path: string, body: unknown, options: ActionOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set("content-type", "application/json");

  return fetchApiActionJson<T>(path, options, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

function appendReplayFiles(formData: FormData, files: File[]): void {
  for (const file of files) {
    formData.append("replay_files", file);
  }
}

export async function previewReplayUpload(files: File[], options: ActionOptions = {}): Promise<unknown> {
  const formData = new FormData();
  appendReplayFiles(formData, files);

  return fetchApiActionJson("/api/v1/games/upload/preview", options, {
    method: "POST",
    body: formData
  });
}

export async function submitReplayUpload(
  files: File[],
  uploaderName: string,
  options: ActionOptions = {}
): Promise<unknown> {
  const formData = new FormData();
  appendReplayFiles(formData, files);
  formData.append("uploader_name", uploaderName);

  return fetchApiActionJson("/api/v1/games/upload", options, {
    method: "POST",
    body: formData
  });
}
