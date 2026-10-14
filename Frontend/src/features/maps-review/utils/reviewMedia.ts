import { API_BASE_URL } from '../../../shared/api';

export const toBackendAssetUrl = (assetUrl: string): string => {
  if (/^https?:\/\//.test(assetUrl)) {
    return assetUrl;
  }

  return new URL(assetUrl, `${new URL(API_BASE_URL).origin}/`).toString();
};
