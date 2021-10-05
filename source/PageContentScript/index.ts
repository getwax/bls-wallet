import { PostMessageTransportClient } from '../common/postMessaging';
import QuillEthereumProvider from './QuillEthereumProvider';

const transportClient = PostMessageTransportClient('quill-extension');

const quillEthereumProvider = new QuillEthereumProvider(transportClient);

const windowRecord = window as unknown as Record<string, unknown>;

if (!windowRecord.ethereum) {
  windowRecord.ethereum = quillEthereumProvider;
}

windowRecord.quillEthereumProvider = quillEthereumProvider;
