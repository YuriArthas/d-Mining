/** Keep the original failure and the exact versioned URL; never substitute an asset. */
export class ResourceLoadError extends Error {
  readonly url: string;

  constructor(url: string | URL, cause: unknown) {
    const absolute = new URL(url, document.baseURI);
    super(`${absolute.pathname}\n${describeError(cause)}`, { cause });
    this.name = 'ResourceLoadError';
    this.url = absolute.href;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  // ImageLoader rejects with an Event, which has no network status or message.
  if (error instanceof Event) return `图像下载或解码失败（${error.type}；浏览器未提供详细原因）`;
  return String(error);
}

export async function loadResource<T>(url: string | URL, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (cause) {
    throw new ResourceLoadError(url, cause);
  }
}

export function loadJSON<T>(url: string | URL): Promise<T> {
  return loadResource(url, async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    // Body transfer and JSON decoding can fail after fetch has resolved.
    return await response.json() as T;
  });
}
