const mockPlugin = {
  start: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn(),
  getNpub: jest.fn(),
  getAddress: jest.fn(),
  sendDatagram: jest.fn(),
  sendDatagramByAddr: jest.fn(),
  listSessions: jest.fn(),
  listPeers: jest.fn(),
  addPeer: jest.fn(),
  removePeer: jest.fn(),
  addListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

let platform = "android";

export const Capacitor = {
  getPlatform: jest.fn(() => platform),
  __setPlatform: (p: string) => { platform = p; },
};

export const registerPlugin = jest.fn(() => mockPlugin);

export const __getMockPlugin = () => mockPlugin;
export const __resetMockPlugin = () => {
  Object.values(mockPlugin).forEach((fn) => (fn as jest.Mock).mockReset());
};
