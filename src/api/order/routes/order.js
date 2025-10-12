'use strict';

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/orders",
      handler: "order.create",
      config: {
        auth: false, // disable JWT check completely
        policies: [], // no extra restrictions
        middlewares: [], // no middleware validation
      },
    },
    {
      method: "GET",
      path: "/orders/user/:userId", // user wise orders
      handler: "order.getUserOrdersByEvent",
      config: {
        auth: false, // same reason — external auth
        policies: [],
        middlewares: [],
      },
    },
    
  ],
};
