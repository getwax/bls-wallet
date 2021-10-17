// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function defineAction(handler: () => void) {
  return {
    onClick: handler,
    onKeyDown: (evt: { code: string }) => {
      if (evt.code === 'Enter') {
        handler();
      }
    },
  };
}
