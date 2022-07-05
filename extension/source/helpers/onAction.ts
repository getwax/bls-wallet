export default function onAction(handler: () => void) {
  return {
    onClick: handler,
    onKeyDown: (evt: { code: string }) => {
      if (['Space', 'Enter'].includes(evt.code)) {
        handler();
      }
    },
  };
}
