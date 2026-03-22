interface ActionOptions {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

function normalizeBaseUrl(value?: string): string {
  const fallback = "http://127.0.0.1:3000";
  const base = value?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || fallback;

  return base.endsWith("/") ? base : `${base}/`;
}

function buildApiUrl(path: string, apiBaseUrl?: string): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(normalizedPath, normalizeBaseUrl(apiBaseUrl)).toString();
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
    throw new Error(`API request failed: ${path}`);
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
