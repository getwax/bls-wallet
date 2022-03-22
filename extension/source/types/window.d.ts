import type QuillController from '../Controllers/QuillController';
import type KeyringController from '../Controllers/Keyring/KeyringController';

export declare global {
  interface Window {
    // TODO (merge-ok) Remove both of these when full controller linking is completed.
    QuillController: () => QuillController;
    KeyringController: () => KeyringController;
  }
}
