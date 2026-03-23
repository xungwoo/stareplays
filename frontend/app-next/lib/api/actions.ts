import { buildApiUrl } from "@/lib/api/url";
import type { ApiAnalyzerReanalyzeRequest, ApiAnalyzerReanalyzeResponse } from "@/types/api";

interface ActionOptions {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

function getErrorStatusPrefix(response: Response): string {
  return `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
}

async function buildErrorMessage(response: Response, path: string): Promise<string> {
  const statusPrefix = getErrorStatusPrefix(response);

  if (response.status === 204) {
    return `API request failed: ${path}`;
  }

  const bodyText = typeof response.text === "function" ? await response.text().catch(() => "") : "";
  const trimmedBodyText = bodyText.trim();

  if (trimmedBodyText) {
    try {
      const parsed = JSON.parse(trimmedBodyText) as { error?: unknown; message?: unknown };
      const message = parsed.error ?? parsed.message;

      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    } catch {
      return `${statusPrefix}: ${trimmedBodyText}`;
    }

    return `${statusPrefix}: ${trimmedBodyText}`;
  }

  if (typeof response.json === "function") {
    try {
      const parsed = (await response.json()) as { error?: unknown; message?: unknown };
      const message = parsed.error ?? parsed.message;

      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    } catch {
      // Fall through to a generic error below.
    }
  }

  return `API request failed: ${path}`;
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
    throw new Error(await buildErrorMessage(response, path));
  }

  if (response.status === 204) {
    return undefined as T;
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

export async function reanalyzeAnalyzerGame(
  gameId: number,
  options: ActionOptions = {}
): Promise<ApiAnalyzerReanalyzeResponse> {
  const body: ApiAnalyzerReanalyzeRequest = { game_id: gameId };

  return postApiJson<ApiAnalyzerReanalyzeResponse>("/api/v1/analyzer/reanalyze", body, options);
}
