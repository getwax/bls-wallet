import Browser from 'webextension-polyfill';
import QuillController from './QuillController';

export default function Debug(quillController: QuillController) {
  let warnedAboutDeletion = false;

  return {
    storageCells: quillController.cells,
    Browser,
    reset: async () => {
      if (!warnedAboutDeletion) {
        // TODO: Instead of being dramatic, we probably don't need to care about
        // the completeness of our reset and instead offer backups. This could
        // be a user-facing feature too.
        console.warn(
          [
            "WARNING: This will delete ALL of Quill's storage, including any",
            'private keys. Use debug.reset() again to proceed.',
          ].join(' '),
        );

        warnedAboutDeletion = true;

        return;
      }

      await Browser.storage.local.clear();
      window.location.reload();
    },
  };
}
