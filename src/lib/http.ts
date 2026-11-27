/**
 * Safely parses an API response after verifying Content-Type and HTTP status.
 * Prevents "Unexpected token '<', '<!doctype ...' is not valid JSON" errors
 * when an upstream proxy or misrouted path returns HTML instead of JSON.
 */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    const preview = (await res.text()).slice(0, 120).trim();
    const looksHtml =
      preview.toLowerCase().startsWith('<!doctype') ||
      preview.toLowerCase().startsWith('<html');

    if (looksHtml) {
      throw new Error(
        `Server returned an HTML page (HTTP ${res.status}) instead of JSON data. Please retry or check that the backend API server is running.`
      );
    }

    throw new Error(
      `Unexpected response format (${contentType || 'unknown'}, HTTP ${res.status}).`
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Received malformed JSON from server (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed with HTTP ${res.status}.`;
    throw new Error(errMsg);
  }

  return data as T;
}
