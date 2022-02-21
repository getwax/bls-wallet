import { windows, runtime } from 'webextension-polyfill';
import TaskQueue from '../common/TaskQueue';
import generateRandomHex from '../helpers/generateRandomHex';
import getPropOrUndefined from '../helpers/getPropOrUndefined';

export default function promptUser(opt: {
  promptText: string;
}): Promise<string | undefined> {
  const cleanupTasks = new TaskQueue();

  const resultPromise = new Promise<string | undefined>((resolve, _reject) => {
    const id = generateRandomHex(256);

    (async () => {
      const lastWin = await windows.getLastFocused();

      const popupWidth = 359;
      let left: number | undefined;

      if (lastWin.width !== undefined && lastWin.left !== undefined) {
        left = lastWin.left + lastWin.width - popupWidth - 20;
      }

      const popup = await windows.create({
        url: runtime.getURL(`confirm.html?${opt.promptText}&id=${id}`),
        type: 'popup',
        width: popupWidth,
        height: 500,
        left,
      });

      cleanupTasks.push(() => {
        if (popup.id !== undefined) {
          windows.remove(popup.id);
        }
      });

      function onRemovedListener(windowId: number) {
        if (windowId === popup.id) {
          resolve(undefined);
        }
      }

      windows.onRemoved.addListener(onRemovedListener);

      cleanupTasks.push(() => {
        windows.onRemoved.removeListener(onRemovedListener);
      });

      function messageListener(message: unknown) {
        if (getPropOrUndefined(message, 'id') !== id) {
          return;
        }

        resolve(getPropOrUndefined(message, 'result') as string);
      }

      runtime.onMessage.addListener(messageListener);
    })();
  });

  resultPromise.finally(() => cleanupTasks.run());

  return resultPromise;
}
