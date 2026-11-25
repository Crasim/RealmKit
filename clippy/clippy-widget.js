const DEFAULT_RUNTIME_URL = new URL("./clippy.js", import.meta.url).href;
const DEFAULT_STYLE_URL = new URL("./clippy-widget.css", import.meta.url).href;
const DEFAULT_ENDPOINT = new URL("./chat.php", import.meta.url).href;
const DEFAULT_CHARACTER_PACK_URLS = [
  new URL("./characters/clippy.pack.js", import.meta.url).href,
  new URL("./characters/ember.pack.js", import.meta.url).href,
  new URL("./characters/saucer.pack.js", import.meta.url).href,
];

let runtimePromise = null;
const externalScriptPromises = new Map();

function resolveAssetUrl(url, base) {
  return new URL(url, base).href;
}

function waitForDom() {
  if (document.readyState !== "loading" && document.body) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

function findStyleLink(href) {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .find(node => node.href === href || node.dataset.clippyPackageStyle === href);
}

function findRuntimeScript(src) {
  return Array.from(document.querySelectorAll("script"))
    .find(node => node.src === src || node.dataset.clippyPackageRuntime === src);
}

function findCharacterPackScript(src) {
  return Array.from(document.querySelectorAll("script"))
    .find(node => node.src === src || node.dataset.clippyCharacterPack === src);
}

function hasClippyBootstrap(value) {
  return !!value && typeof value.mount === "function";
}

function ensureStyle(styleUrl = DEFAULT_STYLE_URL) {
  const href = resolveAssetUrl(styleUrl, document.baseURI);
  const existing = findStyleLink(href);
  if (existing) return existing;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.clippyPackageStyle = href;
  (document.head || document.documentElement).appendChild(link);
  return link;
}

function ensureRuntime(runtimeUrl = DEFAULT_RUNTIME_URL) {
  if (hasClippyBootstrap(window.Clippy)) {
    return Promise.resolve(window.Clippy);
  }
  if (runtimePromise) {
    return runtimePromise;
  }

  const src = resolveAssetUrl(runtimeUrl, document.baseURI);
  runtimePromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (hasClippyBootstrap(window.Clippy)) {
        resolve(window.Clippy);
      } else {
        reject(new Error("Clippy runtime loaded, but window.Clippy.mount is unavailable."));
      }
    };

    const existing = findRuntimeScript(src);
    if (existing) {
      if (hasClippyBootstrap(window.Clippy)) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => {
        reject(new Error(`Failed to load Clippy runtime: ${src}`));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.clippyPackageRuntime = src;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => {
      reject(new Error(`Failed to load Clippy runtime: ${src}`));
    }, { once: true });
    (document.head || document.documentElement).appendChild(script);
  });

  return runtimePromise;
}

function ensureExternalScript(url, dataAttr, finder) {
  const src = resolveAssetUrl(url, document.baseURI);
  const pending = externalScriptPromises.get(src);
  if (pending) return pending;

  const promise = new Promise((resolve, reject) => {
    const existing = typeof finder === "function" ? finder(src) : null;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset[dataAttr] = src;
    script.addEventListener("load", () => resolve(script), { once: true });
    script.addEventListener("error", () => {
      externalScriptPromises.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    }, { once: true });
    (document.head || document.documentElement).appendChild(script);
  });

  externalScriptPromises.set(src, promise);
  return promise;
}

function ensureCharacterPackScripts(urls = DEFAULT_CHARACTER_PACK_URLS) {
  const uniqueUrls = [...new Set((urls || []).filter(Boolean).map(url => resolveAssetUrl(url, document.baseURI)))];
  return Promise.all(uniqueUrls.map(src => ensureExternalScript(src, "clippyCharacterPack", findCharacterPackScript)));
}

export function getClippyAssetUrls() {
  return {
    endpoint: DEFAULT_ENDPOINT,
    runtime: DEFAULT_RUNTIME_URL,
    style: DEFAULT_STYLE_URL,
    characterPacks: [...DEFAULT_CHARACTER_PACK_URLS],
  };
}

export async function preloadClippy(opts = {}) {
  ensureStyle(opts.styleUrl || DEFAULT_STYLE_URL);
  const characterPackUrls = [
    ...DEFAULT_CHARACTER_PACK_URLS,
    ...((opts && opts.characterPacks) || []),
  ];
  await ensureCharacterPackScripts(characterPackUrls);
  return ensureRuntime(opts.runtimeUrl || DEFAULT_RUNTIME_URL);
}

export async function mountClippy(opts = {}) {
  const {
    endpoint,
    character,
    characterPacks,
    runtimeUrl,
    styleUrl,
    autoOpen = false,
    ...mountOptions
  } = opts || {};

  await waitForDom();
  ensureStyle(styleUrl || DEFAULT_STYLE_URL);
  await ensureCharacterPackScripts([
    ...DEFAULT_CHARACTER_PACK_URLS,
    ...(characterPacks || []),
  ]);
  const clippy = await ensureRuntime(runtimeUrl || DEFAULT_RUNTIME_URL);
  const api = clippy.mount({
    ...mountOptions,
    ...(character ? { character } : {}),
    endpoint: endpoint || DEFAULT_ENDPOINT,
  });
  if (autoOpen && api && typeof api.open === "function") {
    api.open();
  }
  return api;
}

const packageApi = {
  DEFAULT_ENDPOINT,
  DEFAULT_CHARACTER_PACK_URLS,
  DEFAULT_RUNTIME_URL,
  DEFAULT_STYLE_URL,
  getClippyAssetUrls,
  preload: preloadClippy,
  mount: mountClippy,
};

if (typeof window !== "undefined") {
  window.ClippyPackage = packageApi;
}

export {
  DEFAULT_ENDPOINT,
  DEFAULT_CHARACTER_PACK_URLS,
  DEFAULT_RUNTIME_URL,
  DEFAULT_STYLE_URL,
};

export default packageApi;
