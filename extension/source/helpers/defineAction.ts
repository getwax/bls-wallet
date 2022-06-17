// TODO: Make use of this
// TODO: Rename to onAction

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
