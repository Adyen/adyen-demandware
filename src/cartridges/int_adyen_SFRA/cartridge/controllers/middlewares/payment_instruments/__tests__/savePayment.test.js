/* eslint-disable global-require */
let savePayment;
let res;
let req;

beforeEach(() => {
  const { paymentInstruments } = require('../../index');
  savePayment = paymentInstruments.savePayment;
  jest.clearAllMocks();
  res = { json: jest.fn() };
  req = { currentCustomer: { profile: { customerNo: 'mocked_customerNo' } } };
});

afterEach(() => {
  jest.resetModules();
});

describe('Save Payment', () => {
  it('should do nothing if adyen secured fields is not enabled', () => {
    const AdyenHelper = require('*/cartridge/scripts/util/adyenHelper');
    const server = require('server');
    AdyenHelper.getAdyenCartridgeEnabled.mockImplementation(() => false);
    savePayment.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(server.forms.getForm).toBeCalledTimes(0);
  });

  it('should fail if zeroAuth has error', () => {
    const adyenZeroAuth = require('*/cartridge/scripts/adyenZeroAuth');
    adyenZeroAuth.zeroAuthPayment.mockImplementation(() => ({
      error: true,
    }));
    savePayment.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });

  it('should fail if resultCode is not Authorised', () => {
    const adyenZeroAuth = require('*/cartridge/scripts/adyenZeroAuth');
    adyenZeroAuth.zeroAuthPayment.mockImplementation(() => ({
      resultCode: 'Not_Authorised',
    }));
    savePayment.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });

  it('should succeed', () => {
    savePayment.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });

  it('should return redirectAction and succeed', () => {
    const adyenZeroAuth = require('*/cartridge/scripts/adyenZeroAuth');
    adyenZeroAuth.zeroAuthPayment.mockReturnValue({
      resultCode: 'RedirectShopper',
      action: {
        paymentMethodType: "scheme",
        url: "https://checkoutshopper-test.adyen.com/checkoutshopper/threeDS2.shtml",
        data: {
          MD: "mockMD",
          PaReq: "mockPaReq",
          TermUrl: "https://checkoutshopper-test.adyen.com/checkoutshopMock"},
        method: "POST",
        type: "redirect"
      }
    });
    savePayment.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
});
