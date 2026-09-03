import desktopRelease from '../data/desktop-releases.json' with { type: 'json' };

const DEFAULT_R2_PUBLIC_BASE_URL = 'https://downloads.bongocat.pet';

export function createDesktopReleaseManifest(r2Base = DEFAULT_R2_PUBLIC_BASE_URL) {
  return {
    ...desktopRelease,
    assets: desktopRelease.assets.map(asset => ({
      ...asset,
      downloadUrl: publicR2Path(r2Base, asset.r2Path),
    })),
  };
}

function publicR2Path(base, path) {
  const root = String(base || DEFAULT_R2_PUBLIC_BASE_URL).replace(/\/+$/, '');
  const encodedPath = String(path).split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${root}/${encodedPath}`;
}
