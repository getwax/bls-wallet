// TODO: Move to helpers

import { encode as encode58 } from 'bs58check';

export const RandomId = (): string =>
  encode58(crypto.getRandomValues(new Uint8Array(16)));

export const getUserLanguage = (): string => {
  const navLang = window.navigator.language || 'en-US';
  const preLang = navLang.split('-');
  return preLang[0] || 'en';
};
