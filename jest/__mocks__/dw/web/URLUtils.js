export const url = jest.fn((...args) => ({
  toString: jest.fn(() => JSON.stringify(args)),
}));
