import * as React from 'react';

import UiEvents from '../UiEvents';
import Button from './Button';

export default function NotImplemented(uie: UiEvents): void {
  uie.emit('overlay', (close) => (
    <>
      <div style={{ marginBottom: '12px' }}>Not implemented</div>
      <Button highlight={true} onPress={close}>
        Ok
      </Button>
    </>
  ));
}
