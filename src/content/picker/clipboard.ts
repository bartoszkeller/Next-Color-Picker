/** Resolves to true if the text was copied. */
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The async Clipboard API is unavailable on insecure origins and can be
    // blocked by a permissions policy.
    return copyViaTextarea(text);
  }
}

function copyViaTextarea(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position: fixed; top: 0; left: -9999px; opacity: 0';

  (document.body || document.documentElement).appendChild(field);
  field.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    // Reported to the caller as a failed copy.
  }
  field.remove();
  return copied;
}
