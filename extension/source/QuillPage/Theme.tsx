import { FunctionComponent } from 'react';
import useCell from '../cells/useCell';
import { useQuill } from './QuillContext';

const Theme: FunctionComponent = ({ children }) => {
  const quill = useQuill();
  const theme = useCell(quill.cells.theme);

  return (
    <div className={`themable1 ${theme === 'dark' && 'dark-theme'}`}>
      <div className={`themable2 ${theme === 'dark' && 'dark-theme'}`}>
        {children}
      </div>
    </div>
  );
};

export default Theme;
