jest.mock('../order');
jest.mock('../error');
jest.mock('../payment');

const OrderMgr = require('dw/order/OrderMgr');
const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
const handleAuthorize = require('../authorize');
const handleOrderConfirmation = require('../order');
const handleInvalidPayment = require('../payment');
const handleError = require('../error');

let req;
let res;

beforeEach(() => {
  jest.clearAllMocks();
  req = { form: { MD: 'mocked_md' }, querystring: { merchantReference : 'mocked_merchantReference'} };
  res = { redirect: jest.fn() };
});

afterEach(() => {
  jest.resetModules();
});

describe('Authorize', () => {
  it('should authorize when MD is valid', () => {
    OrderMgr.toArray.mockImplementation(() => [
      { custom: { adyenMD: 'mocked_md' } },
    ]);
    handleAuthorize({ req, res, next: jest.fn() });
    expect(handleOrderConfirmation.mock.calls).toMatchSnapshot();
  });
  it('should handle error when MD is invalid', () => {
    req.form.MD = 'invalid_mocked_md';
    handleAuthorize({ req, res, next: jest.fn() });
    expect(handleError.mock.calls).toMatchSnapshot();
  });
  it('should handle invalid payment when result code is not Authorised', () => {
    req.form.MD = 'mocked_md_unauthorised';
    OrderMgr.toArray.mockImplementation(() => [
      { custom: { adyenMD: 'mocked_md_unauthorised' } },
    ]);
    handleAuthorize({ req, res, next: jest.fn() });
    expect(handleInvalidPayment.mock.calls).toMatchSnapshot();
  });
  it('should handle invalid payment when there is an error while placing an order', () => {
    OrderMgr.toArray.mockImplementation(() => [
      { custom: { adyenMD: 'mocked_md' } },
    ]);
    COHelpers.placeOrder.mockImplementation(() => ({ error: true }));
    handleAuthorize({ req, res, next: jest.fn() });
    expect(handleInvalidPayment.mock.calls).toMatchSnapshot();
  });
});
