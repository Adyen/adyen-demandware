export const doPaymentsDetailsCall = jest.fn((payload) => {
  let resultCode;
  if(payload.paymentData) {
    resultCode = payload.paymentData;
  } else if(payload.details?.MD) {
    resultCode = payload.details.MD === 'mocked_md' ? 'Authorised': 'Not_Authorised';
  }
  return {resultCode};
});
export const createPaymentRequest = jest.fn(() => ({
  resultCode: 'Authorised',
}));
