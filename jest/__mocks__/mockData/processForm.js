export const getPaymentForm = jest.fn(() => ({
  paymentMethod: {
    value: 'mockedPaymentMethod',
  },
  creditCardFields: {
    cardType: {
      value: 'mockedCardType',
    },
    cardNumber: {
      value: 'mockedCardNumber',
    },
    cardOwner: {
      value: 'mockedOwnerName',
    },
    saveCard: {
      checked: true,
    },
  },
  adyenPaymentFields: {
    adyenFingerprint: {
      value:
        'ryEGX8eZpJ0030000000000000KZbIQj6kzs0089146776cVB94iKzBGQGbvPiVrHq5S16Goh5Mk004ivbSuYdG0R00000YVxEr00000cru9sAxTR5wwQsLYbcA8:40',
    },
    adyenStateData: {
      value: 'mockedStateData',
    },
  },
}));

export const getPaymentInstrument = jest.fn((UUID = 'mocked_uuid') => ({
  UUID,
  creditCardNumber: 'mocked_cc_number',
  creditCardType: 'mocked_cc_type',
  creditCardExpirationMonth: 'mocked_cc_exp_month',
  creditCardExpirationYear: 'mocked_cc_exp_year',
  raw: { creditCardToken: 'mocked_raw_cc_token ' },
}));
