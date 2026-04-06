var STRIPE_ENABLED = true;

var STRIPE_PUBLISHABLE_KEY = 'pk_live_51TJ1OVDlmCSCy5M3ISFEchuw5ay54JEJj7yCIhzRDF3ao6SQrQ2YOIlEE0E3mC3AX9MGmjfyWl2j40TzMwCsk92r002A7uTDMS';

// Price IDs created in Stripe — one per vehicle (rate per day, quantity = number of days)
var STRIPE_PRICE_IDS = {
  slingshot_2022: 'price_1TJ1WhDlmCSCy5M3ZzTUKo6U',
  slingshot_2020: 'price_1TJ1WhDlmCSCy5M3lht61h3l',
  canam_spyder:   'price_1TJ1WiDlmCSCy5M30zruaRZ7'
};
