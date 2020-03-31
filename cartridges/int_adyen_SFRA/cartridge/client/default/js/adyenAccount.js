var checkoutConfiguration = window.Configuration;
checkoutConfiguration.paymentMethodsConfiguration = {
    card: {
        enableStoreDetails: showStoreDetails,
        hasHolderName: true,
        onBrand: function (brandObject) {
            $('#cardType').val(brandObject.brand);
        },
        onFieldValid: function (data) {
            if (data.endDigits) {
                maskedCardNumber = MASKED_CC_PREFIX + data.endDigits;
                $("#cardNumber").val(maskedCardNumber);
            }
        },
        onChange: function (state) {
            storeDetails = state.data.storePaymentMethod;
            isValid = state.isValid;
            componentState = state;
        }
    }
}

var checkout = new AdyenCheckout(checkoutConfiguration);
var cardNode = document.getElementById("card");
var maskedCardNumber;
var isValid = false;
var storeDetails;
var componentState;
var MASKED_CC_PREFIX = "************";

(function () {
    var card = checkout.create("card");
    card.mount(cardNode);
})();


$('button[value="add-new-payment"]').on('click', function (e) {
    //TODO BAS validation
    if(componentState.isValid){
        document.querySelector("#adyenStateData").value = JSON.stringify(componentState.data);
        return true;
    }
    else {
        componentState.showValidation;
        return false;
    }
});