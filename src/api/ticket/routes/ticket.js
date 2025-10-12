'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/tickets/:eventId',
      handler: 'ticket.findEventTicketsByUser',
      config: {
        auth: false, // disable JWT check completely
        policies: [], // no extra restrictions
        middlewares: [], // no middleware validation
      },
    },
  ],
};
