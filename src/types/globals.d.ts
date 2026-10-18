/** Firefox's promise-based WebExtension namespace; undefined in Chrome. */
declare var browser: typeof chrome | undefined;

/** Stylesheets are bundled as plain text and injected into shadow roots. */
declare module '*.css' {
  const css: string;
  export default css;
}
